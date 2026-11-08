import type { PlanStep } from './humanPmPlanDraft'

export type AiSuggestedPlanSeed = {
  title: string
  description?: string
  targetUser?: string
}

/**
 * Deterministic Mock template for `source=ai_suggested`.
 * Not a verified LLM / AI PM run — labels must stay honest in UI.
 */
export function buildAiSuggestedPlanDraft(seed: AiSuggestedPlanSeed): {
  objective: string
  steps: PlanStep[]
} {
  const title = seed.title.trim() || '프로젝트'
  const audience = seed.targetUser?.trim() || '핵심 사용자'
  const focus = (seed.description?.trim() || title).slice(0, 120)

  const objective =
    `${title}의 다음 실행 단계를 정리합니다. 대상은 ${audience}이며, ` +
    `범위는 「${focus}」를 기준으로 합니다. (AI 제안 Mock · 실제 AI PM 실행 아님)`

  const steps: PlanStep[] = [
    {
      id: crypto.randomUUID(),
      title: '현재 문서·업무 상태 점검',
      acceptanceCriteria: '관련 PRD/기능명세와 미완 업무 목록을 확인했고, 우선순위 1건을 명시했다.',
      dependsOn: null,
    },
    {
      id: crypto.randomUUID(),
      title: '다음 산출물 초안 범위 확정',
      acceptanceCriteria: '수정할 문서 타입과 완료 기준을 한 문장으로 적었고, 범위 밖 항목을 제외했다.',
      dependsOn: null,
    },
    {
      id: crypto.randomUUID(),
      title: '소유자 검토 포인트 정리',
      acceptanceCriteria: '승인 전 확인할 위험(권한·데이터·일정)을 3개 이하로 적었다.',
      dependsOn: null,
    },
  ]
  steps[1].dependsOn = steps[0].id
  steps[2].dependsOn = steps[1].id

  return { objective: objective.slice(0, 1000), steps }
}
