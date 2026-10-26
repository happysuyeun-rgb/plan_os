import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useMemberStore } from '../store/memberStore'
import { validateHumanPlan, type PlanStep } from '../lib/humanPmPlanDraft'
import {
  fetchPmPlan, linkPmPlanStepToTask, listPmPlanEvents, listPlanStepTasks,
  savePmPlanDraft, transitionPmPlan, PmPlanConflictError,
  type LinkedPlanTask, type PmPlan, type PmPlanEvent, type PmPlanStep,
} from '../lib/api/pmPlans'
import { PM_PLAN_STATUS_LABELS } from '../lib/pmPlanLabels'

const EVENT_LABELS: Record<PmPlanEvent['event_type'], string> = {
  draft_saved: '초안 저장',
  approval_requested: '승인 요청',
  approved: '승인',
  rejected: '반려',
  needs_revision: '수정 요청',
  step_task_linked: '업무 연결',
}

const EDITABLE: PmPlan['status'][] = ['draft', 'rejected', 'needs_revision']

/**
 * F-402 / N09·N12 / TF-14~16: plan detail with the owner review loop and
 * the S1 task link. Approval is only a recorded decision - it never
 * queues AI execution or billing. Task creation per step is idempotent.
 */
export default function PmPlanDetailPage() {
  const { projectId, planId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const members = useMemberStore((s) => s.members)
  const fetchMembers = useMemberStore((s) => s.fetchMembers)

  const [plan, setPlan] = useState<PmPlan | null>(null)
  const [steps, setSteps] = useState<PmPlanStep[]>([])
  const [events, setEvents] = useState<PmPlanEvent[]>([])
  const [linkedTasks, setLinkedTasks] = useState<LinkedPlanTask[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const [objective, setObjective] = useState('')
  const [editSteps, setEditSteps] = useState<PlanStep[]>([])
  const [comment, setComment] = useState('')

  const load = async () => {
    if (!planId || !projectId) return
    const found = await fetchPmPlan(planId)
    if (!found || found.plan.project_id !== projectId) {
      setPlan(null)
      setReady(true)
      return
    }
    setPlan(found.plan)
    setSteps(found.steps)
    setObjective(found.plan.objective)
    setEditSteps(found.steps.map((s) => ({
      id: s.id,
      title: s.title,
      acceptanceCriteria: s.acceptance_criteria,
      dependsOn: found.steps.find((candidate) => candidate.id === s.depends_on_step_id)?.id ?? null,
    })))
    setEvents(await listPmPlanEvents(planId))
    setLinkedTasks(await listPlanStepTasks(projectId))
    setReady(true)
  }

  useEffect(() => {
    let mounted = true
    if (!projectId || !planId || !userId) return
    void (async () => {
      try {
        await setCurrentProject(projectId)
        await fetchMembers(projectId)
        if (mounted) await load()
      } catch {
        if (mounted) setError('계획을 불러올 수 없습니다.')
      }
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, planId, userId])

  const activeProject = currentProject?.id === projectId && !currentProject?.deleted_at
  const membership = members.find(
    (m) => m.project_id === projectId && m.user_id === userId && m.status === 'active',
  )
  const isOwner = !!activeProject && currentProject?.user_id === userId
  const canEdit = !!activeProject && (
    isOwner || membership?.role === 'owner' || membership?.role === 'editor'
  )
  const editable = !!plan && EDITABLE.includes(plan.status) && canEdit

  const run = async (work: () => Promise<void>, success: string) => {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
      await load()
      setNotice(success)
    } catch (e) {
      if (e instanceof PmPlanConflictError) {
        setError(e.message)
        await load().catch(() => {})
      } else {
        setError(e instanceof Error ? e.message : '요청 처리에 실패했습니다.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleSaveDraft = () => {
    if (!plan) return
    const validation = validateHumanPlan({ projectId: projectId ?? '', objective, status: 'draft', steps: editSteps })
    if (validation) {
      setError(validation)
      return
    }
    void run(async () => {
      const saved = await savePmPlanDraft(plan, objective, editSteps)
      setPlan(saved)
    }, '초안이 서버에 저장되었습니다.')
  }

  const changeEditStep = (id: string, patch: Partial<PlanStep>) => {
    setEditSteps((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const linkedFor = (stepId: string) => linkedTasks.find((t) => t.source_plan_step_id === stepId)

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link className="text-sm text-indigo-700 underline" to={projectId ? `/projects/${projectId}/plans` : '/projects'}>← PM 계획 목록</Link>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
      {!ready && !error && <p role="status">계획을 불러오는 중...</p>}
      {ready && !plan && <p role="alert" className="rounded bg-amber-50 p-3 text-amber-800">계획을 찾을 수 없거나 접근 권한이 없습니다.</p>}

      {plan && (
        <>
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800">
                {plan.source === 'human' ? '사람이 작성한 계획' : 'AI가 제안한 계획'}
              </span>
              <span
                role="status"
                aria-label={`계획 상태 ${PM_PLAN_STATUS_LABELS[plan.status]}`}
                className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium"
              >
                상태: {PM_PLAN_STATUS_LABELS[plan.status]}
              </span>
              <span className="text-xs text-gray-500" aria-label={`계획 버전 ${plan.version}`}>버전 {plan.version}</span>
            </div>
            {plan.status === 'approved' && (
              <p className="text-sm text-gray-600">승인은 계획 승인을 기록한 것입니다. AI 실행이나 결제가 시작되지 않았습니다.</p>
            )}
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">업무 목표</h2>
            {editable ? (
              <textarea
                aria-label="업무 목표"
                value={objective}
                maxLength={1000}
                rows={4}
                onChange={(e) => setObjective(e.target.value)}
                className="block w-full rounded border p-3"
              />
            ) : (
              <p className="whitespace-pre-wrap rounded border bg-gray-50 p-3">{plan.objective}</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">업무 단계</h2>
            {editable ? (
              <>
                {editSteps.map((step, index) => (
                  <article key={step.id} className="space-y-2 rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">단계 {index + 1}</h3>
                      <button
                        type="button"
                        disabled={editSteps.length === 1}
                        className="text-sm text-red-700 disabled:opacity-40"
                        onClick={() => setEditSteps((v) => v.filter((s) => s.id !== step.id).map((s) => (s.dependsOn === step.id ? { ...s, dependsOn: null } : s)))}
                      >
                        단계 삭제
                      </button>
                    </div>
                    <input
                      aria-label={`단계 ${index + 1} 제목`}
                      value={step.title}
                      maxLength={120}
                      onChange={(e) => changeEditStep(step.id, { title: e.target.value })}
                      className="block w-full rounded border p-2"
                    />
                    <textarea
                      aria-label={`단계 ${index + 1} 완료 기준`}
                      value={step.acceptanceCriteria}
                      maxLength={500}
                      rows={2}
                      onChange={(e) => changeEditStep(step.id, { acceptanceCriteria: e.target.value })}
                      className="block w-full rounded border p-2"
                    />
                    <select
                      aria-label={`단계 ${index + 1} 선행 단계`}
                      value={step.dependsOn ?? ''}
                      onChange={(e) => changeEditStep(step.id, { dependsOn: e.target.value || null })}
                      className="block w-full rounded border p-2"
                    >
                      <option value="">선행 단계 없음</option>
                      {editSteps.slice(0, index).map((s, i) => (
                        <option key={s.id} value={s.id}>단계 {i + 1} · {s.title || '제목 미입력'}</option>
                      ))}
                    </select>
                  </article>
                ))}
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="rounded border px-3 py-2"
                    disabled={editSteps.length >= 20}
                    onClick={() => setEditSteps((v) => [...v, { id: crypto.randomUUID(), title: '', acceptanceCriteria: '', dependsOn: null }])}
                  >
                    + 단계 추가
                  </button>
                  <button
                    type="button"
                    className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    disabled={busy}
                    onClick={handleSaveDraft}
                  >
                    초안 저장
                  </button>
                </div>
              </>
            ) : (
              <ol className="list-decimal space-y-3 pl-5">
                {steps.map((step) => {
                  const linked = plan.status === 'approved' ? linkedFor(step.id) : undefined
                  const depends = steps.find((s) => s.id === step.depends_on_step_id)
                  return (
                    <li key={step.id} className="rounded-xl border p-4">
                      <div className="font-semibold">{step.title}</div>
                      <p className="mt-1 text-sm">완료 기준: {step.acceptance_criteria}</p>
                      <p className="text-xs text-gray-500">
                        선행 단계: {depends ? depends.title : '없음'} · 계획 단계 ID: {step.id}
                      </p>
                      {plan.status === 'approved' && (
                        linked ? (
                          <p className="mt-2 text-sm text-green-700">
                            업무 보드에 연결됨: <Link className="underline" to={`/projects/${plan.project_id}/tasks`}>{linked.title}</Link> (업무 ID {linked.id})
                          </p>
                        ) : canEdit ? (
                          <button
                            type="button"
                            className="mt-2 rounded border px-3 py-1.5 text-sm"
                            disabled={busy}
                            onClick={() => void run(async () => {
                              await linkPmPlanStepToTask(step.id)
                            }, '업무 보드에 업무를 생성했습니다.')}
                          >
                            이 단계를 업무로 생성
                          </button>
                        ) : (
                          <p className="mt-2 text-sm text-gray-500">아직 업무로 연결되지 않았습니다.</p>
                        )
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          {canEdit && plan.status !== 'approved' && (
            <section className="space-y-3 rounded-xl border p-4">
              <h2 className="text-lg font-bold">승인 흐름</h2>
              <label className="block text-sm">
                결정 메모 (선택)
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mt-1 block w-full rounded border p-2"
                  placeholder="승인/반려/수정 요청 사유"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {(plan.status === 'draft' || plan.status === 'rejected' || plan.status === 'needs_revision') && (
                  <button
                    type="button"
                    className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void run(async () => {
                      await transitionPmPlan(plan, 'request_approval', comment)
                    }, '소유자에게 승인을 요청했습니다.')}
                  >
                    승인 요청
                  </button>
                )}
                {plan.status === 'pending_owner_approval' && isOwner && (
                  <>
                    <button
                      type="button"
                      className="rounded bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void run(async () => {
                        await transitionPmPlan(plan, 'approve', comment)
                      }, '계획을 승인했습니다. 업무 연결이 가능합니다.')}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void run(async () => {
                        await transitionPmPlan(plan, 'reject', comment)
                      }, '계획을 반려했습니다.')}
                    >
                      반려
                    </button>
                    <button
                      type="button"
                      className="rounded border px-4 py-2 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void run(async () => {
                        await transitionPmPlan(plan, 'needs_revision', comment)
                      }, '수정을 요청했습니다.')}
                    >
                      수정 요청
                    </button>
                  </>
                )}
                {plan.status === 'pending_owner_approval' && !isOwner && (
                  <p className="text-sm text-gray-500">소유자 승인 대기 중입니다. 최종 결정은 프로젝트 소유자만 할 수 있습니다.</p>
                )}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-lg font-bold">승인 이력</h2>
            {events.length === 0 ? (
              <p className="text-sm text-gray-500">기록된 승인 이력이 없습니다.</p>
            ) : (
              <ol className="space-y-2">
                {events.map((event) => (
                  <li key={event.id} className="rounded border p-3 text-sm">
                    <span className="font-semibold">{EVENT_LABELS[event.event_type]}</span>
                    <span className="text-gray-500"> · 계획 버전 {event.plan_version} · {new Date(event.created_at).toLocaleString('ko-KR')}</span>
                    {event.from_status && event.to_status && (
                      <span className="text-gray-500"> · {PM_PLAN_STATUS_LABELS[event.from_status as PmPlan['status']] ?? event.from_status} → {PM_PLAN_STATUS_LABELS[event.to_status as PmPlan['status']] ?? event.to_status}</span>
                    )}
                    {event.comment && <p className="mt-1">메모: {event.comment}</p>}
                    {event.linked_task_id && <p className="mt-1 text-xs text-gray-500">연결 업무 ID: {event.linked_task_id}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  )
}
