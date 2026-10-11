import type { ChatMessage } from '../../types'
import { notifyChatDocumentUpdated } from '../notifications/notify'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export async function fetchChatMessages(
  projectId: string,
  documentId?: string,
): Promise<ChatMessage[]> {
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (documentId) {
    query = query.eq('document_id', documentId)
  }

  const { data, error } = await query
  throwIfError(error)
  return data ?? []
}

export async function saveMessage(
  projectId: string,
  documentId: string | null,
  role: 'user' | 'assistant',
  content: string,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      project_id: projectId,
      document_id: documentId,
      role,
      content,
    })
    .select()
    .single()
  return unwrap(data, error)
}

export async function sendChatMessage(
  projectId: string,
  documentId: string,
  content: string,
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage; updatedContent: string }> {
  const userMessage = await saveMessage(projectId, documentId, 'user', content)

  const { data: doc } = await supabase
    .from('documents')
    .select('content')
    .eq('id', documentId)
    .maybeSingle()

  const updatedContent = doc
    ? `${doc.content}\n\n<!-- AI 수정 반영 -->\n> ${content}`
    : content

  if (doc) {
    const { error } = await supabase
      .from('documents')
      .update({ content: updatedContent })
      .eq('id', documentId)
    throwIfError(error)
  }

  const assistantMessage = await saveMessage(
    projectId,
    documentId,
    'assistant',
    '요청하신 내용을 문서에 반영했습니다.',
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.user && doc) {
    const { data: profile } = await supabase
      .from('users')
      .select('name')
      .eq('id', session.user.id)
      .maybeSingle()
    void notifyChatDocumentUpdated(
      projectId,
      documentId,
      session.user.id,
      profile?.name ?? '사용자',
      assistantMessage.id,
    )
  }

  return { userMessage, assistantMessage, updatedContent }
}
