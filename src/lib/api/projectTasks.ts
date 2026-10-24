import { supabase } from '../supabase'
import type { PrototypeTask, TaskStatus } from '../taskPrototype'

type DbTask = {
  id: string; project_id: string; title: string; objective: string; acceptance_criteria: string[]
  assignee_user_id: string | null; status: TaskStatus; blocked_reason: string | null
  deleted_at: string | null; created_at: string; updated_at: string; version: number
}
export type ServerTask = PrototypeTask & { version: number }
export type TaskPatch = {
  title?: string; objective?: string; acceptanceCriteria?: string[]; assigneeId?: string | null
  status?: TaskStatus; blockedReason?: string | null; deletedAt?: string | null
}
export class TaskConflictError extends Error {
  constructor() { super('업무가 다른 곳에서 변경됐습니다. 새로고침 후 다시 시도하세요.') }
}
const toTask = (row: DbTask): ServerTask => ({
  id: row.id, projectId: row.project_id, title: row.title, objective: row.objective, acceptanceCriteria: row.acceptance_criteria ?? [],
  assigneeId: row.assignee_user_id, assigneeName: null,
  status: row.status, blockedReason: row.blocked_reason, deletedAt: row.deleted_at,
  createdAt: row.created_at, updatedAt: row.updated_at, version: row.version,
})

export async function listServerTasks(projectId: string): Promise<ServerTask[]> {
  const { data, error } = await supabase.from('project_tasks').select('*')
    .eq('project_id', projectId).order('updated_at', { ascending: false })
  if (error) throw error
  return (data as DbTask[] ?? []).map(toTask)
}
export async function createServerTask(projectId: string, input: {
  title: string; objective: string; acceptanceCriteria: string[]; assigneeId: string | null
}): Promise<ServerTask> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('로그인이 필요합니다.')
  const { data, error } = await supabase.from('project_tasks').insert({
    project_id: projectId, created_by: auth.user.id,
    title: input.title.trim(), objective: input.objective, acceptance_criteria: input.acceptanceCriteria,
    assignee_user_id: input.assigneeId,
  }).select('*').single()
  if (error) throw error
  return toTask(data as DbTask)
}
export async function patchServerTask(
  projectId: string, taskId: string, expectedVersion: number, patch: TaskPatch,
): Promise<ServerTask> {
  // Row-level optimistic concurrency: exactly one caller can update old version.
  const updates: Record<string, unknown> = { version: expectedVersion + 1 }
  if (patch.title !== undefined) updates.title = patch.title.trim()
  if (patch.objective !== undefined) updates.objective = patch.objective
  if (patch.acceptanceCriteria !== undefined) updates.acceptance_criteria = patch.acceptanceCriteria
  if (patch.assigneeId !== undefined) updates.assignee_user_id = patch.assigneeId
  if (patch.status !== undefined) updates.status = patch.status
  if (patch.blockedReason !== undefined) updates.blocked_reason = patch.blockedReason
  if (patch.deletedAt !== undefined) updates.deleted_at = patch.deletedAt
  const { data, error } = await supabase.from('project_tasks').update(updates)
    .eq('project_id', projectId).eq('id', taskId).eq('version', expectedVersion)
    .select('*').maybeSingle()
  // The version filter normally turns a lost race into an empty result
  // below; if the server-side trigger still raises a version conflict
  // (P4001 since migration 020; 40001 on a pre-020 database), surface the
  // same TaskConflictError instead of a raw database error.
  if (error && ['P4001', '40001'].includes((error as { code?: string }).code ?? '')) {
    throw new TaskConflictError()
  }
  if (error) throw error
  if (!data) throw new TaskConflictError()
  return toTask(data as DbTask)
}

export type TaskEvent = {
  id: number
  project_id: string
  task_id: string
  actor_id: string | null
  event_type: 'created' | 'updated' | 'status_changed' | 'deleted' | 'restored'
  previous_status: TaskStatus | null
  next_status: TaskStatus
  version: number
  happened_at: string
}

/** Read-only history; records are written exclusively by a database trigger. */
export async function listServerTaskEvents(projectId: string, taskId: string): Promise<TaskEvent[]> {
  const { data, error } = await supabase.from('project_task_events')
    .select('id,project_id,task_id,actor_id,event_type,previous_status,next_status,version,happened_at')
    .eq('project_id', projectId).eq('task_id', taskId)
    .order('happened_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data ?? []) as TaskEvent[]
}
