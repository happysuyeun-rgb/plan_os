import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useMemberStore } from '../store/memberStore'
import {
  listServerTasks,
  listServerTaskEvents,
  type ServerTask,
  type TaskEvent,
} from '../lib/api/projectTasks'
import { prototypeTaskRepository, type PrototypeTask, type TaskStatus } from '../lib/taskPrototype'

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
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

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
        if (!found) setError('업무를 찾을 수 없습니다.')
      })
      .catch(() => { if (mounted) setError('업무를 불러올 수 없습니다.') })
      .finally(() => { if (mounted) setReady(true) })
    void fetchMembers(projectId).catch(() => undefined)
    if (useServerTasks) {
      void listServerTaskEvents(projectId, taskId)
        .then((rows) => { if (mounted) setEvents(rows) })
        .catch(() => { if (mounted) setEvents([]) })
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
            <p className="text-sm text-gray-700">담당: {assigneeLabel(task.assigneeId)}</p>
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
          <section className="space-y-3" aria-label="업무 이력">
            <h2 className="font-semibold">이력</h2>
            {!useServerTasks && (
              <p className="text-sm text-gray-500">로컬 시안 모드에서는 서버 이력을 제공하지 않습니다.</p>
            )}
            {useServerTasks && events.length === 0 && (
              <p className="text-sm text-gray-500">기록된 이력이 없습니다.</p>
            )}
            {events.map((event) => (
              <article key={event.id} className="rounded border border-gray-200 p-3 text-sm">
                <p className="font-medium">{eventLabels[event.event_type]}</p>
                <p className="text-gray-600">
                  {event.previous_status ? `${labels[event.previous_status]} → ` : ''}
                  {labels[event.next_status]}
                  {' · '}v{event.version}
                  {' · '}{new Date(event.happened_at).toLocaleString()}
                </p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  )
}
