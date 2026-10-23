import type { DocumentType } from '../../types'

/** Variables that every generation provider may interpolate into a document. */
export type GenerationVars = {
  title: string
  targetUser: string
}

/**
 * Server-side (or BFF) contract for document generation.
 * Browser code must never hold provider API secrets; call through a proxy.
 * Paid / networked providers require a separate user approval gate.
 */
export interface GenerationProvider {
  readonly id: string
  generateDocument(type: DocumentType, vars: GenerationVars): Promise<string>
}

export type ProviderSelection = {
  /** Defaults to the placeholder provider until a real LLM is approved. */
  preferredId?: string
}
