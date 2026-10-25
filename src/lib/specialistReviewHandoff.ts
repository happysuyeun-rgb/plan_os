import { MOCK_SPECIALIST, type MockRequest } from './mockSpecialistRequest'

/** Session-only bridge from S3 hire mock → /ai-review. Not a contract or hire record. */
export const SPECIALIST_REVIEW_HANDOFF_KEY = 'planos-specialist-review-handoff'

export interface SpecialistReviewHandoff {
  projectId: string
  roleId: string
  task: string
  acceptanceCriteria: string
  createdAt: string
  mockOnly: true
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function buildHandoffFromDraft(draft: MockRequest): SpecialistReviewHandoff {
  if (draft.status !== 'draft') throw new Error('초안 상태에서만 검수 화면으로 이어갈 수 있습니다.')
  if (draft.roleId !== MOCK_SPECIALIST.id) throw new Error('지원되지 않는 전문가입니다.')
  if (!draft.projectId.trim()) throw new Error('프로젝트가 필요합니다.')
  return {
    projectId: draft.projectId.trim(),
    roleId: draft.roleId,
    task: draft.task.trim(),
    acceptanceCriteria: draft.acceptanceCriteria.trim(),
    createdAt: new Date().toISOString(),
    mockOnly: true,
  }
}

export function validateHandoff(raw: unknown): SpecialistReviewHandoff | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.mockOnly !== true) return null
  if (o.roleId !== MOCK_SPECIALIST.id) return null
  if (typeof o.projectId !== 'string' || !o.projectId.trim()) return null
  if (typeof o.task !== 'string' || o.task.trim().length < 10) return null
  if (typeof o.acceptanceCriteria !== 'string' || o.acceptanceCriteria.trim().length < 5) return null
  if (typeof o.createdAt !== 'string' || !o.createdAt) return null
  return {
    projectId: o.projectId.trim(),
    roleId: MOCK_SPECIALIST.id,
    task: o.task.trim(),
    acceptanceCriteria: o.acceptanceCriteria.trim(),
    createdAt: o.createdAt,
    mockOnly: true,
  }
}

export function writeSpecialistReviewHandoff(
  payload: SpecialistReviewHandoff,
  storage: StorageLike = sessionStorage,
): void {
  const valid = validateHandoff(payload)
  if (!valid) throw new Error('유효하지 않은 핸드오프입니다.')
  storage.setItem(SPECIALIST_REVIEW_HANDOFF_KEY, JSON.stringify(valid))
}

/** Consume-once: returns payload for matching projectId, then clears storage. */
export function consumeSpecialistReviewHandoff(
  projectId: string,
  storage: StorageLike = sessionStorage,
): SpecialistReviewHandoff | null {
  const raw = storage.getItem(SPECIALIST_REVIEW_HANDOFF_KEY)
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    storage.removeItem(SPECIALIST_REVIEW_HANDOFF_KEY)
    return null
  }
  const valid = validateHandoff(parsed)
  storage.removeItem(SPECIALIST_REVIEW_HANDOFF_KEY)
  if (!valid || valid.projectId !== projectId) return null
  return valid
}
