import type { AuditSourceCandidate } from './auditSourceSelection'

export type AuditManifest = {
  id: string
  projectId: string
  createdAt: string
  sources: AuditSourceCandidate[]
}

/** Client preflight must never be treated as a persisted server snapshot. */
export function detectStaleSources(
  manifest: Pick<AuditManifest, 'projectId' | 'sources'>,
  current: AuditSourceCandidate[],
): string[] {
  const byId = new Map(current.map((doc) => [doc.id, doc]))
  return manifest.sources.filter((source) => {
    const latest = byId.get(source.id)
    return !latest || latest.projectId !== manifest.projectId || latest.deleted ||
      latest.hasUnsavedChanges || latest.revision !== source.revision || latest.digest !== source.digest
  }).map((source) => source.id)
}
