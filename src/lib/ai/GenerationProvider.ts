import type { DocumentType } from '../../types'

/** Variables that every generation provider may interpolate into a document. */
export type GenerationVars = {
  title: string
  targetUser: string
}

/** Per-call options: abort, correlation for retry/history. */
export type GenerationCallOptions = {
  signal?: AbortSignal
  /** Client/BFF correlation id for retry and audit history. */
  attemptId?: string
  /** 0-based retry index when the BFF re-issues after a failed attempt. */
  retryIndex?: number
}

/**
 * Server-side (or BFF) contract for document generation.
 * Browser code must never hold provider API secrets; call through a proxy.
 * Paid / networked providers require a separate user approval gate.
 */
export interface GenerationProvider {
  readonly id: string
  generateDocument(
    type: DocumentType,
    vars: GenerationVars,
    options?: GenerationCallOptions,
  ): Promise<string>
}

export type ProviderSelection = {
  /** Defaults to the placeholder provider until a real LLM is approved. */
  preferredId?: string
}

/** Outcome recorded by the BFF for fail / retry / abort auditing (in-memory until ops approve durable ledger). */
export type GenerationAttemptRecord = {
  attemptId: string
  providerId: string
  mode: 'placeholder' | 'paid'
  documentType: DocumentType
  status: 'ok' | 'failed' | 'aborted' | 'budget_blocked'
  retryIndex: number
  errorMessage?: string
  startedAt: string
  finishedAt: string
}
