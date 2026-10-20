/** S1 isolated UI prototype, NOT a production task API or authorization layer. */
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done'
export interface PrototypeTask {
  id: string
  projectId: string
  title: string
  objective: string
  acceptanceCriteria: string[]
  assigneeName: string | null
  assigneeId: string | null
  deletedAt: string | null
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
    const valid = parsed.filter((x): x is PrototypeTask => {
      if (!x || typeof x !== 'object') return false
      const t = x as Partial<PrototypeTask>
      return t.projectId === projectId && typeof t.id === 'string'
        && typeof t.title === 'string' && typeof t.objective === 'string'
        && (t.acceptanceCriteria === undefined || (Array.isArray(t.acceptanceCriteria) && t.acceptanceCriteria.every((v) => typeof v === 'string')))
        && typeof t.status === 'string' && isTaskStatus(t.status)
        && (t.assigneeName === undefined || t.assigneeName === null || typeof t.assigneeName === 'string')
        && (t.assigneeId === undefined || t.assigneeId === null || typeof t.assigneeId === 'string')
        && (t.deletedAt === undefined || t.deletedAt === null || typeof t.deletedAt === 'string')
    })
    return valid.map((task) => ({...task, assigneeName: task.assigneeName ?? null, assigneeId: task.assigneeId ?? null, deletedAt: task.deletedAt ?? null, acceptanceCriteria: task.acceptanceCriteria ?? []}))
  } catch { return [] }
}
export function writePrototypeTasks(userId: string, projectId: string, tasks: PrototypeTask[]): boolean {
  try {
    localStorage.setItem(storageKey(userId, projectId), JSON.stringify(tasks))
    return true
  } catch { return false }
}

/** Adapter boundary for replacing local-only persistence with a server-backed repository. */
export interface TaskRepository {
  list(userId: string, projectId: string): Promise<PrototypeTask[]>
  replace(userId: string, projectId: string, tasks: PrototypeTask[]): Promise<void>
}
export const prototypeTaskRepository: TaskRepository = {
  async list(userId, projectId) {
    return readPrototypeTasks(userId, projectId)
  },
  async replace(userId, projectId, tasks) {
    if (!writePrototypeTasks(userId, projectId, tasks)) {
      throw new Error('Local task storage failed')
    }
  },
}
