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
