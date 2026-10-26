/** Browser handoff of a server-backed S2 manifest id (not an authority). */

export type StoredS2Manifest = {
  manifestId: string
  documentIds: string[]
  requestKey: string
  savedAt: string
}

const keyFor = (projectId: string) => `planos.s2.manifest.${projectId}`

export function storeProjectManifest(
  projectId: string,
  value: Omit<StoredS2Manifest, 'savedAt'> & { savedAt?: string },
): void {
  const payload: StoredS2Manifest = {
    manifestId: value.manifestId,
    documentIds: value.documentIds,
    requestKey: value.requestKey,
    savedAt: value.savedAt ?? new Date().toISOString(),
  }
  try {
    localStorage.setItem(keyFor(projectId), JSON.stringify(payload))
  } catch {
    // Quota / private mode — execution can still use in-memory id.
  }
}

export function loadProjectManifest(projectId: string): StoredS2Manifest | null {
  try {
    const raw = localStorage.getItem(keyFor(projectId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredS2Manifest
    if (!parsed?.manifestId || !Array.isArray(parsed.documentIds)) return null
    return parsed
  } catch {
    return null
  }
}

export function clearProjectManifest(projectId: string): void {
  try {
    localStorage.removeItem(keyFor(projectId))
  } catch {
    // ignore
  }
}
