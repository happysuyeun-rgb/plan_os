/** Client display copy for F-A Mock terms. Digest is computed server-side only. */
export const AGENT_CONTRACT_TERMS_VERSION = 'requirements_auditor_v1_terms_2026-10-27' as const

export const AGENT_CONTRACT_CONSENT_STATEMENT =
  'Mock 실행만 승인하며 유료 LLM을 호출하지 않습니다.' as const

/** Mock budget ceiling in KRW minor units (₩). Zero = no paid spend authorized. */
export const MOCK_BUDGET_CAP_MINOR = 0 as const

export const AGENT_CONTRACT_TERMS_SUMMARY = [
  '유료 LLM·외부 전송·실공급사 과금 금지',
  'owner 명시 동의 후에만 Mock worker 실행 가능 (F-B)',
  '예산 상한은 Mock 한도이며 결제 승인이 아님',
  'S2 audit manifest가 최신이어야 계약·실행 가능',
] as const
