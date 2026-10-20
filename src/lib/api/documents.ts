import type { Document, DocumentType } from '../../types'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export async function fetchDocuments(projectId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('type')
  throwIfError(error)
  return data ?? []
}

export async function fetchDocument(
  projectId: string,
  type: DocumentType,
): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .eq('type', type)
    .maybeSingle()
  throwIfError(error)
  return data
}

export async function saveDocumentContent(id: string, content: string): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .update({ content })
    .eq('id', id)
    .select()
    .single()
  return unwrap(data, error)
}


/**
 * Compare-and-swap save for recovered drafts and competing editors.
 * Callers MUST provide the last confirmed server content, never the current
 * unsaved editor buffer. No matching row means stale baseline or lost access.
 * A one-row conditional UPDATE is atomic at PostgreSQL statement scope.
 */
export class DocumentWriteConflictError extends Error {
  constructor() {
    super('문서가 다른 곳에서 변경되었거나 저장 권한이 없습니다. 서버 내용을 다시 확인하세요.')
    this.name = 'DocumentWriteConflictError'
  }
}

export async function saveDocumentContentIfUnchanged(
  id: string,
  expectedServerContent: string,
  nextContent: string,
): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .update({ content: nextContent })
    .eq('id', id)
    .eq('content', expectedServerContent)
    .select()
  throwIfError(error)
  if (!data || data.length !== 1) throw new DocumentWriteConflictError()
  return data[0]
}

export async function upsertDocument(
  doc: Omit<Document, 'id' | 'created_at' | 'updated_at'> &
    Partial<Pick<Document, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Document> {
  const row: Record<string, string> = {
    project_id: doc.project_id,
    type: doc.type,
    content: doc.content,
  }
  if (doc.id) row.id = doc.id

  const { data, error } = await supabase
    .from('documents')
    .upsert(row, { onConflict: 'project_id,type' })
    .select()
    .single()
  return unwrap(data, error)
}
