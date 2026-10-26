import { supabase } from '../supabase'

/** Client-facing conflict after server digest/revision re-check (SQLSTATE P4001). */
export class AuditManifestStaleError extends Error {
  readonly status = 409
  readonly code = 'STALE_SOURCE'

  constructor(message = '선택한 문서가 변경되었습니다. 문서를 다시 선택하고 manifest를 갱신한 뒤 실행하세요.') {
    super(message)
    this.name = 'AuditManifestStaleError'
  }
}

export class AuditManifestAccessError extends Error {
  readonly status = 403
  readonly code = 'NOT_ALLOWED'

  constructor(message = '검수 소스 manifest에 접근할 권한이 없습니다.') {
    super(message)
    this.name = 'AuditManifestAccessError'
  }
}

function throwManifestError(error: { code?: string; message?: string } | null): never {
  const code = error?.code ?? ''
  const message = error?.message ?? ''
  if (code === 'P4001' || message.includes('STALE_SOURCE')) {
    throw new AuditManifestStaleError()
  }
  if (code === '42501' || message.includes('NOT_ALLOWED')) {
    throw new AuditManifestAccessError()
  }
  if (code === 'P0002' || message.includes('MANIFEST_NOT_FOUND')) {
    throw new AuditManifestStaleError('저장된 manifest를 찾을 수 없습니다. 문서를 다시 선택하세요.')
  }
  throw error ?? new Error('감사 소스 manifest 요청에 실패했습니다.')
}

/**
 * Creates an immutable server snapshot. Digests are computed in SQL from
 * `documents.content` — client-supplied hashes are never trusted.
 */
export async function createAuditManifest(
  projectId: string,
  documentIds: string[],
  requestKey: string,
): Promise<string> {
  if (documentIds.length < 2 || documentIds.length > 20 || new Set(documentIds).size !== documentIds.length) {
    throw new Error('검수할 문서를 중복 없이 2~20개 선택하세요.')
  }
  const { data, error } = await supabase.rpc('create_audit_source_manifest', {
    p_project_id: projectId,
    p_document_ids: documentIds,
    p_request_key: requestKey,
  })
  if (error) throwManifestError(error)
  if (typeof data !== 'string') throw new Error('문서 스냅샷 생성 결과가 올바르지 않습니다.')
  return data
}

export async function isAuditManifestCurrent(manifestId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_audit_source_manifest_current', { p_id: manifestId })
  if (error) throwManifestError(error)
  return data === true
}

/**
 * Execution-time gate (F-202). Recomputes digests on the server; raises
 * AuditManifestStaleError (409) when sources drifted, were deleted, or
 * left the project.
 */
export async function assertAuditManifestCurrent(manifestId: string): Promise<void> {
  const { error } = await supabase.rpc('assert_audit_source_manifest_current', { p_id: manifestId })
  if (error) throwManifestError(error)
}

export type AuditManifestRow = {
  id: string
  project_id: string
  created_by: string
  request_key: string
  sources: Array<{
    documentId: string
    type: string
    revision: string
    digest: string
  }>
  created_at: string
}

export async function fetchAuditManifest(manifestId: string): Promise<AuditManifestRow | null> {
  const { data, error } = await supabase
    .from('audit_source_manifests')
    .select('id,project_id,created_by,request_key,sources,created_at')
    .eq('id', manifestId)
    .maybeSingle()
  if (error) throwManifestError(error)
  return (data as AuditManifestRow | null) ?? null
}
