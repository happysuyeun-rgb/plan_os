/** F-401: manually authored PM plan draft. No AI call, DB write, approval or execution. */
export type PlanStep = { id: string; title: string; acceptanceCriteria: string; dependsOn: string | null }
export type HumanPlanDraft = { projectId: string; objective: string; status: 'draft'; steps: PlanStep[] }

export function validateHumanPlan(input: HumanPlanDraft): string | null {
  if (!input.projectId.trim()) return '?꾨줈?앺듃瑜??좏깮??二쇱꽭??'
  if (input.objective.trim().length < 10 || input.objective.trim().length > 1000) return '紐⑺몴??10~1000?먮줈 ?낅젰?섏꽭??'
  if (!input.steps.length || input.steps.length > 20) return '?④퀎??1~20媛쒕줈 援ъ꽦?섏꽭??'
  const ids = new Set<string>()
  for (const step of input.steps) {
    if (!step.id || ids.has(step.id)) return '?④퀎 ?앸퀎?먭? 以묐났?섍굅???꾨씫?섏뿀?듬땲??'
    ids.add(step.id)
    if (!step.title.trim() || step.title.trim().length > 120) return '?④퀎 ?쒕ぉ? 1~120?먮줈 ?묒꽦?섏꽭??'
    if (step.acceptanceCriteria.trim().length < 5 || step.acceptanceCriteria.trim().length > 500) return '媛??④퀎???꾨즺 湲곗?? 5~500?먮줈 ?묒꽦?섏꽭??'
  }
  for (let i = 0; i < input.steps.length; i++) {
    const d = input.steps[i].dependsOn
    if (d && !input.steps.slice(0, i).some((s) => s.id === d)) return '?좏뻾 ?④퀎???꾩옱 ?④퀎蹂대떎 ?욎뿉 ?덉뼱???⑸땲??'
  }
  return null
}
export function createHumanPlanDraft(input: HumanPlanDraft): HumanPlanDraft {
  const error = validateHumanPlan(input)
  if (error) throw new Error(error)
  return { ...input, objective: input.objective.trim(), status: 'draft', steps: input.steps.map(s => ({ ...s, title: s.title.trim(), acceptanceCriteria: s.acceptanceCriteria.trim() })) }
}
