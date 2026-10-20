import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import {
  readPrototypeTasks, writePrototypeTasks, permittedTransition,
  type PrototypeTask, type TaskStatus,
} from '../lib/taskPrototype'

const labels: Record<TaskStatus, string> = {
  todo: '대기', in_progress: '진행 중', in_review: '검토 중', blocked: '차단', done: '완료',
}
const allStatuses = Object.keys(labels) as TaskStatus[]

export default function ProjectTasksPage() {
  const { projectId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const [tasks, setTasks] = useState<PrototypeTask[]>([])
  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    setReady(false)
    if (!projectId || !userId) return
    void setCurrentProject(projectId).then(() => {
      if (!mounted) return
      setTasks(readPrototypeTasks(userId, projectId))
      setReady(true)
    }).catch(() => { if (mounted) setError('프로젝트를 확인할 수 없습니다.') })
    return () => { mounted = false }
  }, [projectId, userId, setCurrentProject])

  const activeProject = currentProject?.id === projectId
  function save(next: PrototypeTask[]) {
    if (!projectId || !userId || !activeProject) return
    if (!writePrototypeTasks(userId, projectId, next)) {
      setError('기기 저장에 실패했습니다. 변경사항을 다시 확인하세요.')
      return
    }
    setTasks(next)
    setError('')
  }
  function createTask() {
    if (!projectId || !activeProject || !title.trim()) return
    const now = new Date().toISOString()
    save([{ id: crypto.randomUUID(), projectId, title: title.trim(),
      objective: objective.trim(), status: 'todo', blockedReason: null,
      createdAt: now, updatedAt: now }, ...tasks])
    setTitle('')
    setObjective('')
  }
  function changeStatus(task: PrototypeTask, status: TaskStatus) {
    if (!permittedTransition(task.status, status)) {
      setError('허용되지 않은 업무 상태 변경입니다.')
      return
    }
    let reason: string | null = null
    if (status === 'blocked') {
      reason = window.prompt('차단 사유를 입력하세요')?.trim() ?? ''
      if (!reason) { setError('차단 사유가 필요합니다.'); return }
    }
    save(tasks.map((t) => t.id === task.id ? {
      ...t, status, blockedReason: reason, updatedAt: new Date().toISOString(),
    } : t))
  }
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <Link to={projectId ? `/projects/${projectId}` : '/projects'}
        className="text-sm text-gray-500 hover:underline">← 프로젝트 문서</Link>
      <header>
        <h1 className="text-2xl font-bold text-gray-900">프로젝트 업무 관리</h1>
        <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="note">
          S1 개발 시안: 이 화면의 업무는 현재 브라우저에만 저장됩니다.
          팀 공유·서버 저장·권한 통합은 아직 제공하지 않습니다.
        </p>
      </header>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {!ready ? <p>프로젝트를 확인하는 중입니다.</p> : !activeProject ? (
        <p role="alert">프로젝트 접근을 확인할 수 없습니다.</p>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold">새 업무 등록</h2>
            <label className="block text-sm">업무 제목
              <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded border p-2" />
            </label>
            <label className="block text-sm">목표 / 완료 기준
              <textarea value={objective} onChange={(e) => setObjective(e.target.value)}
                className="mt-1 w-full rounded border p-2" rows={3} />
            </label>
            <button type="button" onClick={createTask} disabled={!title.trim()}
              className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40">업무 추가</button>
          </section>
          <section className="space-y-3" aria-label="프로젝트 업무">
            <h2 className="font-semibold">업무 목록 ({tasks.length})</h2>
            {tasks.length === 0 && <p className="text-sm text-gray-500">등록된 업무가 없습니다.</p>}
            {tasks.map((task) => (
              <article key={task.id} className="rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold">{task.title}</h3>
                {task.objective && <p className="mt-2 whitespace-pre-wrap text-sm">{task.objective}</p>}
                {task.blockedReason && <p className="mt-2 text-sm text-red-700">차단 사유: {task.blockedReason}</p>}
                <label className="mt-3 block text-sm">상태
                  <select value={task.status} onChange={(e) => changeStatus(task, e.target.value as TaskStatus)}
                    className="ml-3 rounded border p-2">
                    {allStatuses.map((status) => (
                      <option key={status} value={status} disabled={!permittedTransition(task.status, status)}>
                        {labels[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  )
}
