/**
 * Generation BFF entry (Phase C). Browser callers should POST here instead of
 * holding provider secrets. Until a paid provider is approved, only the
 * placeholder provider runs and responses are marked `mode: 'placeholder'`.
 */

import type { DocumentType } from '../../types'
import { resolveGenerationProvider } from '../../lib/ai/providerRegistry'
import type { GenerationVars } from '../../lib/ai/GenerationProvider'
import { assertPaidCallAllowed, readBudgetCaps, type BudgetSnapshot } from './budget'
import { hasPaidProviderCredentials } from './secrets'

export type GenerationBffRequest = {
  documentType: DocumentType
  vars: GenerationVars
  /** Explicit opt-in; default false — never call paid APIs without approval. */
  allowPaidCalls?: boolean
  usage?: BudgetSnapshot
}

export type GenerationBffResponse = {
  mode: 'placeholder' | 'paid'
  providerId: string
  content: string
  budget: ReturnType<typeof readBudgetCaps>
}

export async function handleGenerationRequest(
  req: GenerationBffRequest,
): Promise<GenerationBffResponse> {
  const allowPaid = req.allowPaidCalls === true
  const caps = readBudgetCaps()
  const usage = req.usage ?? {
    tokensUsed: 0,
    costUsdUsed: 0,
    tokenCap: caps.tokenCap,
    costCapUsd: caps.costCapUsd,
  }

  if (allowPaid && hasPaidProviderCredentials()) {
    const decision = assertPaidCallAllowed(usage, { tokens: 1, costUsd: 0.01 }, { allowPaidCalls: true })
    if (!decision.ok) {
      throw new Error(`Paid generation blocked: ${decision.reason}`)
    }
    // Real provider adapters are not registered until spend is approved.
    throw new Error('Paid generation provider is not registered; approval required')
  }

  const provider = resolveGenerationProvider({ preferredId: 'placeholder' })
  const content = await provider.generateDocument(req.documentType, req.vars)
  return {
    mode: 'placeholder',
    providerId: provider.id,
    content,
    budget: caps,
  }
}
