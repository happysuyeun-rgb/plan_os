import { MOCK_SPECIALIST } from './mockSpecialistRequest'

export type AiStaffCard = {
  id: string
  title: string
  description: string
  capability: string
  available: boolean
  /** Optional tracking note (issue / FUTURE). Display only. */
  futureRef?: string
}

/**
 * Visible roster: 1 hireable Mock role + upcoming placeholders.
 * #37/#38 are display seats only — no hire, payment, outbound, or LLM.
 */
export const AI_STAFF_ROSTER: AiStaffCard[] = [
  {
    id: MOCK_SPECIALIST.id,
    title: MOCK_SPECIALIST.title,
    description: MOCK_SPECIALIST.description,
    capability: MOCK_SPECIALIST.capability,
    available: true,
  },
  {
    id: 'ai_pm_planner_v1',
    title: 'AI PM 플래너',
    description: '업무 분해·일정·우선순위를 제안하는 역할입니다.',
    capability: '준비 중 · 채용 불가',
    available: false,
  },
  {
    id: 'ux_flow_reviewer_v1',
    title: 'UX 흐름 검수',
    description: '화면 흐름·빈 상태·오류 안내의 빈틈을 점검합니다.',
    capability: '준비 중 · 채용 불가',
    available: false,
  },
  {
    id: 'policy_drafter_v1',
    title: '정책서 초안 작성',
    description: '서비스 정책·약관 초안을 정리하는 역할입니다.',
    capability: '준비 중 · 채용 불가',
    available: false,
  },
  {
    id: 'ai_marketer_growth_v1',
    title: 'AI 마케터 (Growth/Content)',
    description:
      '포지셔닝·채널 콘텐츠 초안·캠페인 가설을 정리하는 후보 직무입니다. 실계정 게시·광고 집행·성과 날조는 없습니다.',
    capability: 'FUTURE · 준비 중 · 채용 불가 · 결제/유료 LLM 없음',
    available: false,
    futureRef: '#38',
  },
  {
    id: 'ai_sales_sdr_v1',
    title: 'AI 영업사원 (SDR)',
    description:
      '잠재 고객 적합성 검토·제안 초안·회신 분류를 돕는 후보 직무입니다. 무단 대량 발송·자동 계약·매출 확정은 없습니다.',
    capability: 'FUTURE · 준비 중 · 채용 불가 · 결제/유료 LLM 없음',
    available: false,
    futureRef: '#37',
  },
]

export function hireableAiStaff(): AiStaffCard[] {
  return AI_STAFF_ROSTER.filter((r) => r.available)
}

export function upcomingAiStaff(): AiStaffCard[] {
  return AI_STAFF_ROSTER.filter((r) => !r.available)
}
