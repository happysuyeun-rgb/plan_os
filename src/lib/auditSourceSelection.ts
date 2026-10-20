/** S2: local preflight only. Server must independently verify tenant, revision and digest. */
export interface AuditSourceCandidate {
  id: string
  projectId: string
  type: string
  revision: string
  digest: string
  deleted: boolean
  hasUnsavedChanges: boolean
}
export type SourceSelectionResult =
  | { ok: true; sources: AuditSourceCandidate[] }
  | { ok: false; reason: 'NEED_TWO_SOURCES' | 'DUPLICATE_SOURCE' | 'CROSS_PROJECT' | 'DELETED_SOURCE' | 'UNSAVED_SOURCE' | 'MISSING_SNAPSHOT' }

export function validateAuditSourceSelection(
  projectId: string, candidates: AuditSourceCandidate[],
): SourceSelectionResult {
  if (candidates.length < 2) return { ok: false, reason: 'NEED_TWO_SOURCES' }
  if (new Set(candidates.map((v) => v.id)).size !== candidates.length) return { ok: false, reason: 'DUPLICATE_SOURCE' }
  if (candidates.some((v) => v.projectId !== projectId)) return { ok: false, reason: 'CROSS_PROJECT' }
  if (candidates.some((v) => v.deleted)) return { ok: false, reason: 'DELETED_SOURCE' }
  if (candidates.some((v) => v.hasUnsavedChanges)) return { ok: false, reason: 'UNSAVED_SOURCE' }
  if (candidates.some((v) => !v.revision.trim() || !/^sha256:[a-f0-9]{64}$/.test(v.digest))) {
    return { ok: false, reason: 'MISSING_SNAPSHOT' }
  }
  return { ok: true, sources: candidates.map((v) => ({ ...v })) }
}
