import { MARKET_RESEARCHER } from './marketResearchStaff'
import { MOCK_SPECIALIST } from './mockSpecialistRequest'

/** Filter chips on the AI staffing marketplace. */
export type AiStaffCategory = 'research' | 'planning' | 'pm' | 'design' | 'marketing'

export const AI_STAFF_CATEGORY_FILTERS: { id: 'all' | AiStaffCategory; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'research', label: '리서치' },
  { id: 'planning', label: '기획·검토' },
  { id: 'pm', label: 'PM' },
  { id: 'design', label: '디자인' },
  { id: 'marketing', label: '마케팅' },
]

export type AiStaffCard = {
  id: string
  title: string
  /** Compact label for upcoming avatar row */
  shortTitle: string
  description: string
  capability: string
  available: boolean
  category: AiStaffCategory
  tags: string[]
  /**
   * Hireable status chip only. live = real provider path; queue = CrewAI worker queue.
   * Never invent paid/LLM success.
   */
  execKind?: 'live' | 'queue'
  /** Optional tracking note (issue / FUTURE). Display only. */
  futureRef?: string
  /** Hire CTA path suffix under /projects/:id/specialists/ */
  requestPath?: string
  /**
   * Public image path under /public (e.g. `/ai-staff/market-researcher.png`).
   * Omit until assets are provided — UI shows a layout placeholder.
   */
  imageSrc?: string
  /** When true, omit from marketplace hireable + upcoming lists (route may still exist). */
  catalogHidden?: boolean
}

/**
 * Visible roster: hireable live/mock roles + upcoming placeholders.
 * #37/#38 are display seats only — no hire, payment, outbound, or LLM.
 * Market researcher available flag flips only after live Liner verification.
 */
export const AI_STAFF_ROSTER: AiStaffCard[] = [
  {
    id: MOCK_SPECIALIST.id,
    title: MOCK_SPECIALIST.title,
    shortTitle: '요구사항 검수',
    description: MOCK_SPECIALIST.description,
    capability: '일시 숨김 · 채용 불가',
    // Preview focus: market research only — hide requirements auditor from marketplace.
    available: false,
    catalogHidden: true,
    category: 'planning',
    tags: ['문서검수', '누락점검', '수락기준'],
    execKind: 'queue',
    requestPath: 'request',
    // Drop file at public/ai-staff/requirements-auditor.png
    imageSrc: '/ai-staff/requirements-auditor.png',
  },
  {
    id: MARKET_RESEARCHER.id,
    title: MARKET_RESEARCHER.title,
    shortTitle: '시장조사',
    description: MARKET_RESEARCHER.description,
    capability: MARKET_RESEARCHER.capability,
    // Live Liner Search Agent + Web Search verified 2026-11-14 (research-local).
    available: true,
    category: 'research',
    tags: ['경쟁사분석', '시장조사', '트렌드'],
    execKind: 'live',
    requestPath: 'market-research',
    imageSrc: '/ai-staff/market-researcher.png',
  },
  {
    id: 'ai_pm_planner_v1',
    title: 'AI PM 플래너',
    shortTitle: 'AI PM',
    description: '업무 분해·일정·우선순위를 제안하는 역할입니다.',
    capability: '준비 중 · 채용 불가',
    available: false,
    category: 'pm',
    tags: ['업무분해', '일정', '우선순위'],
    imageSrc: '/ai-staff/ai-pm.png',
  },
  {
    id: 'ux_flow_reviewer_v1',
    title: 'UX 흐름 검수',
    shortTitle: 'UX 검토',
    description: '화면 흐름·빈 상태·오류 안내의 빈틈을 점검합니다.',
    capability: '준비 중 · 채용 불가',
    available: false,
    category: 'design',
    tags: ['화면흐름', '빈상태', '오류안내'],
    imageSrc: '/ai-staff/ux-reviewer.png',
  },
  {
    id: 'policy_drafter_v1',
    title: '정책서 초안 작성',
    shortTitle: '정책 기획',
    description: '서비스 정책·약관 초안을 정리하는 역할입니다.',
    capability: '준비 중 · 채용 불가',
    available: false,
    category: 'planning',
    tags: ['정책', '약관', '초안'],
    imageSrc: '/ai-staff/policy-drafter.png',
  },
  {
    id: 'ai_marketer_growth_v1',
    title: 'AI 마케터 (Growth/Content)',
    shortTitle: '마케팅',
    description:
      '포지셔닝·채널 콘텐츠 초안·캠페인 가설을 정리하는 후보 직무입니다. 실계정 게시·광고 집행·성과 날조는 없습니다.',
    capability: 'FUTURE · 준비 중 · 채용 불가 · 결제/유료 LLM 없음',
    available: false,
    category: 'marketing',
    tags: ['콘텐츠', '포지셔닝', '캠페인'],
    futureRef: '#38',
    imageSrc: '/ai-staff/marketer.png',
  },
  {
    id: 'ai_sales_sdr_v1',
    title: 'AI 영업사원 (SDR)',
    shortTitle: '영업',
    description:
      '잠재 고객 적합성 검토·제안 초안·회신 분류를 돕는 후보 직무입니다. 무단 대량 발송·자동 계약·매출 확정은 없습니다.',
    capability: 'FUTURE · 준비 중 · 채용 불가 · 결제/유료 LLM 없음',
    available: false,
    category: 'marketing',
    tags: ['리드검토', '제안초안', '회신분류'],
    futureRef: '#37',
    imageSrc: '/ai-staff/sales.png',
  },
]

export function hireableAiStaff(): AiStaffCard[] {
  return AI_STAFF_ROSTER.filter((r) => r.available && !r.catalogHidden)
}

export function upcomingAiStaff(): AiStaffCard[] {
  return AI_STAFF_ROSTER.filter((r) => !r.available && !r.catalogHidden)
}

export function filterAiStaffByCategory(
  roles: AiStaffCard[],
  category: 'all' | AiStaffCategory,
): AiStaffCard[] {
  if (category === 'all') return roles
  return roles.filter((r) => r.category === category)
}

export function execBadgeLabel(role: AiStaffCard): string | null {
  if (!role.available) return null
  if (role.execKind === 'live') return '실제 실행'
  if (role.execKind === 'queue') return '큐 실행'
  return '채용 가능'
}
