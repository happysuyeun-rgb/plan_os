import type { PlanStep } from './humanPmPlanDraft'
import { generateDocumentViaBff } from './ai/generationBffClient'

export type AiSuggestedPlanSeed = {
  title: string
  description?: string
  targetUser?: string
}

export type AiSuggestedPlanDraft = {
  objective: string
  steps: PlanStep[]
  mode: 'gemini' | 'placeholder'
}

/**
 * Deterministic template fallback when BFF/Gemini is unavailable.
 * Labels must stay honest in UI (not a verified AI PM hire run).
 */
export function buildAiSuggestedPlanDraft(seed: AiSuggestedPlanSeed): AiSuggestedPlanDraft {
  const title = seed.title.trim() || '프로젝트'
  const audience = seed.targetUser?.trim() || '핵심 사용자'
  const focus = (seed.description?.trim() || title).slice(0, 120)

  const objective =
    `${title}의 다음 실행 단계를 정리합니다. 대상은 ${audience}이며, ` +
    `범위는 「${focus}」를 기준으로 합니다. (템플릿 폴백 · 실제 AI PM 채용 실행 아님)`

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

  return { objective: objective.slice(0, 1000), steps, mode: 'placeholder' }
}

function parsePlanFromMarkdown(content: string, seed: AiSuggestedPlanSeed): AiSuggestedPlanDraft | null {
  const text = content.trim()
  if (!text) return null

  const objectiveMatch =
    text.match(/##\s*목표\s*\n+([\s\S]*?)(?=\n##\s|$)/i) ||
    text.match(/##\s*Objective\s*\n+([\s\S]*?)(?=\n##\s|$)/i)
  let objective = (objectiveMatch?.[1] ?? '').trim().replace(/\n+/g, ' ')
  if (!objective) {
    const firstPara = text.split(/\n{2,}/)[0]?.replace(/^#+\s*/, '').trim() ?? ''
    objective = firstPara.slice(0, 1000)
  }
  if (!objective) {
    objective = `${seed.title.trim() || '프로젝트'} 실행 계획 초안`
  }

  const stepBlocks =
    text.match(/###\s*[^\n]+\n[\s\S]*?(?=\n###\s|$)/g) ||
    text.match(/^\d+\.\s+[^\n]+[\s\S]*?(?=^\d+\.\s+|\n##\s|$)/gm)

  const steps: PlanStep[] = []
  if (stepBlocks) {
    for (const block of stepBlocks.slice(0, 5)) {
      const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length === 0) continue
      const title = lines[0]
        .replace(/^###\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/^단계\s*\d+\s*[:：-]?\s*/i, '')
        .slice(0, 200)
      const criteriaLine =
        lines.find((l) => /완료|기준|acceptance/i.test(l)) ||
        lines.slice(1).join(' ').slice(0, 400) ||
        `${title}이(가) 완료되었음을 확인할 수 있다.`
      const acceptanceCriteria = criteriaLine
        .replace(/^[-*]\s*/, '')
        .replace(/^(완료\s*기준|acceptance)\s*[:：]\s*/i, '')
        .slice(0, 500)
      if (!title) continue
      steps.push({
        id: crypto.randomUUID(),
        title,
        acceptanceCriteria,
        dependsOn: null,
      })
    }
  }

  if (steps.length < 2) return null
  for (let i = 1; i < steps.length; i++) {
    steps[i].dependsOn = steps[i - 1].id
  }

  return {
    objective: objective.slice(0, 1000),
    steps,
    mode: 'gemini',
  }
}

/**
 * Prefer Gemini BFF (`mode=gemini`); fall back to deterministic template.
 * Does not start AI PM hire, payment, or worker execution.
 */
export async function buildAiSuggestedPlanDraftAsync(
  seed: AiSuggestedPlanSeed,
): Promise<AiSuggestedPlanDraft> {
  try {
    const result = await generateDocumentViaBff('prd', {
      title: seed.title,
      targetUser: seed.targetUser || '핵심 사용자',
      description: seed.description || seed.title,
      serviceType: 'web',
      interviewAnswers: {
        purpose: 'pm_plan_draft',
        instruction:
          '이 응답은 PRD가 아닙니다. 한국어 마크다운으로 ## 목표 한 단락과 ### 단계 제목 3개를 쓰고, 각 단계에 완료 기준 한 줄을 포함하세요. 결제·채용·성과 수치를 만들지 마세요.',
      },
    })
    if (result.mode === 'gemini') {
      const parsed = parsePlanFromMarkdown(result.content, seed)
      if (parsed) return parsed
    }
  } catch {
    // fall through to template
  }
  return buildAiSuggestedPlanDraft(seed)
}
