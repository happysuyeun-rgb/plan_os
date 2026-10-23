/**
 * Usage / cost ceiling for AI generation (Phase C).
 * Enforced on the BFF before any provider call. Defaults are safe (zero paid spend).
 */

import { readAiSecret } from './secrets'

export type BudgetSnapshot = {
  tokensUsed: number
  costUsdUsed: number
  tokenCap: number
  costCapUsd: number
}

export type BudgetDecision =
  | { ok: true }
  | { ok: false; reason: 'token_cap' | 'cost_cap' | 'paid_calls_disabled' }

const DEFAULT_TOKEN_CAP = 0
const DEFAULT_COST_CAP = 0

export function readBudgetCaps(): { tokenCap: number; costCapUsd: number } {
  const tokenCap = Number(readAiSecret('PLANOS_AI_MONTHLY_TOKEN_CAP') ?? DEFAULT_TOKEN_CAP)
  const costCapUsd = Number(readAiSecret('PLANOS_AI_MONTHLY_COST_CAP_USD') ?? DEFAULT_COST_CAP)
  return {
    tokenCap: Number.isFinite(tokenCap) ? tokenCap : DEFAULT_TOKEN_CAP,
    costCapUsd: Number.isFinite(costCapUsd) ? costCapUsd : DEFAULT_COST_CAP,
  }
}

/**
 * Refuse paid provider traffic unless caps are explicitly raised by ops.
 * Placeholder / offline generation does not consume this budget.
 */
export function assertPaidCallAllowed(
  snapshot: BudgetSnapshot,
  estimate: { tokens: number; costUsd: number },
  opts: { allowPaidCalls: boolean },
): BudgetDecision {
  if (!opts.allowPaidCalls) {
    return { ok: false, reason: 'paid_calls_disabled' }
  }
  if (snapshot.tokenCap <= 0 || snapshot.costCapUsd <= 0) {
    return { ok: false, reason: 'paid_calls_disabled' }
  }
  if (snapshot.tokensUsed + estimate.tokens > snapshot.tokenCap) {
    return { ok: false, reason: 'token_cap' }
  }
  if (snapshot.costUsdUsed + estimate.costUsd > snapshot.costCapUsd) {
    return { ok: false, reason: 'cost_cap' }
  }
  return { ok: true }
}
