/** F-301 mock: no persistence, model execution, payment, or data transfer. */
export const MOCK_SPECIALIST = {
  id: 'requirements_auditor_v1',
  title: '요구사항 검수 전문가',
  description: '기획 문서의 누락·불일치·검증 기준을 검토하는 역할입니다.',
  capability: '요청 초안 작성만 가능 (현재 AI 실행 불가)',
  tools: [] as string[],
} as const

export interface MockRequest {
  roleId: string
  task: string
  acceptanceCriteria: string
  projectId: string
  status: 'draft'
}

export function validateMockRequest(input: Omit<MockRequest, 'status'>): string | null {
  if (input.roleId !== MOCK_SPECIALIST.id) return '지원되지 않는 전문가입니다.'
  if (!input.projectId.trim()) return '프로젝트가 필요합니다.'
  if (input.task.trim().length < 10 || input.task.trim().length > 1000) {
    return '업무 요청은 10~1000자로 작성해 주세요.'
  }
  if (input.acceptanceCriteria.trim().length < 5 || input.acceptanceCriteria.trim().length > 500) {
    return '완료 기준은 5~500자로 작성해 주세요.'
  }
  return null
}

export function createMockDraft(input: Omit<MockRequest, 'status'>): MockRequest {
  const error = validateMockRequest(input)
  if (error) throw new Error(error)
  return { ...input, task: input.task.trim(), acceptanceCriteria: input.acceptanceCriteria.trim(), status: 'draft' }
}

/** Preview acknowledgement is NOT a legally valid contract or execution approval. */
export interface MockContractReview {
  request: MockRequest
  status: 'review_only'
  actualExecutionAllowed: false
  externalTransferAllowed: false
  billingAllowed: false
}

export function previewMockContract(request: MockRequest, readNotice: boolean): MockContractReview {
  if (request.status !== 'draft' || !readNotice) {
    throw new Error('실행 제한 안내를 확인해야 검토 화면으로 이동할 수 있습니다.')
  }
  return {
    request,
    status: 'review_only',
    actualExecutionAllowed: false,
    externalTransferAllowed: false,
    billingAllowed: false,
  }
}

/** F-303 display-only budget gate. Unknown prices MUST NOT be represented as ₩0. */
export type MockBudgetReview = {
  status: 'pricing_unavailable'
  estimatedCost: null
  currency: null
  maximumCharge: null
  actualExecutionAllowed: false
  reason: string
}

export function getMockBudgetReview(review: MockContractReview): MockBudgetReview {
  if (review.status !== 'review_only' || review.actualExecutionAllowed !== false) {
    throw new Error('먼저 모의 계약 검토를 완료해야 합니다.')
  }
  return {
    status: 'pricing_unavailable',
    estimatedCost: null,
    currency: null,
    maximumCharge: null,
    actualExecutionAllowed: false,
    reason: '모델 제공사·요금·예산 상한이 승인되지 않아 실제 실행이나 결제를 진행할 수 없습니다.',
  }
}
