/** PlanOS ai_market_researcher_v1 — live Liner research staff (not Mock-only). */

export const MARKET_RESEARCHER = {
  id: 'ai_market_researcher_v1',
  title: 'AI 시장조사·리서치 전문가',
  description:
    '산업·경쟁사·가격·고객 문제를 Liner 검색 API로 조사하고 출처 포함 보고서를 작성합니다.',
  capability: 'Liner Search/Web 실호출 · 외부 게시·메일 금지',
} as const

export const MARKET_RESEARCH_TERMS_VERSION = 'ai_market_researcher_v1_terms_2026-11-14' as const

export const MARKET_RESEARCH_CONSENT_STATEMENT =
  'Liner 검색·웹조사·보고서 작성만 승인하며 외부 게시·메일·임의 파일 수정은 금지합니다.' as const

/** Soft USD-cent ceiling ($5.00) for hackathon credit — not a card charge. */
export const MARKET_RESEARCH_BUDGET_CAP_MINOR = 500 as const

export const MARKET_RESEARCH_TERMS_SUMMARY = [
  'Liner Search Agent / Web Search 실호출 허용 (owner 승인 후)',
  'Deep Research는 사용자가 심층 조사 선택 시에만',
  '외부 게시·메일 발송·임의 파일 수정 금지',
  '예산 상한은 해커톤 크레딧 소프트 한도(USD $5)',
  'S2 audit manifest가 최신이어야 계약·실행 가능',
] as const

export type ResearchRegion = 'KR' | 'US' | 'GLOBAL'
export type ResearchDepth = 'standard' | 'deep'

export function validateMarketResearchInput(input: {
  researchTarget: string
  task: string
  acceptanceCriteria: string
  region: string
  researchDepth: string
}): string | null {
  const target = input.researchTarget.trim()
  const task = input.task.trim()
  const criteria = input.acceptanceCriteria.trim()
  if (target.length < 4 || target.length > 500) return '조사 대상은 4~500자로 작성해 주세요.'
  if (task.length < 10 || task.length > 1000) return '업무 요청은 10~1000자로 작성해 주세요.'
  if (criteria.length < 5 || criteria.length > 500) return '완료 기준은 5~500자로 작성해 주세요.'
  if (!['KR', 'US', 'GLOBAL'].includes(input.region)) return '지역을 선택해 주세요.'
  if (!['standard', 'deep'].includes(input.researchDepth)) return '조사 수준을 선택해 주세요.'
  return null
}
