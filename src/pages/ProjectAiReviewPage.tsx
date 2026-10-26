import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { DualEntryLaneNotice } from '../components/common/DualEntryLaneNotice'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useMemberStore } from '../store/memberStore'
import { resolveMemberRole } from '../lib/permissions'
import { canAiReview } from '../lib/ai/reviewAccess'
import {
  acceptFindingAsTask,
  loadLatestProjectReviewJob,
  requestReviewChanges,
  startMockPlanningReview,
} from '../lib/ai/runPlanningReview'
import {
  REVIEW_STORE_MODE,
  defaultReviewStore,
} from '../lib/ai/reviewPipeline'
import type { ReviewJob } from '../lib/ai/reviewJob'
import {
  MIN_REVIEW_DOCUMENTS,
  MOCK_PLANNING_REVIEWER_ID,
} from '../lib/ai/MockPlanningReviewProvider'
import {
  consumeSpecialistReviewHandoff,
  type SpecialistReviewHandoff,
} from '../lib/specialistReviewHandoff'
import { AuditManifestStaleError } from '../lib/api/auditManifests'
import { loadProjectManifest } from '../lib/s2ManifestSession'

const DOC_OPTIONS = [
  { type: 'prd', label: 'PRD' },
  { type: 'policy', label: '정책' },
  { type: 'wireframe', label: '화면설계' },
  { type: 'ia', label: 'IA' },
  { type: 'screen_list', label: '화면목록' },
] as const

/**
 * Phase D UI: Mock planning-review staff. Vite BFF ≠ Preview api/ai/generate.
 * Jobs persist in browser-local store by default (not ops DB / 027).
 * Unpaid preview only — no contract/payment UI, no paid LLM.
 */
export default function ProjectAiReviewPage() {
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const userId = user?.id
  const { currentProject, setCurrentProject } = useProjectStore()
  const members = useMemberStore((s) => s.members)
  const fetchMembers = useMemberStore((s) => s.fetchMembers)

  const [hired, setHired] = useState(false)
  const [handoff, setHandoff] = useState<SpecialistReviewHandoff | null>(null)
  const [handoffTrackId, setHandoffTrackId] = useState<string | undefined>(undefined)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['prd', 'policy', 'wireframe'])
  const [job, setJob] = useState<ReviewJob | null>(null)
  const [reReviewJobId, setReReviewJobId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [auditManifestId, setAuditManifestId] = useState<string | null>(null)

  if (projectId !== handoffTrackId) {
    setHandoffTrackId(projectId)
    if (projectId) {
      const incoming = consumeSpecialistReviewHandoff(projectId)
      setHandoff(incoming)
      if (incoming) {
        setHired(true)
        setMessage('S3 채용 Mock에서 이어짐 · 세션 핸드오프(계약·과금·유료 LLM 아님)')
      }
    } else {
      setHandoff(null)
    }
  }

  const role = resolveMemberRole(
    currentProject,
    members,
    user ? { id: user.id, email: user.email ?? '' } : null,
  )
  const canView = canAiReview(role, 'view')
  const canRun = canAiReview(role, 'run')
  const canAccept = canAiReview(role, 'accept')
  const selectionInsufficient = selectedTypes.length < MIN_REVIEW_DOCUMENTS
  const canExecuteRun = hired && canRun && !busy && !selectionInsufficient

  useEffect(() => {
    if (!projectId) return
    void setCurrentProject(projectId)
    void fetchMembers(projectId).catch(() => undefined)
    const fromQuery = searchParams.get('manifest')
    const fromSession = loadProjectManifest(projectId)?.manifestId ?? null
    const resolved = fromQuery || fromSession
    setAuditManifestId(resolved)
    if (fromQuery) {
      setHired(true)
      setMessage(`S2 manifest ${fromQuery.slice(0, 8)}… 연결 · 실행 직전 서버 digest 재검증`)
    }
  }, [projectId, setCurrentProject, fetchMembers, searchParams])

  useEffect(() => {
    if (!projectId || !canView) return
    let cancelled = false
    void loadLatestProjectReviewJob(projectId, defaultReviewStore).then((latest) => {
      if (cancelled || !latest) return
      setJob(latest)
      setHired(true)
      setMessage((prev) =>
        prev.includes('S3 채용 Mock')
          ? prev
          : `재접속: 저장된 검수 job ${latest.id.slice(0, 8)}… (${REVIEW_STORE_MODE})`,
      )
    })
    return () => {
      cancelled = true
    }
  }, [projectId, canView])

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  const onHire = () => {
    setHired(true)
    setMessage(`Mock 직원 투입: ${MOCK_PLANNING_REVIEWER_ID} (유료 LLM 아님 · 저장=${REVIEW_STORE_MODE})`)
  }

  const activeBrief = job?.staffBrief ?? (handoff
    ? {
        roleId: handoff.roleId,
        task: handoff.task,
        acceptanceCriteria: handoff.acceptanceCriteria,
        mockOnly: true as const,
      }
    : null)

  const onRun = async () => {
    if (!projectId || !canRun || selectionInsufficient) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await startMockPlanningReview(projectId, defaultReviewStore, {
        documentTypes: selectedTypes,
        role,
        staffBrief: activeBrief,
        auditManifestId,
      })
      setJob(result.job)
      const insuff = result.job.insufficientInput
        ? ' · 입력 부족(insufficient_input) — 품질 보증 아님'
        : ''
      const gated = auditManifestId ? ' · S2 digest 재검증 PASS' : ''
      setMessage(
        `Mock 검수 완료: 문서 ${result.documentCount}건 → 발견 ${result.findingCount}건 (mode=${result.mode} · 유료 LLM 없음)${insuff}${gated}`,
      )
    } catch (e) {
      if (e instanceof AuditManifestStaleError) {
        setError(`${e.message} (HTTP ${e.status})`)
      } else {
        setError(e instanceof Error ? e.message : '검수 실행 실패')
      }
    } finally {
      setBusy(false)
    }
  }

  const onAccept = async (findingId: string) => {
    if (!job || !userId || !projectId || !canAccept) return
    if (job.insufficientInput) {
      setError('입력 부족 검수 결과는 업무로 수락할 수 없습니다. 문서를 추가한 뒤 다시 실행하세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await acceptFindingAsTask(defaultReviewStore, job, {
        findingId,
        userId,
        requestReReview: true,
        role,
        expectedVersion: job.version,
      })
      setJob(result.job)
      setReReviewJobId(result.reReviewJob?.id ?? null)
      setMessage(
        result.reusedExistingTask
          ? `중복 방지: 기존 업무 ${result.createdTaskId} 재사용`
          : result.createdTaskId
            ? `수락됨 · S1 업무 생성: ${result.createdTaskId}${result.reReviewJob ? ` · 재검수 job=${result.reReviewJob.id}` : ''}`
            : '수락됨',
      )
    } catch (e) {
      const detail =
        e instanceof Error
          ? e.message
          : e && typeof e === 'object' && 'message' in e
            ? String((e as { message: unknown }).message)
            : '수락 실패'
      setError(detail || '수락 실패')
    } finally {
      setBusy(false)
    }
  }

  const onRequestChanges = async () => {
    if (!job || !canAccept) return
    setBusy(true)
    setError('')
    try {
      const next = await requestReviewChanges(defaultReviewStore, job, changeReason, role)
      setJob(next)
      setMessage(`수정 요청 처리됨: ${next.errorMessage ?? ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 요청 실패')
    } finally {
      setBusy(false)
    }
  }

  const onReReview = async () => {
    if (!projectId || !canRun || selectionInsufficient) return
    setBusy(true)
    setError('')
    try {
      const result = await startMockPlanningReview(projectId, defaultReviewStore, {
        documentTypes: selectedTypes,
        role,
        staffBrief: activeBrief,
        auditManifestId,
      })
      setJob(result.job)
      setReReviewJobId(null)
      setMessage(`재검수(Mock) 완료 · job=${result.job.id} · 유료 LLM 없음`)
    } catch (e) {
      if (e instanceof AuditManifestStaleError) {
        setError(`${e.message} (HTTP ${e.status})`)
      } else {
        setError(e instanceof Error ? e.message : '재검수 실패')
      }
    } finally {
      setBusy(false)
    }
  }

  const showAccept =
    canAccept &&
    !job?.insufficientInput &&
    (job?.status === 'awaiting_human' || job?.status === 'accepted')

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link to={projectId ? `/projects/${projectId}` : '/projects'} className="text-sm text-gray-500 hover:underline">
        ← 프로젝트 문서
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">AI 기획 검수 (Mock)</h1>
        <p className="text-sm text-gray-600">
          사람 PM 계획과 별도입니다. 브라우저 로컬 저장({REVIEW_STORE_MODE}) · 027/운영 DB·유료 LLM 미적용.
          생성 API는 Vite 개발 미들웨어와 Preview <code className="text-xs">/api/ai/generate</code> 가 분리됩니다.
        </p>
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
          data-testid="ai-review-unpaid-preview"
        >
          무과금 미리보기 · 예상 비용 $0 · 유료 LLM·계약·결제 UI 없음 (Mock 휴리스틱만)
        </p>
        <p className="text-xs text-gray-500" data-testid="ai-review-store-mode">
          저장 모드: {REVIEW_STORE_MODE} · 역할: {role ?? 'none'}
        </p>
      </header>

      <DualEntryLaneNotice projectId={projectId} lane="ai-review" />

      {projectId && (
        <p className="text-sm text-gray-600">
          S2 문서 digest 고정이 필요하면{' '}
          <Link className="text-indigo-700 underline" to={`/projects/${projectId}/audits/new`}>
            검수 문서 선택
          </Link>
          에서 manifest를 저장하세요.
          {auditManifestId ? (
            <span className="ml-2 text-xs text-green-800">연결됨: {auditManifestId.slice(0, 8)}…</span>
          ) : null}
        </p>
      )}

      {!canView && (
        <p role="alert" className="rounded bg-amber-50 p-3 text-amber-900">
          이 프로젝트의 AI 검수 결과를 볼 권한이 없습니다.
        </p>
      )}

      {canView && !canRun && (
        <p role="alert" className="rounded bg-amber-50 p-3 text-amber-900" data-testid="ai-review-viewer-readonly">
          Viewer는 검수 결과 조회만 가능합니다. 실행·수락·업무 생성은 Owner/Editor만 가능합니다.
        </p>
      )}

      {canView && activeBrief && (
        <section
          role="status"
          aria-label="S3 채용 핸드오프"
          className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950"
          data-testid="ai-review-specialist-handoff"
        >
          <h2 className="font-semibold">
            {job?.staffBrief ? '검수 job에 저장된 채용 brief (Mock)' : '채용 요청 Mock에서 이어짐'}
          </h2>
          <p className="mt-1 text-xs">역할 {activeBrief.roleId} · 세션/로컬 스냅샷 · 계약/결제/실행 아님</p>
          <p className="mt-3 whitespace-pre-wrap"><span className="font-medium">요청 업무:</span> {activeBrief.task}</p>
          <p className="mt-2 whitespace-pre-wrap"><span className="font-medium">완료 기준:</span> {activeBrief.acceptanceCriteria}</p>
        </section>
      )}

      {canView && (
        <>
          <section className="space-y-3 rounded-xl border border-gray-200 p-5" aria-label="직원 투입">
            <h2 className="font-semibold">1. 직원 투입</h2>
            <p className="text-sm text-gray-700">역할: 기획 문서 누락·충돌 휴리스틱 검수</p>
            <button
              type="button"
              disabled={!canRun || hired || busy}
              onClick={onHire}
              className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              data-testid="ai-review-hire"
            >
              {hired ? '투입됨 (Mock)' : 'Mock 기획 검수 직원 투입'}
            </button>
          </section>

          <section className="space-y-3 rounded-xl border border-gray-200 p-5" aria-label="범위">
            <h2 className="font-semibold">2. 검수 문서 범위</h2>
            <p className="text-sm text-gray-600">
              AC-01: 최소 {MIN_REVIEW_DOCUMENTS}개 문서 유형을 선택하세요. (현재 {selectedTypes.length}개)
            </p>
            <div className="flex flex-wrap gap-3">
              {DOC_OPTIONS.map((opt) => (
                <label key={opt.type} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(opt.type)}
                    onChange={() => toggleType(opt.type)}
                    disabled={!hired || busy || !canRun}
                    data-testid={`ai-review-doc-${opt.type}`}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {selectionInsufficient && hired && canRun && (
              <p
                role="alert"
                className="rounded bg-amber-50 p-2 text-sm text-amber-900"
                data-testid="ai-review-insufficient-block"
              >
                입력 부족: 문서 유형을 {MIN_REVIEW_DOCUMENTS}개 이상 선택해야 검수를 실행할 수 있습니다.
              </p>
            )}
            <p className="text-xs text-gray-500">예상 비용: $0 (Mock · 토큰 미사용 · 유료 LLM 없음)</p>
            {activeBrief && (
              <p className="text-xs text-indigo-800" data-testid="ai-review-brief-run-hint">
                요청 업무 기준 Mock 검수 · 유료 LLM 아님 · 계약/결제 아님
              </p>
            )}
            <button
              type="button"
              disabled={!canExecuteRun}
              onClick={() => void onRun()}
              className="rounded bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-40"
              data-testid="ai-review-run"
            >
              {busy ? '실행 중…' : '검수 실행 (Mock · 무과금)'}
            </button>
          </section>
        </>
      )}

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-900" data-testid="ai-review-message">{message}</p>}

      {canView && job && (
        <section className="space-y-4" aria-label="검수 결과" data-testid="ai-review-job">
          <h2 className="font-semibold">
            3. 결과 · job {job.id.slice(0, 8)}… · {job.status}
            {job.version != null ? ` · v${job.version}` : ''}
          </h2>
          {job.insufficientInput && (
            <p
              role="alert"
              className="rounded bg-amber-50 p-3 text-sm text-amber-900"
              data-testid="ai-review-insufficient-input"
            >
              insufficient_input: 입력 문서가 부족해 전체 품질을 주장하지 않습니다. 문서를 보강한 뒤 재실행하세요.
            </p>
          )}
          {job.sourceManifest && job.sourceManifest.length > 0 && (
            <p className="text-xs text-gray-600" data-testid="ai-review-source-manifest">
              source_manifest:{' '}
              {job.sourceManifest
                .map(
                  (m) =>
                    `${m.documentType}${m.revisionOrVersion != null ? `@${m.revisionOrVersion}` : ''}`,
                )
                .join(', ')}
            </p>
          )}
          {job.findings.map((f) => {
            const linked = job.acceptedFindingTaskIds?.[f.id]
            return (
              <article key={f.id} className="space-y-2 rounded border border-gray-200 p-4 text-sm">
                <p className="font-medium">
                  [{f.severity}/{f.category}] {f.summary}
                </p>
                <p className="text-xs text-gray-500" data-testid={`ai-review-finding-state-${f.id}`}>
                  reviewer_state: {f.reviewerState}
                </p>
                <p className="text-gray-600">
                  근거 ({f.citation.documentType}
                  {f.citation.versionNumber != null ? ` rev=${f.citation.versionNumber}` : ''}
                  {f.citation.startOffset != null
                    ? ` @${f.citation.startOffset}-${f.citation.endOffset}`
                    : ''}
                  ): “{f.citation.quote}”
                </p>
                <p className="text-xs text-gray-500">{f.citation.rationale}</p>
                {linked && (
                  <p className="text-xs text-green-700">업무 연결됨: {linked}</p>
                )}
                {showAccept && !linked && job.status === 'awaiting_human' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onAccept(f.id)}
                    className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                    data-testid={`ai-review-accept-${f.id}`}
                  >
                    수락 → S1 업무 생성
                  </button>
                )}
              </article>
            )
          })}

          {job.status === 'awaiting_human' && canAccept && (
            <div className="space-y-2 rounded border border-dashed border-gray-300 p-4">
              <h3 className="text-sm font-medium">수정 요청</h3>
              <textarea
                className="w-full rounded border border-gray-300 p-2 text-sm"
                rows={2}
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="수정이 필요한 이유"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRequestChanges()}
                className="rounded bg-amber-700 px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                수정 요청 (reject)
              </button>
            </div>
          )}

          {(job.status === 'accepted' || reReviewJobId) && canRun && (
            <button
              type="button"
              disabled={busy || selectionInsufficient}
              onClick={() => void onReReview()}
              className="rounded bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-40"
              data-testid="ai-review-rereview"
            >
              재검수 실행 (Mock)
            </button>
          )}

          {job.linkedTaskId && projectId && (
            <p className="text-sm">
              연결된 업무:{' '}
              <Link className="text-indigo-700 underline" to={`/projects/${projectId}/tasks/${job.linkedTaskId}`}>
                {job.linkedTaskId}
              </Link>
            </p>
          )}
        </section>
      )}
    </main>
  )
}
