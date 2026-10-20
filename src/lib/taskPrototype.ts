/** S1 isolated UI prototype, NOT a production task API or authorization layer. */
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done'
export interface PrototypeTask {
  id: string
  projectId: string
  title: string
  objective: string
  status: TaskStatus
  blockedReason: string | null
  createdAt: string
  updatedAt: string
}
const PREFIX = 'planos:s1-prototype:v1:'
const statuses: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'blocked', 'done']
export function isTaskStatus(value: string): value is TaskStatus {
  return statuses.some((status) => status === value)
}
export function permittedTransition(previous: TaskStatus, next: TaskStatus): boolean {
  if (previous === next) return true
  const transitions: Record<TaskStatus, TaskStatus[]> = {
    todo: ['in_progress', 'blocked'],
    in_progress: ['in_review', 'blocked'],
    in_review: ['done', 'in_progress', 'blocked'],
    blocked: ['in_progress'],
    done: [],
  }
  return transitions[previous].includes(next)
}
function storageKey(userId: string, projectId: string): string {
  return PREFIX + encodeURIComponent(userId) + ':' + encodeURIComponent(projectId)
}
export function readPrototypeTasks(userId: string, projectId: string): PrototypeTask[] {
  try {
    const raw = localStorage.getItem(storageKey(userId, projectId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is PrototypeTask => {
      if (!x || typeof x !== 'object') return false
      const t = x as Partial<PrototypeTask>
      return t.projectId === projectId && typeof t.id === 'string'
        && typeof t.title === 'string' && typeof t.objective === 'string'
        && typeof t.status === 'string' && isTaskStatus(t.status)
    })
  } catch { return [] }
}
export function writePrototypeTasks(userId: string, projectId: string, tasks: PrototypeTask[]): boolean {
  try {
    localStorage.setItem(storageKey(userId, projectId), JSON.stringify(tasks))
    return true
  } catch { return false }
}
