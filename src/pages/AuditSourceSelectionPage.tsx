import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchDocuments } from '../lib/api/documents'
import {
  assertAuditManifestCurrent,
  createAuditManifest,
  fetchAuditManifest,
  isAuditManifestCurrent,
  AuditManifestStaleError,
  AuditManifestAccessError,
} from '../lib/api/auditManifests'
import {
  clearProjectManifest,
  loadProjectManifest,
  storeProjectManifest,
} from '../lib/s2ManifestSession'
import { useDocumentStore } from '../store/documentStore'
import { useProjectStore } from '../store/projectStore'
import { useAuthStore } from '../store/authStore'
import { DOCUMENT_TYPE_LABELS, type Document } from '../types'
import { validateAuditSourceSelection, type AuditSourceCandidate } from '../lib/auditSourceSelection'

const errorLabels = {
  NEED_TWO_SOURCES: '검수할 문서를 2개 이상 선택해야 합니다.',
  DUPLICATE_SOURCE: '같은 문서를 중복 선택할 수 없습니다.',
  CROSS_PROJECT: '다른 프로젝트의 문서는 선택할 수 없습니다.',
  DELETED_SOURCE: '삭제된 문서는 선택할 수 없습니다.',
  UNSAVED_SOURCE: '저장되지 않은 수정사항이 있습니다. 먼저 문서 저장을 완료하세요.',
  MISSING_SNAPSHOT: '문서 버전 또는 내용 해시를 확인할 수 없습니다.',
}

/** Browser preflight only — server digests are authoritative. */
async function digestContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return 'sha256:' + Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

/**
 * F-201/F-202: select project documents, persist a server digest snapshot,
 * re-verify before Mock 검수, and recover via reselect after 409/stale.
 */
export default function AuditSourceSelectionPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const saveStatus = useDocumentStore((s) => s.saveStatus)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [candidates, setCandidates] = useState<AuditSourceCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [checked, setChecked] = useState(false)
  const [manifestId, setManifestId] = useState('')
  const [persisting, setPersisting] = useState(false)
  const [verifyingRun, setVerifyingRun] = useState(false)
  const [needsReselect, setNeedsReselect] = useState(false)
  const requestKey = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    if (!projectId || !userId) return
    void Promise.all([setCurrentProject(projectId), fetchDocuments(projectId)])
      .then(([, docs]) => {
        if (!active) return
        setDocuments(docs)
        const stored = loadProjectManifest(projectId)
        if (stored) {
          setManifestId(stored.manifestId)
          setSelected(stored.documentIds)
          requestKey.current = stored.requestKey
          void fetchAuditManifest(stored.manifestId)
            .then((row) => {
              if (!active || !row) return
              setNotice(`저장된 manifest ${row.id.slice(0, 8)}… · 소스 ${row.sources.length}건 (새로고침 복원)`)
            })
            .catch(() => {
              clearProjectManifest(projectId)
              setManifestId('')
            })
        }
        setLoading(false)
      })
      .catch(() => {
        if (active) {
          setError('프로젝트 문서를 불러오지 못했습니다.')
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [projectId, userId, setCurrentProject])

  const accessible = currentProject?.id === projectId && currentProject?.deleted_at === null

  const resetSelectionState = () => {
    setChecked(false)
    setManifestId('')
    setNeedsReselect(false)
    requestKey.current = null
    setCandidates([])
    setNotice('')
    if (projectId) clearProjectManifest(projectId)
  }

  const toggle = (id: string) => {
    resetSelectionState()
    setSelected((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]))
  }

  const verify = async () => {
    if (!projectId || !accessible) return
    setChecked(false)
    setError('')
    setNotice('')
    try {
      const fresh = await fetchDocuments(projectId)
      const chosen = fresh.filter((doc) => selected.includes(doc.id))
      if (chosen.length !== selected.length) {
        setError('선택한 문서가 변경되었거나 접근할 수 없습니다.')
        return
      }
      const snapshot = await Promise.all(chosen.map(async (doc) => ({
        id: doc.id,
        projectId: doc.project_id,
        type: doc.type,
        revision: doc.updated_at,
        digest: await digestContent(doc.content),
        deleted: false,
        hasUnsavedChanges: saveStatus !== 'saved',
      })))
      const result = validateAuditSourceSelection(projectId, snapshot)
      if (!result.ok) {
        setError(errorLabels[result.reason])
        return
      }
      setDocuments(fresh)
      setCandidates(result.sources)
      setChecked(true)
    } catch {
      setError('문서 검증에 실패했습니다. 다시 시도하세요.')
    }
  }

  const persistManifest = async () => {
    if (!projectId || !checked || persisting) return
    setPersisting(true)
    setError('')
    setNotice('')
    try {
      requestKey.current ??= crypto.randomUUID()
      const id = await createAuditManifest(
        projectId,
        candidates.map((d) => d.id),
        requestKey.current,
      )
      const current = await isAuditManifestCurrent(id)
      if (!current) {
        setError('문서가 변경되었습니다. 다시 검증해 주세요.')
        setChecked(false)
        clearProjectManifest(projectId)
        return
      }
      setManifestId(id)
      storeProjectManifest(projectId, {
        manifestId: id,
        documentIds: candidates.map((d) => d.id),
        requestKey: requestKey.current,
      })
      setNotice('서버 manifest가 저장되었습니다. 검수 실행 직전에 버전·digest를 다시 확인합니다.')
    } catch (e) {
      if (e instanceof AuditManifestAccessError) {
        setError(e.message)
      } else if (e instanceof AuditManifestStaleError) {
        setError(e.message)
        setChecked(false)
      } else {
        setError('서버 문서 스냅샷 저장에 실패했습니다. 소유자 권한과 문서 소속을 확인하세요.')
      }
    } finally {
      setPersisting(false)
    }
  }

  const runWithGate = async () => {
    if (!projectId || !manifestId || verifyingRun) return
    setVerifyingRun(true)
    setError('')
    setNotice('')
    try {
      await assertAuditManifestCurrent(manifestId)
      setNotice('실행 직전 재검증 통과 · Mock 검수 화면으로 이동합니다.')
      navigate(`/projects/${projectId}/ai-review?manifest=${encodeURIComponent(manifestId)}`)
    } catch (e) {
      if (e instanceof AuditManifestStaleError) {
        setError(e.message)
        setChecked(false)
        setNeedsReselect(true)
        // Keep manifestId visible until the user explicitly reselects, so recovery CTA stays on screen.
        clearProjectManifest(projectId)
      } else if (e instanceof AuditManifestAccessError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : '실행 전 재검증에 실패했습니다.')
      }
    } finally {
      setVerifyingRun(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <Link to={projectId ? `/projects/${projectId}/tasks` : '/projects'} className="text-sm text-gray-600 hover:underline">
        ← 업무 관리
      </Link>
      <h1 className="text-2xl font-bold">기획 검수 — 문서 선택</h1>
      <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
        S2 F-201/F-202: 선택 문서는 서버가 내용 해시(digest)를 다시 계산해 고정합니다.
        브라우저 해시는 사전 검증용이며, 검수 실행 직전 서버 재검증을 통과해야 합니다.
        원본 문서는 수정하지 않습니다. Mock 실행만 허용됩니다(유료 LLM 없음).
      </p>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
      {loading ? (
        <p>프로젝트 문서를 불러오는 중입니다.</p>
      ) : !accessible ? (
        <p role="alert">이 프로젝트에 접근할 수 없습니다.</p>
      ) : (
        <>
          <section className="space-y-3" aria-label="검수 문서 선택">
            <h2 className="font-semibold">문서 선택 ({selected.length}개)</h2>
            {documents.length === 0 && <p>저장된 문서가 없습니다.</p>}
            {documents.map((doc) => (
              <label key={doc.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                <input type="checkbox" checked={selected.includes(doc.id)} onChange={() => toggle(doc.id)} />
                <span>
                  <span className="block font-medium">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
                  <span className="block text-sm text-gray-600">
                    최종 수정: {new Date(doc.updated_at).toLocaleString('ko-KR')}
                  </span>
                  <span className="block text-xs text-gray-500">문서 ID: {doc.id}</span>
                </span>
              </label>
            ))}
            {saveStatus !== 'saved' && (
              <p role="alert" className="text-sm text-amber-700">현재 문서에 저장 대기 또는 실패 상태가 있습니다.</p>
            )}
            <button
              type="button"
              onClick={() => { void verify() }}
              disabled={selected.length < 2}
              className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40"
            >
              선택한 문서 사전 검증
            </button>
          </section>

          {checked && (
            <section className="space-y-2 rounded-lg border p-4" aria-label="사전 검증 결과">
              <h2 className="font-semibold">사전 검증 통과 · 서버 고정</h2>
              {candidates.map((doc) => (
                <div key={doc.id} className="break-all border-t py-2 text-xs">
                  <p>문서 ID: {doc.id}</p>
                  <p>수정 시각: {doc.revision}</p>
                  <p>브라우저 사전 SHA-256: {doc.digest}</p>
                </div>
              ))}
              <p className="text-sm text-gray-600">
                다음: 서버가 문서 소속·버전·내용 digest를 재계산해 불변 manifest를 저장합니다.
              </p>
              <button
                type="button"
                disabled={persisting || !!manifestId}
                onClick={() => { void persistManifest() }}
                className="rounded bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                서버 manifest 저장
              </button>
            </section>
          )}

          {(manifestId || needsReselect) && (
            <section
              className={`space-y-3 rounded-lg border p-4 ${needsReselect ? 'border-amber-300 bg-amber-50/50' : 'border-green-200 bg-green-50/40'}`}
              aria-label="저장된 manifest"
            >
              <h2 className="font-semibold">
                {needsReselect ? '문서가 변경됨 — manifest 갱신 필요' : '서버 manifest 준비됨'}
              </h2>
              {manifestId && <p className="break-all text-sm">스냅샷 ID: {manifestId}</p>}
              <p className="text-sm text-gray-700">
                {needsReselect
                  ? '문서를 다시 선택하고 서버 manifest를 새로 저장한 뒤 실행하세요.'
                  : '검수 실행 버튼은 서버에서 digest를 다시 확인합니다. 문서가 바뀌었다면 409로 차단되며 문서를 다시 선택·갱신해야 합니다.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {!needsReselect && (
                  <button
                    type="button"
                    disabled={verifyingRun}
                    onClick={() => { void runWithGate() }}
                    className="rounded bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    실행 직전 재검증 후 Mock 검수
                  </button>
                )}
                <button
                  type="button"
                  className="rounded border px-4 py-2 text-sm"
                  onClick={() => {
                    resetSelectionState()
                    setSelected([])
                  }}
                >
                  문서 다시 선택
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
