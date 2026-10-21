import type { ChatMessage } from '../../types'
import { notifyChatDocumentUpdated } from '../notifications/notify'
import { supabase } from '../supabase'
import { throwIfError } from '../supabaseHelpers'

export async function fetchChatMessages(
  projectId: string,
  documentId?: string,
): Promise<ChatMessage[]> {
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (documentId) query = query.eq('document_id', documentId)
  const { data, error } = await query
  throwIfError(error)
  return data ?? []
}

export interface AtomicChatEditResult {
  userMessage: ChatMessage
  assistantMessage: ChatMessage
  updatedContent: string
}

/** One authenticated DB transaction; requires local-only proposed migration 012. */
export async function commitChatDocumentRPC(
  projectId: string,
  documentId: string,
  content: string,
  operationId: string,
): Promise<AtomicChatEditResult> {
  const { data, error } = await supabase.rpc('commit_chat_document_edit', {
    p_project_id: projectId,
    p_document_id: documentId,
    p_content: content,
    p_operation_id: operationId,
  })
  throwIfError(error)
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Chat transaction response unavailable')
  }
  const result = data as {
    user_message?: ChatMessage
    assistant_message?: ChatMessage
    updated_content?: string
  }
  if (!result.user_message?.id || !result.assistant_message?.id ||
      typeof result.updated_content !== 'string') {
    throw new Error('Chat transaction result missing committed rows')
  }
  return {
    userMessage: result.user_message,
    assistantMessage: result.assistant_message,
    updatedContent: result.updated_content,
  }
}

export type CommitChatDocumentChange = (
  projectId: string,
  documentId: string,
  message: string,
  operationId: string,
) => Promise<AtomicChatEditResult>

/**
 * Notifications are best-effort AFTER the authoritative transaction. A
 * notification failure is never permission to repeat a committed chat edit.
 */
export async function sendChatMessage(
  projectId: string,
  documentId: string,
  content: string,
  operationId: string,
  commitDocumentChange: CommitChatDocumentChange,
): Promise<AtomicChatEditResult> {
  const result = await commitDocumentChange(projectId, documentId, content, operationId)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabase
        .from('users').select('name').eq('id', session.user.id).maybeSingle()
      void notifyChatDocumentUpdated(
        projectId, documentId, session.user.id, profile?.name ?? '사용자',
        result.assistantMessage.id,
      ).catch(() => undefined)
    }
  } catch {
    // Chat and document are already committed. Do not signal false failure.
  }
  return result
}
