/**
 * Generation BFF entry (Phase C). Browser callers should POST here instead of
 * holding provider secrets. Until a paid provider is approved, only the
 * placeholder provider runs and responses are marked `mode: 'placeholder'`.
 */

import type { DocumentType } from '../../types'
import { resolveGenerationProvider } from '../../lib/ai/providerRegistry'
import type { GenerationVars } from '../../lib/ai/GenerationProvider'
import { assertPaidCallAllowed, readBudgetCaps, type BudgetSnapshot } from './budget'
import { appendGenerationAttempt } from './generationAttemptLog'
import { hasPaidProviderCredentials } from './secrets'

export type GenerationBffRequest = {
  documentType: DocumentType
  vars: GenerationVars
  /** Explicit opt-in; default false — never call paid APIs without approval. */
  allowPaidCalls?: boolean
  usage?: BudgetSnapshot
  signal?: AbortSignal
  attemptId?: string
  retryIndex?: number
}

export type GenerationBffResponse = {
  mode: 'placeholder' | 'paid'
  providerId: string
  content: string
  budget: ReturnType<typeof readBudgetCaps>
  attemptId: string
  /** Set by HTTP adapters — vite-dev vs vercel-preview. */
  runtime?: 'vite-dev' | 'vercel-preview'
}

function stamp() {
  return new Date().toISOString()
}

export async function handleGenerationRequest(
  req: GenerationBffRequest,
): Promise<GenerationBffResponse> {
  const attemptId = req.attemptId ?? crypto.randomUUID()
  const retryIndex = req.retryIndex ?? 0
  const startedAt = stamp()
  const allowPaid = req.allowPaidCalls === true
  const caps = readBudgetCaps()
  const usage = req.usage ?? {
    tokensUsed: 0,
    costUsdUsed: 0,
    tokenCap: caps.tokenCap,
    costCapUsd: caps.costCapUsd,
  }

  if (req.signal?.aborted) {
    appendGenerationAttempt({
      attemptId,
      providerId: 'none',
      mode: 'placeholder',
      documentType: req.documentType,
      status: 'aborted',
      retryIndex,
      errorMessage: 'aborted before start',
      startedAt,
      finishedAt: stamp(),
    })
    const abortErr = new Error('Generation aborted')
    abortErr.name = 'AbortError'
    throw abortErr
  }

  if (allowPaid && hasPaidProviderCredentials()) {
    const decision = assertPaidCallAllowed(usage, { tokens: 1, costUsd: 0.01 }, { allowPaidCalls: true })
    if (!decision.ok) {
      appendGenerationAttempt({
        attemptId,
        providerId: 'paid-unregistered',
        mode: 'paid',
        documentType: req.documentType,
        status: 'budget_blocked',
        retryIndex,
        errorMessage: decision.reason,
        startedAt,
        finishedAt: stamp(),
      })
      throw new Error(`Paid generation blocked: ${decision.reason}`)
    }
    appendGenerationAttempt({
      attemptId,
      providerId: 'paid-unregistered',
      mode: 'paid',
      documentType: req.documentType,
      status: 'failed',
      retryIndex,
      errorMessage: 'Paid generation provider is not registered; approval required',
      startedAt,
      finishedAt: stamp(),
    })
    throw new Error('Paid generation provider is not registered; approval required')
  }

  const provider = resolveGenerationProvider({ preferredId: 'placeholder' })
  try {
    const content = await provider.generateDocument(req.documentType, req.vars, {
      signal: req.signal,
      attemptId,
      retryIndex,
    })
    appendGenerationAttempt({
      attemptId,
      providerId: provider.id,
      mode: 'placeholder',
      documentType: req.documentType,
      status: 'ok',
      retryIndex,
      startedAt,
      finishedAt: stamp(),
    })
    return {
      mode: 'placeholder',
      providerId: provider.id,
      content,
      budget: caps,
      attemptId,
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    appendGenerationAttempt({
      attemptId,
      providerId: provider.id,
      mode: 'placeholder',
      documentType: req.documentType,
      status: aborted ? 'aborted' : 'failed',
      retryIndex,
      errorMessage: err instanceof Error ? err.message : 'generation failed',
      startedAt,
      finishedAt: stamp(),
    })
    throw err
  }
}
