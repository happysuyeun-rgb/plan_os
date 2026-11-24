import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  DocumentWriteConflictError,
  fetchDocument,
  saveDocumentContentCas,
} from '../../lib/api/documents'
import { createVersion } from '../../lib/api/versions'
import {
  buildResearchPrdPatchPlan,
  type ResearchPrdPatchPlan,
} from '../../lib/researchPrdPatch'
import { useDocumentStore } from '../../store/documentStore'
import { useVersionStore } from '../../store/versionStore'
import { DOCUMENT_TYPE_PATHS } from '../../types'

const PRE_APPLY_VERSION_NAME = '리서치 반영 전'
const POST_APPLY_VERSION_NAME = '리서치 반영'

type Props = {
  open: boolean
  projectId: string
  reportJson: unknown
  canEdit: boolean
  onClose: () => void
  onApplied?: () => void
}

function normalizeReportJson(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const row = raw as Record<string, unknown>
  if (row.report && typeof row.report === 'object') return row.report
  if (row.result && typeof row.result === 'object') return row.result
  return raw
}

export function ResearchPrdApplyModal({
  open,
  projectId,
  reportJson,
  canEdit,
  onClose,
  onApplied,
}: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<ResearchPrdPatchPlan | null>(null)
  const [prdId, setPrdId] = useState<string | null>(null)
  const [revision, setRevision] = useState<number | null>(null)
  const [previousContent, setPreviousContent] = useState('')
  const reportSnapshotRef = useRef<unknown>(null)
  const fetchDocuments = useDocumentStore((s) => s.fetchDocuments)
  const setActiveDocType = useDocumentStore((s) => s.setActiveDocType)
  const fetchVersions = useVersionStore((s) => s.fetchVersions)
  const fetchSummaries = useVersionStore((s) => s.fetchSummaries)

  useEffect(() => {
    if (!open) {
      reportSnapshotRef.current = null
      return
    }
    // Snapshot once per open so parent poll/re-render does not reset the modal mid-apply.
    if (reportSnapshotRef.current == null) {
      reportSnapshotRef.current = normalizeReportJson(reportJson)
    }
    const snapshot = reportSnapshotRef.current
    let mounted = true
    void (async () => {
      setLoading(true)
      setError('')
      setPlan(null)
      setPrdId(null)
      setRevision(null)
      setPreviousContent('')
      try {
        const doc = await fetchDocument(projectId, 'prd')
        if (!mounted) return
        if (!doc) {
          setError('PRD 문서가 없습니다. 먼저 PRD를 생성해 주세요.')
          return
        }
        const current = doc.content ?? ''
        setPrdId(doc.id)
        setRevision(doc.content_revision)
        setPreviousContent(current)
        const next = buildResearchPrdPatchPlan(current, snapshot)
        setPlan(next)
        if (next.patches.length === 0) {
          setError('리서치에서 PRD에 반영할 내용을 찾지 못했습니다. 보고서 요약을 확인한 뒤 다시 시도해 주세요.')
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'PRD를 불러오지 못했습니다.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [open, projectId])

  if (!open) return null

  const apply = async () => {
    if (!canEdit) {
      setError('PRD를 수정할 권한이 없습니다.')
      return
    }
    if (loading) {
      setError('패치 준비가 끝날 때까지 잠시 기다려 주세요.')
      return
    }
    if (!plan?.patches.length || !prdId || revision == null) {
      setError(error || '적용할 패치가 없습니다.')
      return
    }
    setApplying(true)
    setError('')
    try {
      // Checkpoint current PRD into immutable history before overwrite (same idea as restore).
      await createVersion(prdId, previousContent, PRE_APPLY_VERSION_NAME)
      await saveDocumentContentCas(prdId, revision, plan.nextContent)
      try {
        await createVersion(prdId, plan.nextContent, POST_APPLY_VERSION_NAME)
      } catch {
        // Pre-apply history already stored; post label is best-effort.
      }
      await fetchDocuments(projectId)
      await fetchVersions(prdId).catch(() => undefined)
      await fetchSummaries([prdId]).catch(() => undefined)
      setActiveDocType('prd')
      onApplied?.()
      onClose()
      navigate(`/projects/${projectId}/${DOCUMENT_TYPE_PATHS.prd}`)
    } catch (e) {
      if (e instanceof DocumentWriteConflictError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : 'PRD 반영에 실패했습니다.')
      }
    } finally {
      setApplying(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="research-prd-apply-title"
      data-testid="research-prd-apply-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="research-prd-apply-title" className="text-lg font-bold text-gray-900">
              리서치 → PRD 섹션 반영
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              시장·경쟁·고객·기회 내용을 PRD 해당 섹션에만 패치합니다. 적용 시 현재 PRD는 버전
              히스토리에 남고, 반영본이 새 버전으로 저장됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            닫기
          </button>
        </header>

        <div className="max-h-[min(60vh,32rem)] space-y-4 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="text-sm text-gray-500" data-testid="research-prd-apply-loading">
              PRD와 패치를 준비하는 중…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              data-testid="research-prd-apply-error"
            >
              {error}
            </p>
          )}
          {plan && plan.patches.length > 0 && (
            <ul className="space-y-4">
              {plan.patches.map((patch) => (
                <li
                  key={patch.id}
                  className="rounded-xl border border-gray-200 bg-gray-50/80 p-4"
                  data-testid="research-prd-patch"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        patch.action === 'insert'
                          ? 'bg-teal-100 text-teal-900'
                          : 'bg-amber-100 text-amber-950'
                      }`}
                    >
                      {patch.action === 'insert' ? '새 섹션' : '섹션 교체'}
                    </span>
                    <p className="font-semibold text-gray-900">{patch.sectionTitle}</p>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">기존</p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-600">
                        {patch.beforePreview || '(비어 있음)'}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-teal-800">반영 후</p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-teal-100 bg-white p-2 text-xs text-gray-800">
                        {patch.afterBody.slice(0, 1200)}
                        {patch.afterBody.length > 1200 ? '…' : ''}
                      </pre>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
          <Link
            to={`/projects/${projectId}/${DOCUMENT_TYPE_PATHS.prd}`}
            className="text-sm text-gray-500 hover:underline"
            onClick={onClose}
          >
            PRD 문서로 이동
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!canEdit || applying || loading || !plan?.patches.length}
              onClick={() => void apply()}
              className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="research-prd-apply-confirm"
            >
              {applying ? '적용 중…' : canEdit ? 'PRD에 적용' : '편집 권한 없음'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
