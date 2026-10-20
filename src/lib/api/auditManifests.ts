import { supabase } from '../supabase'

/** Draft server contract. Use only with isolated development database migrated to 012. */
export async function createAuditManifest(projectId: string, documentIds: string[]): Promise<string> {
  if (documentIds.length < 2 || documentIds.length > 20 || new Set(documentIds).size !== documentIds.length) {
    throw new Error('검수할 문서를 중복 없이 2~20개 선택하세요.')
  }
  const { data, error } = await supabase.rpc('create_audit_source_manifest', {
    p_project_id: projectId, p_document_ids: documentIds,
  })
  if (error) throw error
  if (typeof data !== 'string') throw new Error('문서 스냅샷 생성 결과가 올바르지 않습니다.')
  return data
}

export async function isAuditManifestCurrent(manifestId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_audit_source_manifest_current', { p_id: manifestId })
  if (error) throw error
  return data === true
}
