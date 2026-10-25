import { MOCK_SPECIALIST } from './mockSpecialistRequest'

/**
 * F-105 Mock: task assignee kind metadata only.
 * Does not hire, run models, open contracts, or charge.
 * Browser-local; no DB migration / ops schema change.
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

const PREFIX = 'planos:s1-ai-assignee-mock:v1:'

function storageKey(projectId: string): string {
  return PREFIX + encodeURIComponent(projectId)
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

/** Per-project map of taskId → assignee-kind Mock. */
export function readTaskAiAssigneeMap(projectId: string): Record<string, TaskAiAssigneeMock> {
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (!raw) return {}
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

export function getTaskAiAssignee(projectId: string, taskId: string): TaskAiAssigneeMock {
  return (
    readTaskAiAssigneeMap(projectId)[taskId] ?? {
      kind: 'human',
      agentRoleId: null,
      updatedAt: '',
    }
  )
}

export function writeTaskAiAssignee(
  projectId: string,
  taskId: string,
  next: Omit<TaskAiAssigneeMock, 'updatedAt'> & { updatedAt?: string },
): TaskAiAssigneeMock {
  const kind = next.kind
  const agentRoleId =
    kind === 'agent' ? MOCK_AI_ASSIGNEE_ROLE.id : null
  const record: TaskAiAssigneeMock = {
    kind,
    agentRoleId,
    updatedAt: next.updatedAt ?? new Date().toISOString(),
  }
  const map = readTaskAiAssigneeMap(projectId)
  // Persist explicit human|agent so list/detail stay consistent after refresh.
  map[taskId] = record
  localStorage.setItem(storageKey(projectId), JSON.stringify(map))
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
