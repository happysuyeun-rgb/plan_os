import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useMemberStore } from '../store/memberStore'
import {
  acceptFindingAsTask,
  requestReviewChanges,
  startMockPlanningReview,
} from '../lib/ai/runPlanningReview'
import {
  REVIEW_STORE_MODE,
  defaultReviewStore,
} from '../lib/ai/reviewPipeline'
import type { ReviewJob } from '../lib/ai/reviewJob'
import { MOCK_PLANNING_REVIEWER_ID } from '../lib/ai/MockPlanningReviewProvider'

const DOC_OPTIONS = [
  { type: 'prd', label: 'PRD' },
  { type: 'policy', label: '정책' },
  { type: 'wireframe', label: '화면설계' },
  { type: 'ia', label: 'IA' },
  { type: 'screen_list', label: '화면목록' },
] as const

/**
 * Phase D UI: assign mock planning-review staff, run review, accept→S1 task
 * or request changes, then optional re-review. Not a paid AI path.
 */
export default function ProjectAiReviewPage() {
  const { projectId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const members = useMemberStore((s) => s.members)
  const fetchMembers = useMemberStore((s) => s.fetchMembers)

  const [hired, setHired] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['prd', 'policy', 'wireframe'])
  const [job, setJob] = useState<ReviewJob | null>(null)
  const [reReviewJobId, setReReviewJobId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [changeReason, setChangeReason] = useState('')

  useEffect(() => {
    if (!projectId) return
    void setCurrentProject(projectId)
    void fetchMembers(projectId).catch(() => undefined)
  }, [projectId, setCurrentProject, fetchMembers])

  const membership = members.find((m) => m.project_id === projectId && m.user_id === userId && m.status === 'active')
  const isOwner = Boolean(currentProject && userId && currentProject.user_id === userId)
  const canRun = isOwner || membership?.role === 'owner' || membership?.role === 'editor'

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  const onHire = () => {
    setHired(true)
    setMessage(`Mock 직원 투입: ${MOCK_PLANNING_REVIEWER_ID} (유료 LLM 아님 · 저장=${REVIEW_STORE_MODE})`)
  }

  const onRun = async () => {
    if (!projectId || !canRun) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await startMockPlanningReview(projectId, defaultReviewStore, selectedTypes)
      setJob(result.job)
      setMessage(
        `Mock 검수 완료: 문서 ${result.documentCount}건 → 발견 ${result.findingCount}건 (mode=${result.mode})`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '검수 실행 실패')
    } finally {
      setBusy(false)
    }
  }

  const onAccept = async (findingId: string) => {
    if (!job || !userId || !projectId) return
    setBusy(true)
    setError('')
    try {
      const result = await acceptFindingAsTask(defaultReviewStore, job, {
        findingId,
        userId,
        requestReReview: true,
      })
      setJob(result.job)
      setReReviewJobId(result.reReviewJob?.id ?? null)
      setMessage(
        result.createdTaskId
          ? `수락됨 · S1 업무 생성: ${result.createdTaskId}${result.reReviewJob ? ` · 재검수 job=${result.reReviewJob.id}` : ''}`
          : '수락됨',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '수락 실패')
    } finally {
      setBusy(false)
    }
  }

  const onRequestChanges = async () => {
    if (!job) return
    setBusy(true)
    setError('')
    try {
      const next = await requestReviewChanges(defaultReviewStore, job, changeReason)
      setJob(next)
      setMessage(`수정 요청 처리됨: ${next.errorMessage ?? ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 요청 실패')
    } finally {
      setBusy(false)
    }
  }

  const onReReview = async () => {
    if (!projectId || !canRun) return
    setBusy(true)
    setError('')
    try {
      const result = await startMockPlanningReview(projectId, defaultReviewStore, selectedTypes)
      setJob(result.job)
      setReReviewJobId(null)
      setMessage(`재검수(Mock) 완료 · job=${result.job.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '재검수 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link to={projectId ? `/projects/${projectId}` : '/projects'} className="text-sm text-gray-500 hover:underline">
        ← 프로젝트 문서
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">AI 기획 검수 (Mock)</h1>
        <p className="text-sm text-gray-600">
          사람 PM 계획과 별도입니다. 유료 LLM·운영 DB 영속(027)은 미적용이며, Preview/로컬 Mock만 사용합니다.
        </p>
        <p className="text-xs text-gray-500" data-testid="ai-review-store-mode">
          저장 모드: {REVIEW_STORE_MODE}
        </p>
      </header>

      {!canRun && (
        <p role="alert" className="rounded bg-amber-50 p-3 text-amber-900">
          Owner/Editor만 Mock 검수 직원을 투입·실행할 수 있습니다.
        </p>
      )}

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
        <div className="flex flex-wrap gap-3">
          {DOC_OPTIONS.map((opt) => (
            <label key={opt.type} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedTypes.includes(opt.type)}
                onChange={() => toggleType(opt.type)}
                disabled={!hired || busy}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500">예상 비용: $0 (Mock · 토큰 미사용)</p>
        <button
          type="button"
          disabled={!hired || !canRun || busy || selectedTypes.length === 0}
          onClick={() => void onRun()}
          className="rounded bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-40"
          data-testid="ai-review-run"
        >
          {busy ? '실행 중…' : '검수 실행 (Mock)'}
        </button>
      </section>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-900" data-testid="ai-review-message">{message}</p>}

      {job && (
        <section className="space-y-4" aria-label="검수 결과" data-testid="ai-review-job">
          <h2 className="font-semibold">3. 결과 · job {job.id.slice(0, 8)}… · {job.status}</h2>
          {job.findings.map((f) => (
            <article key={f.id} className="space-y-2 rounded border border-gray-200 p-4 text-sm">
              <p className="font-medium">
                [{f.severity}] {f.summary}
              </p>
              <p className="text-gray-600">
                근거 ({f.citation.documentType}): “{f.citation.quote}”
              </p>
              <p className="text-xs text-gray-500">{f.citation.rationale}</p>
              {job.status === 'awaiting_human' && canRun && (
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
          ))}

          {job.status === 'awaiting_human' && canRun && (
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
              disabled={busy}
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
