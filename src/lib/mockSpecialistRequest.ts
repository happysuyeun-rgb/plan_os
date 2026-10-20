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
