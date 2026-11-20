import type { DocumentType } from '../../../types'

export type PromptBundle = {
  system: string
  outline: string
  schema?: string
}

/** Optional upstream artifacts / decisions for consistency. */
export type PromptContextPack = {
  approvedDecisions?: string
  /** Full or summarized approved docs keyed by type. */
  approvedSourceDocuments?: Partial<Record<DocumentType, string>>
  /** In-pipeline prior docs (may include drafts not yet approved). */
  priorDocuments?: Partial<Record<DocumentType, string>>
}
