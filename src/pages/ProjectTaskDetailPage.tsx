import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useMemberStore } from '../store/memberStore'
import {
  listServerTasks,
  listServerTaskEvents,
  patchServerTask,
  TaskConflictError,
  type ServerTask,
  type TaskEvent,
} from '../lib/api/projectTasks'
import {
  prototypeTaskRepository,
  permittedTransition,
  type PrototypeTask,
  type TaskStatus,
} from '../lib/taskPrototype'
import {
  formatTaskAssigneeDisplay,
  getTaskAiAssignee,
  MOCK_AI_ASSIGNEE_ROLE,
  writeTaskAiAssignee,
  type TaskAssigneeKind,
} from '../lib/taskAiAssigneeMock'

const useServerTasks = import.meta.env.VITE_S1_SERVER_TASKS === 'true'
const labels: Record<TaskStatus, string> = {
  todo: '대기', in_progress: '진행 중', in_review: '검토 중', blocked: '차단', done: '완료',
}
const eventLabels: Record<TaskEvent['event_type'], string> = {
  created: '생성', updated: '수정', status_changed: '상태 변경', deleted: '삭제', restored: '복원',
}

export default function ProjectTaskDetailPage() {
  const { projectId, taskId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const members = useMemberStore((s) => s.members)
  const fetchMembers = useMemberStore((s) => s.fetchMembers)
  const [task, setTask] = useState<PrototypeTask | ServerTask | null>(null)
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [eventsError, setEventsError] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assigneeDraft, setAssigneeDraft] = useState('')
  const [assigneeKindDraft, setAssigneeKindDraft] = useState<TaskAssigneeKind>('human')

  useEffect(() => {
    let mounted = true
    if (!projectId || !taskId || !userId) return
    void setCurrentProject(projectId)
      .then(() => (useServerTasks
        ? listServerTasks(projectId)
        : prototypeTaskRepository.list(userId, projectId)))
      .then((items) => {
        if (!mounted) return
        const found = items.find((item) => item.id === taskId) ?? null
        setTask(found)
        setAssigneeDraft(found?.assigneeId ?? '')
        setAssigneeKindDraft(getTaskAiAssignee(projectId, taskId).kind)
        if (!found) setError('업무를 찾을 수 없습니다.')
      })
      .catch(() => { if (mounted) setError('업무를 불러올 수 없습니다.') })
      .finally(() => { if (mounted) setReady(true) })
    void fetchMembers(projectId).catch(() => undefined)
    if (useServerTasks) {
      void listServerTaskEvents(projectId, taskId)
        .then((rows) => {
          if (!mounted) return
          setEvents(rows)
          setEventsError('')
        })
        .catch(() => {
          if (!mounted) return
          setEvents([])
          setEventsError('업무 이력을 불러오지 못했습니다.')
        })
    }
    return () => { mounted = false }
  }, [projectId, taskId, userId, setCurrentProject, fetchMembers])

  const activeMembers = members.filter((m) => m.project_id === projectId && m.status === 'active' && m.user_id)
  const membership = members.find((m) => m.project_id === projectId && m.user_id === userId && m.status === 'active')
  const isOwner = Boolean(currentProject && userId && currentProject.user_id === userId)
  const roleLabel = isOwner ? 'owner' : (membership?.role ?? 'none')
  const canEditTasks = isOwner || membership?.role === 'owner' || membership?.role === 'editor'
  const canViewTasks = canEditTasks || membership?.role === 'viewer'
  const assigneeLabel = (id: string | null) => {
    if (!id) return '미지정'
    const member = activeMembers.find((m) => m.user_id === id)
    return member?.name || member?.email || '접근 불가/제외된 멤버'
  }

  async function changeStatus(next: TaskStatus) {
    if (!projectId || !taskId || !userId || !task || !canEditTasks || saving) return
    if (!permittedTransition(task.status, next)) {
      setError('허용되지 않은 업무 상태 변경입니다.')
      return
    }
    let reason: string | null = task.blockedReason
    if (next === 'blocked') {
      reason = window.prompt('차단 사유를 입력하세요')?.trim() ?? ''
      if (!reason) {
        setError('차단 사유가 필요합니다.')
        return
      }
    } else {
      reason = null
    }
    setSaving(true)
    setError('')
    try {
      if (useServerTasks && 'version' in task) {
        const updated = await patchServerTask(projectId, taskId, task.version, {
          status: next,
          blockedReason: reason,
        })
        setTask(updated)
        setAssigneeDraft(updated.assigneeId ?? '')
        const rows = await listServerTaskEvents(projectId, taskId)
        setEvents(rows)
      } else {
        const items = await prototypeTaskRepository.list(userId, projectId)
        const nextItems = items.map((item) =>
          item.id === taskId
            ? { ...item, status: next, blockedReason: reason, updatedAt: new Date().toISOString() }
            : item,
        )
        await prototypeTaskRepository.replace(userId, projectId, nextItems)
        const saved = nextItems.find((item) => item.id === taskId) ?? null
        setTask(saved)
        setAssigneeDraft(saved?.assigneeId ?? '')
      }
    } catch (e) {
      setError(e instanceof TaskConflictError ? e.message : '상태 변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function saveAssignee() {
    if (!projectId || !taskId || !userId || !task || !canEditTasks || saving) return
    const kind = assigneeKindDraft
    const nextId = kind === 'human' ? (assigneeDraft || null) : null
    if (kind === 'human' && nextId) {
      const member = activeMembers.find((m) => m.user_id === nextId)
      if (!member) {
        setError('유효한 프로젝트 멤버를 지정하세요.')
        return
      }
    }
    setSaving(true)
    setError('')
    try {
      writeTaskAiAssignee(projectId, taskId, {
        kind,
        agentRoleId: kind === 'agent' ? MOCK_AI_ASSIGNEE_ROLE.id : null,
      })
      if (useServerTasks && 'version' in task) {
        const updated = await patchServerTask(projectId, taskId, task.version, {
          assigneeId: nextId,
        })
        setTask(updated)
        setAssigneeDraft(updated.assigneeId ?? '')
        setAssigneeKindDraft(kind)
        const rows = await listServerTaskEvents(projectId, taskId)
        setEvents(rows)
      } else {
        const member = nextId ? activeMembers.find((m) => m.user_id === nextId) : undefined
        const items = await prototypeTaskRepository.list(userId, projectId)
        const nextItems = items.map((item) =>
          item.id === taskId
            ? {
                ...item,
                assigneeId: nextId,
                assigneeName: member?.name || member?.email || null,
                updatedAt: new Date().toISOString(),
              }
            : item,
        )
        await prototypeTaskRepository.replace(userId, projectId, nextItems)
        setTask(nextItems.find((item) => item.id === taskId) ?? null)
        setAssigneeDraft(nextId ?? '')
        setAssigneeKindDraft(kind)
      }
    } catch (e) {
      setError(e instanceof TaskConflictError ? e.message : '담당자 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const statusOptions = (Object.keys(labels) as TaskStatus[]).filter(
    (status) => !task || permittedTransition(task.status, status) || status === task.status,
  )

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link to={projectId ? `/projects/${projectId}/tasks` : '/projects'}
        className="text-sm text-gray-500 hover:underline">← 업무 목록</Link>
      <header>
        <h1 className="text-2xl font-bold text-gray-900">업무 상세</h1>
        <p className="mt-1 text-sm text-gray-600">
          {useServerTasks
            ? '서버 저장 업무의 담당자·이력(project_task_events)을 표시합니다.'
            : '브라우저 시안 모드에서는 이력이 없습니다. VITE_S1_SERVER_TASKS=true 에서 이력을 확인하세요.'}
        </p>
        <p className="mt-1 text-xs text-gray-500" data-testid="task-detail-role">
          현재 역할: {roleLabel}
          {canEditTasks ? ' (편집 가능)' : canViewTasks ? ' (읽기 전용)' : ' (접근 없음)'}
        </p>
      </header>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {ready && !canViewTasks && !error && (
        <p role="alert" className="rounded bg-amber-50 p-3 text-amber-900">
          이 프로젝트 업무를 볼 권한이 없습니다. Owner/Editor/Viewer만 조회할 수 있습니다.
        </p>
      )}
      {!ready ? <p>불러오는 중…</p> : !task || !canViewTasks ? null : (
        <>
          <section className="space-y-3 rounded-xl border border-gray-200 p-5" aria-label="업무 본문">
            <h2 className="text-xl font-semibold">{task.title}</h2>
            <p className="text-sm text-gray-700">상태: {labels[task.status]}</p>
            {canEditTasks && (
              <label className="block text-sm text-gray-700">
                상태 변경
                <select
                  className="mt-1 block rounded border border-gray-300 p-2"
                  value={task.status}
                  disabled={saving}
                  data-testid="task-detail-status"
                  onChange={(e) => void changeStatus(e.target.value as TaskStatus)}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{labels[status]}</option>
                  ))}
                </select>
              </label>
            )}
            <p className="text-sm text-gray-700" data-testid="task-detail-assignee-summary">
              담당:{' '}
              {formatTaskAssigneeDisplay(
                projectId && taskId ? getTaskAiAssignee(projectId, taskId).kind : 'human',
                assigneeLabel(task.assigneeId),
              )}
            </p>
            {canEditTasks && (
              <div className="space-y-2" data-testid="task-detail-assignee-kind-block">
                <label className="block text-sm text-gray-700">
                  담당 유형 (F-105 Mock)
                  <select
                    className="mt-1 block w-full rounded border border-gray-300 p-2"
                    value={assigneeKindDraft}
                    disabled={saving}
                    data-testid="task-detail-assignee-kind"
                    onChange={(e) => setAssigneeKindDraft(e.target.value as TaskAssigneeKind)}
                  >
                    <option value="human">사람 담당</option>
                    <option value="agent">AI 담당 (Mock · 실행 아님)</option>
                  </select>
                </label>
                {assigneeKindDraft === 'human' ? (
                  <label className="block text-sm text-gray-700">
                    담당 프로젝트 멤버
                    <select
                      className="mt-1 block w-full rounded border border-gray-300 p-2"
                      value={assigneeDraft}
                      disabled={saving}
                      data-testid="task-detail-assignee"
                      onChange={(e) => setAssigneeDraft(e.target.value)}
                    >
                      <option value="">미지정</option>
                      {activeMembers.map((m) => (
                        <option key={m.user_id!} value={m.user_id!}>
                          {m.name || m.email || m.user_id}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-950"
                    data-testid="task-detail-ai-assignee-mock"
                  >
                    <p className="font-medium">AI 역할: {MOCK_AI_ASSIGNEE_ROLE.title}</p>
                    <p className="mt-1 text-xs">
                      역할 ID `{MOCK_AI_ASSIGNEE_ROLE.id}` · 메타데이터만 저장합니다. 유료 LLM·계약·채용·검수
                      실행이 시작되지 않습니다. 실제 Mock 투입은{' '}
                      <Link
                        to={projectId ? `/projects/${projectId}/specialists` : '/projects'}
                        className="font-medium underline underline-offset-2"
                      >
                        AI 직원 카탈로그
                      </Link>
                      를 이용하세요.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
                  disabled={saving}
                  data-testid="task-detail-assignee-save"
                  onClick={() => void saveAssignee()}
                >
                  담당 저장
                </button>
              </div>
            )}
            {task.objective && (
              <div>
                <h3 className="text-sm font-medium text-gray-800">목표</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{task.objective}</p>
              </div>
            )}
            {task.acceptanceCriteria.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-800">완료 기준</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {task.acceptanceCriteria.map((line, index) => <li key={index}>{line}</li>)}
                </ul>
              </div>
            )}
            {task.blockedReason && (
              <p className="text-sm text-red-700">차단 사유: {task.blockedReason}</p>
            )}
            <p className="text-xs text-gray-500">
              프로젝트: {currentProject?.title ?? projectId}
              {' · '}갱신: {new Date(task.updatedAt).toLocaleString()}
              {'version' in task ? ` · v${task.version}` : ''}
            </p>
          </section>
          <section
            className="space-y-3"
            aria-label="업무 이력"
            data-testid="task-detail-events"
          >
            <h2 className="font-semibold">감사 이력</h2>
            {!useServerTasks && (
              <p className="text-sm text-gray-500">로컬 시안 모드에서는 서버 이력을 제공하지 않습니다.</p>
            )}
            {useServerTasks && eventsError && (
              <p role="alert" className="text-sm text-red-700" data-testid="task-detail-events-error">
                {eventsError}
              </p>
            )}
            {useServerTasks && !eventsError && events.length === 0 && (
              <p className="text-sm text-gray-500">기록된 이력이 없습니다.</p>
            )}
            {events.map((event) => (
              <article
                key={event.id}
                className="rounded border border-gray-200 p-3 text-sm"
                data-testid="task-detail-event-row"
              >
                <p className="font-medium">{eventLabels[event.event_type]}</p>
                <p className="text-gray-600">
                  {event.previous_status ? `${labels[event.previous_status]} → ` : ''}
                  {labels[event.next_status]}
                  {' · '}v{event.version}
                  {' · '}{new Date(event.happened_at).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  주체: {event.actor_id ? assigneeLabel(event.actor_id) : '시스템/미기록'}
                </p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  )
}
