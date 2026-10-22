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

export async function fetchDocumentById(id: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  throwIfError(error)
  return data
}

// Server-side Revision CAS conflict (dedicated SQLSTATE P4001 from
// save_document_content_cas, migration 018; never 40001, which PostgREST
// retries). The editor draft is preserved locally; the user reloads the
// latest document before saving again.
export class DocumentWriteConflictError extends Error {
  constructor() {
    super('문서가 다른 곳에서 변경되었습니다. 입력 내용은 보존되며, 최신 문서를 확인한 뒤 다시 저장하세요.')
    this.name = 'DocumentWriteConflictError'
  }
}

/**
 * The only autosave write path. The server (migration 018) verifies the
 * authenticated caller, an active project, and editor/owner permission,
 * then writes only when the stored content_revision equals
 * `expectedRevision`. A mismatch raises SQLSTATE P4001 and changes nothing,
 * so a stale save can never overwrite a newer document. Retrying the same
 * (expectedRevision, content) after a lost response is a safe no-op.
 *
 * The previous unconditional `saveDocumentContent` update was removed: it
 * had no remaining callers and bypassed every revision guard.
 */
export async function saveDocumentContentCas(
  id: string,
  expectedRevision: number,
  nextContent: string,
): Promise<Document> {
  const { data, error } = await supabase
    .rpc('save_document_content_cas', {
      p_document_id: id,
      p_expected_revision: expectedRevision,
      p_content: nextContent,
    })
    .single()
  if (error && (error as { code?: string }).code === 'P4001') {
    throw new DocumentWriteConflictError()
  }
  return unwrap(data as Document | null, error)
}

// First-creation race: another request created the document first. The
// stored document is never overwritten; the caller keeps the generated
// draft and retries explicitly after reloading the latest document.
export class DocumentAlreadyExistsError extends Error {
  constructor() {
    super('문서가 이미 다른 요청에서 생성되었습니다. 생성된 내용은 보존되며, 최신 문서를 확인한 뒤 다시 시도하세요.')
    this.name = 'DocumentAlreadyExistsError'
  }
}

/** PostgreSQL unique_violation as reported by PostgREST / supabase-js. */
export function isUniqueViolationError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505'
}

/**
 * INSERT-only first creation. The previous upsert on
 * (project_id, type) silently replaced a document that a concurrent
 * request had just created, so first creation must never use it: a
 * unique violation (23505) surfaces as DocumentAlreadyExistsError and
 * the existing document stays untouched.
 */
export async function insertDocument(
  doc: Omit<Document, 'id' | 'created_at' | 'updated_at' | 'content_revision'> &
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
    .insert(row)
    .select()
    .single()
  if (isUniqueViolationError(error)) {
    throw new DocumentAlreadyExistsError()
  }
  return unwrap(data, error)
}
