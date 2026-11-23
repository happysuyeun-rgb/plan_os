import { fetchDocuments } from './api/documents'
import {
  createAuditManifest,
  fetchAuditManifest,
  isAuditManifestCurrent,
} from './api/auditManifests'
import { supabase } from './supabase'
import {
  loadProjectManifest,
  storeProjectManifest,
  type StoredS2Manifest,
} from './s2ManifestSession'
import type { DocumentType } from '../types'

/** Prefer product docs that already exist on typical PlanOS projects. */
const PREFERRED_TYPES: DocumentType[] = [
  'prd',
  'ia',
  'policy',
  'wireframe',
  'screen_list',
  'cursor_prompt',
]

function newRequestKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0')
}

function pickTwoDocumentIds(docs: { id: string; type: string }[]): string[] | null {
  if (docs.length < 2) return null
  const byType = new Map(docs.map((d) => [d.type, d.id]))
  const picked: string[] = []
  for (const t of PREFERRED_TYPES) {
    const id = byType.get(t)
    if (id && !picked.includes(id)) picked.push(id)
    if (picked.length >= 2) return picked
  }
  for (const d of docs) {
    if (!picked.includes(d.id)) picked.push(d.id)
    if (picked.length >= 2) return picked
  }
  return picked.length >= 2 ? picked.slice(0, 2) : null
}

async function latestCurrentManifestId(projectId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('audit_source_manifests')
    .select('id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(8)
  if (error || !data?.length) return null
  for (const row of data) {
    try {
      if (await isAuditManifestCurrent(row.id)) return row.id
    } catch {
      /* try next */
    }
  }
  return null
}

/**
 * Market research contracts still require a current S2 audit_manifest_id (DB).
 * Users should not have to re-open 기획 검수 — reuse session/server snapshot,
 * or auto-create from any two project documents.
 */
export async function ensureResearchAuditManifest(projectId: string): Promise<StoredS2Manifest> {
  const stored = loadProjectManifest(projectId)
  if (stored?.manifestId) {
    try {
      if (await isAuditManifestCurrent(stored.manifestId)) return stored
    } catch {
      /* fall through */
    }
  }

  const latestId = await latestCurrentManifestId(projectId)
  if (latestId) {
    const row = await fetchAuditManifest(latestId)
    const documentIds = (row?.sources ?? []).map((s) => s.documentId).filter(Boolean)
    const value = {
      manifestId: latestId,
      documentIds,
      requestKey: row?.request_key ?? newRequestKey(),
    }
    storeProjectManifest(projectId, value)
    return { ...value, savedAt: new Date().toISOString() }
  }

  const docs = await fetchDocuments(projectId)
  const ids = pickTwoDocumentIds(docs)
  if (!ids) {
    throw new Error(
      '프로젝트에 문서가 2개 미만입니다. 문서를 생성한 뒤 다시 시도하세요.',
    )
  }
  const requestKey = newRequestKey()
  const manifestId = await createAuditManifest(projectId, ids, requestKey)
  const value = { manifestId, documentIds: ids, requestKey }
  storeProjectManifest(projectId, value)
  return { ...value, savedAt: new Date().toISOString() }
}
