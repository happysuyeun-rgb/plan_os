/** Vercel-safe prompt types — no imports from src/. */
export type ApiDocumentType =
  | 'prd'
  | 'ia'
  | 'screen_list'
  | 'policy'
  | 'wireframe'
  | 'cursor_prompt'

export type ApiGenerationVars = {
  title: string
  targetUser: string
  description?: string
  serviceType?: string
  interviewAnswers?: Record<string, string>
  approvedDecisions?: string
  approvedSourceDocuments?: Partial<Record<ApiDocumentType, string>>
  priorDocuments?: Partial<Record<ApiDocumentType, string>>
}

export type ApiPromptBundle = {
  system: string
  outline: string
  schema?: string
}
