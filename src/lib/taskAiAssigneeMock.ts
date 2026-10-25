import { MOCK_SPECIALIST } from './mockSpecialistRequest'

/**
 * F-105 Mock: task assignee kind metadata only.
 * Does not hire, run models, open contracts, or charge.
 * Browser-local; no DB migration / ops schema change.
 *
 * Storage is scoped by userId + projectId (F105-02 isolation).
 * Callers must persist kind only after the durable task write succeeds (F105-01).
 */
export type TaskAssigneeKind = 'human' | 'agent'

export type TaskAiAssigneeMock = {
  kind: TaskAssigneeKind
  /** Only allowed when kind === 'agent'. MVP: requirements_auditor_v1. */
  agentRoleId: string | null
  updatedAt: string
}

export const MOCK_AI_ASSIGNEE_ROLE = {
  id: MOCK_SPECIALIST.id,
  title: MOCK_SPECIALIST.title,
} as const

const PREFIX = 'planos:s1-ai-assignee-mock:v2:'
/** Pre-isolation key (project-only). Read-ignored for cross-user safety. */
const LEGACY_PREFIX = 'planos:s1-ai-assignee-mock:v1:'

function storageKey(userId: string, projectId: string): string {
  return (
    PREFIX +
    encodeURIComponent(userId) +
    ':' +
    encodeURIComponent(projectId)
  )
}

function legacyStorageKey(projectId: string): string {
  return LEGACY_PREFIX + encodeURIComponent(projectId)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseEntry(value: unknown): TaskAiAssigneeMock | null {
  if (!isRecord(value)) return null
  const kind = value.kind
  if (kind !== 'human' && kind !== 'agent') return null
  let agentRoleId: string | null = null
  if (typeof value.agentRoleId === 'string') {
    agentRoleId = value.agentRoleId
  } else if (value.agentRoleId !== null && value.agentRoleId !== undefined) {
    return null
  }
  if (kind === 'agent' && agentRoleId !== MOCK_AI_ASSIGNEE_ROLE.id) return null
  if (kind === 'human' && agentRoleId !== null) return null
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : ''
  return { kind, agentRoleId, updatedAt }
}

function parseMap(raw: string | null): Record<string, TaskAiAssigneeMock> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return {}
    const out: Record<string, TaskAiAssigneeMock> = {}
    for (const [taskId, entry] of Object.entries(parsed)) {
      const normalized = parseEntry(entry)
      if (normalized) out[taskId] = normalized
    }
    return out
  } catch {
    return {}
  }
}

/** Per-user, per-project map of taskId → assignee-kind Mock. */
export function readTaskAiAssigneeMap(
  userId: string,
  projectId: string,
): Record<string, TaskAiAssigneeMock> {
  if (!userId || !projectId) return {}
  try {
    return parseMap(localStorage.getItem(storageKey(userId, projectId)))
  } catch {
    return {}
  }
}

/**
 * Drop legacy project-only keys so another browser profile cannot inherit them.
 * Safe no-op when absent.
 */
export function clearLegacyTaskAiAssigneeProjectKey(projectId: string): void {
  if (!projectId) return
  try {
    localStorage.removeItem(legacyStorageKey(projectId))
  } catch {
    /* ignore quota / private mode */
  }
}

export function getTaskAiAssignee(
  userId: string,
  projectId: string,
  taskId: string,
): TaskAiAssigneeMock {
  return (
    readTaskAiAssigneeMap(userId, projectId)[taskId] ?? {
      kind: 'human',
      agentRoleId: null,
      updatedAt: '',
    }
  )
}

/**
 * Persist assignee-kind Mock. Call only after the task row (server or prototype)
 * write has succeeded — otherwise UI and durable state diverge (F105-01).
 */
export function writeTaskAiAssignee(
  userId: string,
  projectId: string,
  taskId: string,
  next: Omit<TaskAiAssigneeMock, 'updatedAt'> & { updatedAt?: string },
): TaskAiAssigneeMock {
  if (!userId || !projectId || !taskId) {
    throw new Error('userId, projectId, and taskId are required for AI assignee Mock')
  }
  const kind = next.kind
  const agentRoleId = kind === 'agent' ? MOCK_AI_ASSIGNEE_ROLE.id : null
  const record: TaskAiAssigneeMock = {
    kind,
    agentRoleId,
    updatedAt: next.updatedAt ?? new Date().toISOString(),
  }
  const map = readTaskAiAssigneeMap(userId, projectId)
  map[taskId] = record
  localStorage.setItem(storageKey(userId, projectId), JSON.stringify(map))
  clearLegacyTaskAiAssigneeProjectKey(projectId)
  return record
}

export function formatTaskAssigneeDisplay(
  kind: TaskAssigneeKind,
  humanLabel: string,
): string {
  if (kind === 'agent') {
    return `AI · ${MOCK_AI_ASSIGNEE_ROLE.title} (Mock · 실행 아님)`
  }
  return humanLabel
}
