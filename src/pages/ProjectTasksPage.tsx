import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useMemberStore } from '../store/memberStore'
import {
  prototypeTaskRepository, permittedTransition,
  type PrototypeTask, type TaskStatus,
} from '../lib/taskPrototype'

import { listServerTasks, createServerTask, patchServerTask, TaskConflictError } from '../lib/api/projectTasks'

const useServerTasks = import.meta.env.VITE_S1_SERVER_TASKS === 'true'
const labels: Record<TaskStatus, string> = {
  todo: '대기', in_progress: '진행 중', in_review: '검토 중', blocked: '차단', done: '완료',
}
const allStatuses = Object.keys(labels) as TaskStatus[]
const parseCriteria = (text: string) => text.split('\n').map((v) => v.trim()).filter(Boolean).slice(0, 20)

export default function ProjectTasksPage() {
  const { projectId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const members = useMemberStore((state) => state.members)
  const fetchMembers = useMemberStore((state) => state.fetchMembers)
  const [tasks, setTasks] = useState<PrototypeTask[]>([])
  const [versions, setVersions] = useState<Record<string, number>>({})
  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [criteriaText, setCriteriaText] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editObjective, setEditObjective] = useState('')
  const [editCriteriaText, setEditCriteriaText] = useState('')
  const [editAssigneeId, setEditAssigneeId] = useState('')
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    if (!projectId || !userId) return
    void setCurrentProject(projectId).then(() => {
      if (!mounted) return
      void (useServerTasks ? listServerTasks(projectId) : prototypeTaskRepository.list(userId, projectId)).then((items) => {
        if (!mounted) return
        setTasks(items)
        setVersions(Object.fromEntries(items.map((t) => [t.id, 'version' in t ? Number(t.version) : 0])))
        setReady(true)
      }).catch(() => { if (mounted) setError('업무를 불러올 수 없습니다.') })
    }).catch(() => { if (mounted) setError('프로젝트를 확인할 수 없습니다.') })
    void fetchMembers(projectId).then(() => { if (mounted) setMembersLoaded(true) }).catch(() => { if (mounted) setError('팀 멤버 정보를 불러올 수 없어 담당자 지정이 제한됩니다.') })
    return () => { mounted = false }
  }, [projectId, userId, setCurrentProject, fetchMembers])

  const activeProject = currentProject?.id === projectId && currentProject?.deleted_at === null
  const currentMembership = membersLoaded ? members.find((member) => member.project_id === projectId && member.user_id === userId && member.status === 'active') : undefined
  const canEdit = activeProject && (currentProject?.user_id === userId || currentMembership?.role === 'owner' || currentMembership?.role === 'editor')
  const activeMembers = membersLoaded ? members.filter((member) => member.project_id === projectId && member.status === 'active' && member.user_id) : []
  const assignee = (id: string) => activeMembers.find((member) => member.user_id === id)
  const assigneeLabel = (id: string | null) => id ? (assignee(id)?.name || assignee(id)?.email || '접근 불가/제외된 멤버') : '미지정'
  async function save(next: PrototypeTask[]): Promise<boolean> {
    if (!projectId || !userId || !canEdit || saving) return false
    setSaving(true)
    try {
      if (useServerTasks) {
        const previous = tasks
        const before = new Map(previous.map((t) => [t.id, t]))
        const newTask = next.find((t) => !before.has(t.id))
        if (newTask) {
          const saved = await createServerTask(projectId, { title: newTask.title, objective: newTask.objective, acceptanceCriteria: newTask.acceptanceCriteria, assigneeId: newTask.assigneeId })
          setTasks([saved, ...previous])
          setVersions((v) => ({ ...v, [saved.id]: saved.version }))
        } else {
          const changed = next.find((t) => { const old = before.get(t.id); return old && JSON.stringify(old) !== JSON.stringify(t) })
          if (!changed) return true
          const version = versions[changed.id]
          if (!version) throw new TaskConflictError()
          const saved = await patchServerTask(projectId, changed.id, version, {
            title: changed.title, objective: changed.objective, acceptanceCriteria: changed.acceptanceCriteria, assigneeId: changed.assigneeId,
            status: changed.status, blockedReason: changed.blockedReason, deletedAt: changed.deletedAt,
          })
          setTasks(previous.map((t) => t.id === saved.id ? saved : t))
          setVersions((v) => ({ ...v, [saved.id]: saved.version }))
        }
      } else {
        await prototypeTaskRepository.replace(userId, projectId, next)
        setTasks(next)
      }
      setError('')
      return true
    } catch (failure) {
      setError(failure instanceof TaskConflictError ? failure.message : '업무 저장에 실패했습니다. 변경사항을 다시 확인하세요.')
      return false
    } finally {
      setSaving(false)
    }
  }
  async function createTask() {
    if (!projectId || !canEdit || !title.trim()) return
    const now = new Date().toISOString()
    const selected = assigneeId ? assignee(assigneeId) : undefined
    if (assigneeId && !selected) { setError('유효한 프로젝트 멤버를 지정하세요.'); return }
    const saved = await save([{ id: crypto.randomUUID(), projectId, title: title.trim(),
      objective: objective.trim(), acceptanceCriteria: parseCriteria(criteriaText), assigneeId: selected?.user_id ?? null,
      assigneeName: selected?.name || selected?.email || null, deletedAt: null,
      status: 'todo', blockedReason: null, createdAt: now, updatedAt: now }, ...tasks])
    if (saved) { setTitle(''); setObjective(''); setCriteriaText(''); setAssigneeId('') }
  }
  function changeStatus(task: PrototypeTask, status: TaskStatus) {
    if (!canEdit || saving) return
    if (!permittedTransition(task.status, status)) {
      setError('허용되지 않은 업무 상태 변경입니다.')
      return
    }
    let reason: string | null = null
    if (status === 'blocked') {
      reason = window.prompt('차단 사유를 입력하세요')?.trim() ?? ''
      if (!reason) { setError('차단 사유가 필요합니다.'); return }
    }
    void save(tasks.map((t) => t.id === task.id ? {
      ...t, status, blockedReason: reason, updatedAt: new Date().toISOString(),
    } : t))
  }
  function beginEdit(task: PrototypeTask) {
    setEditingId(task.id)
    setEditTitle(task.title)
    setEditObjective(task.objective)
    setEditCriteriaText(task.acceptanceCriteria.join('\n'))
    setEditAssigneeId(task.assigneeId ?? '')
  }
  async function saveEdit(task: PrototypeTask) {
    if (!canEdit || saving) return
    if (!editTitle.trim()) { setError('업무 제목을 입력하세요.'); return }
    const selected = editAssigneeId ? assignee(editAssigneeId) : undefined
    if (editAssigneeId && !selected) { setError('유효한 프로젝트 멤버를 지정하세요.'); return }
    const ok = await save(tasks.map((item) => item.id === task.id ? {
      ...item, title: editTitle.trim(), objective: editObjective.trim(), acceptanceCriteria: parseCriteria(editCriteriaText),
      assigneeId: selected?.user_id ?? null,
      assigneeName: selected?.name || selected?.email || null, updatedAt: new Date().toISOString(),
    } : item))
    if (ok) setEditingId(null)
  }
  function setDeleted(task: PrototypeTask, deleted: boolean) {
    if (!canEdit || saving) return
    void save(tasks.map((item) => item.id === task.id ? {
      ...item, deletedAt: deleted ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    } : item))
  }
  const visibleTasks = tasks.filter((task) => showDeleted ? task.deletedAt !== null : task.deletedAt === null)
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-center gap-4">
        <Link to={projectId ? `/projects/${projectId}` : '/projects'}
          className="text-sm text-gray-500 hover:underline">← 프로젝트 문서</Link>
        <Link to={projectId ? `/projects/${projectId}/plans` : '/projects'}
          className="text-sm text-indigo-700 hover:underline">PM 계획 →</Link>
      </div>
      <header>
        <h1 className="text-2xl font-bold text-gray-900">프로젝트 업무 관리</h1>
        <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="note">
          {useServerTasks ? '개발 DB 테스트 모드: 업무를 서버에 저장합니다. 운영 환경에서는 사용하지 마세요.' : 'S1 개발 시안: 이 화면의 업무는 현재 브라우저에만 저장됩니다.'}
          실제 운영용 업무 관리·권한 통합은 아직 검증되지 않았습니다.
        </p>
      </header>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {!ready ? <p>프로젝트를 확인하는 중입니다.</p> : !activeProject ? (
        <p role="alert">프로젝트 접근을 확인할 수 없습니다.</p>
      ) : (
        <>
          {canEdit && <section className="space-y-3 rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold">새 업무 등록</h2>
            <label className="block text-sm">업무 제목
              <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded border p-2" />
            </label>
            <label className="block text-sm">목표 / 완료 기준
              <textarea value={objective} onChange={(e) => setObjective(e.target.value)}
                className="mt-1 w-full rounded border p-2" rows={3} />
            </label>
            <label className="block text-sm">완료 기준 (한 줄에 하나씩, 최대 20개)
              <textarea value={criteriaText} onChange={(e) => setCriteriaText(e.target.value)} rows={3} className="mt-1 w-full rounded border p-2" />
            </label>
            <label className="block text-sm">담당 프로젝트 멤버
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                disabled={!membersLoaded} className="mt-1 w-full rounded border p-2">
                <option value="">미지정</option>
                {activeMembers.map((member) => <option key={member.id} value={member.user_id ?? ''}>{member.name || member.email}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => { void createTask() }} disabled={!title.trim() || saving}
              className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40">업무 추가</button>
          </section>}
          {!canEdit && <p className="text-sm text-gray-600">읽기 전용입니다. 업무를 수정하려면 프로젝트 편집 권한이 필요합니다.</p>}
          <section className="space-y-3" aria-label="프로젝트 업무">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{showDeleted ? '삭제한 업무' : '업무 목록'} ({visibleTasks.length})</h2>
              <button type="button" onClick={() => setShowDeleted((value) => !value)}
                className="rounded border px-3 py-1 text-sm">{showDeleted ? '활성 업무 보기' : '삭제한 업무 보기'}</button>
            </div>
            {visibleTasks.length === 0 && <p className="text-sm text-gray-500">등록된 업무가 없습니다.</p>}
            {visibleTasks.map((task) => (
              <article key={task.id} className="rounded-xl border border-gray-200 p-4">
                {canEdit && editingId === task.id ? (
                  <div className="space-y-2">
                    <label className="block text-sm">업무 제목
                      <input value={editTitle} maxLength={120} onChange={(e) => setEditTitle(e.target.value)}
                        className="mt-1 w-full rounded border p-2" />
                    </label>
                    <label className="block text-sm">목표 / 완료 기준
                      <textarea value={editObjective} onChange={(e) => setEditObjective(e.target.value)}
                        className="mt-1 w-full rounded border p-2" rows={3} />
                    </label>
                    <label className="block text-sm">완료 기준 (한 줄에 하나씩, 최대 20개)
                      <textarea value={editCriteriaText} onChange={(e) => setEditCriteriaText(e.target.value)} rows={3} className="mt-1 w-full rounded border p-2" />
                    </label>
                    <label className="block text-sm">담당 프로젝트 멤버
                      <select value={editAssigneeId} disabled={!membersLoaded}
                        onChange={(e) => setEditAssigneeId(e.target.value)}
                        className="mt-1 w-full rounded border p-2">
                        <option value="">미지정</option>
                        {activeMembers.map((member) => <option key={member.id} value={member.user_id ?? ''}>{member.name || member.email}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={() => { void saveEdit(task) }} className="mr-2 rounded bg-gray-900 px-3 py-2 text-white">변경 저장</button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded border px-3 py-2">취소</button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold">{task.title}</h3>
                    {task.objective && <p className="mt-2 whitespace-pre-wrap text-sm">{task.objective}</p>}
                    {task.acceptanceCriteria.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm" aria-label="업무 완료 기준">{task.acceptanceCriteria.map((v, i) => <li key={i}>{v}</li>)}</ul>}
                    <p className="mt-1 text-xs text-gray-500">담당: {assigneeLabel(task.assigneeId)}</p>
                  </>
                )}
                {task.blockedReason && <p className="mt-2 text-sm text-red-700">차단 사유: {task.blockedReason}</p>}
                {canEdit && !showDeleted && <label className="mt-3 block text-sm">상태
                  <select value={task.status} onChange={(e) => changeStatus(task, e.target.value as TaskStatus)}
                    className="ml-3 rounded border p-2">
                    {allStatuses.map((status) => (
                      <option key={status} value={status} disabled={!permittedTransition(task.status, status)}>
                        {labels[status]}
                      </option>
                    ))}
                  </select>
                </label>}
                {canEdit && <div className="mt-3 flex gap-2">
                  {showDeleted ? (
                    <button type="button" onClick={() => setDeleted(task, false)} className="rounded border px-3 py-1 text-sm">복원</button>
                  ) : (
                    <>
                      {editingId !== task.id && <button type="button" onClick={() => beginEdit(task)} className="rounded border px-3 py-1 text-sm">수정</button>}
                      <button type="button" onClick={() => setDeleted(task, true)} className="rounded border px-3 py-1 text-sm text-red-700">삭제</button>
                    </>
                  )}
                </div>}
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  )
}
