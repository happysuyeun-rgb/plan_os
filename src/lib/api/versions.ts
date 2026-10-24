import type { Document, DocumentVersion, DocumentVersionSummary } from '../../types'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export async function fetchVersions(documentId: string): Promise<DocumentVersion[]> {
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
  throwIfError(error)
  return data ?? []
}

export async function fetchVersionSummary(documentId: string): Promise<DocumentVersionSummary> {
  const { data, error } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', documentId)
  throwIfError(error)
  const versions = data ?? []
  const latest =
    versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) : 0
  return {
    document_id: documentId,
    latest_version_number: latest,
    version_count: versions.length,
  }
}

export async function fetchVersionSummaries(
  documentIds: string[],
): Promise<Record<string, DocumentVersionSummary>> {
  const result: Record<string, DocumentVersionSummary> = {}
  await Promise.all(
    documentIds.map(async (id) => {
      result[id] = await fetchVersionSummary(id)
    }),
  )
  return result
}

export async function createVersion(
  documentId: string,
  content: string,
  versionName?: string,
): Promise<DocumentVersion> {
  const { data: existing, error: fetchError } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)
  throwIfError(fetchError)

  const nextNumber = (existing?.[0]?.version_number ?? 0) + 1

  const { data, error } = await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: nextNumber,
      version_name: versionName ?? null,
      content,
    })
    .select()
    .single()
  return unwrap(data, error)
}


/**
 * Restore an immutable historical version in ONE PostgreSQL transaction.
 * p_operation_id stays stable across an ambiguous network failure/retry.
 * The target content is read on the server; callers cannot forge a snapshot.
 * Requires migration 011 (not yet applied to hosted Supabase).
 */
export async function restoreDocumentVersion(
  documentId: string,
  versionId: string,
  operationId: string,
): Promise<Document> {
  const { data, error } = await supabase
    .rpc('restore_document_version', {
      p_document_id: documentId,
      p_version_id: versionId,
      p_operation_id: operationId,
    })
    .single()
  return unwrap(data as Document | null, error)
}
