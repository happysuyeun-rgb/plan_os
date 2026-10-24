/**
 * F-401: manually authored PM plan draft contract (PR #27 origin).
 * Validation only: no AI call is made from this module.
 */
export type PlanStep = { id: string; title: string; acceptanceCriteria: string; dependsOn: string | null }
export type HumanPlanDraft = { projectId: string; objective: string; status: 'draft'; steps: PlanStep[] }

export function validateHumanPlan(input: HumanPlanDraft): string | null {
  if (!input.projectId.trim()) return '프로젝트를 선택해주세요.'
  if (input.objective.trim().length < 10 || input.objective.trim().length > 1000) return '목표는 10~1000자로 입력해주세요.'
  if (!input.steps.length || input.steps.length > 20) return '단계는 1~20개로 구성해주세요.'
  const ids = new Set<string>()
  for (const step of input.steps) {
    if (!step.id || ids.has(step.id)) return '단계 식별자가 중복되거나 누락되었습니다.'
    ids.add(step.id)
    if (!step.title.trim() || step.title.trim().length > 120) return '단계 제목은 1~120자로 작성해주세요.'
    if (step.acceptanceCriteria.trim().length < 5 || step.acceptanceCriteria.trim().length > 500) return '각 단계의 완료 기준은 5~500자로 작성해주세요.'
  }
  for (let i = 0; i < input.steps.length; i++) {
    const d = input.steps[i].dependsOn
    if (d && !input.steps.slice(0, i).some((s) => s.id === d)) return '선행 단계는 현재 단계보다 앞에 있어야 합니다.'
  }
  return null
}

export function createHumanPlanDraft(input: HumanPlanDraft): HumanPlanDraft {
  const error = validateHumanPlan(input)
  if (error) throw new Error(error)
  return {
    ...input,
    objective: input.objective.trim(),
    status: 'draft',
    steps: input.steps.map((s) => ({ ...s, title: s.title.trim(), acceptanceCriteria: s.acceptanceCriteria.trim() })),
  }
}
