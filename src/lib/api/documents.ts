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


// Server-side equality guard for edits derived from a previously read document.
// A 0-row result may also mean permission was revoked; do not expose which.
export class DocumentWriteConflictError extends Error {
  constructor() {
    super('문서가 변경되었거나 저장 권한이 없습니다. 로컬 초안을 보존하고 새로 확인하세요.')
    this.name = 'DocumentWriteConflictError'
  }
}

export async function saveDocumentContentIfUnchanged(id: string, expectedServerContent: string, nextContent: string): Promise<Document> {
  const { data, error } = await supabase.from('documents')
    .update({ content: nextContent }).eq('id', id).eq('content', expectedServerContent).select()
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
