import type { DocumentType } from '../../types'
import { buildPromptAlignedDraft } from '../generation/promptAlignedDraft'
import type {
  GenerationCallOptions,
  GenerationProvider,
  GenerationVars,
} from './GenerationProvider'

/** Deterministic stand-in used until a real LLM provider is approved. */
export class PlaceholderProvider implements GenerationProvider {
  readonly id = 'placeholder'

  async generateDocument(
    type: DocumentType,
    vars: GenerationVars,
    options?: GenerationCallOptions,
  ): Promise<string> {
    if (options?.signal?.aborted) {
      const err = new Error('Generation aborted')
      err.name = 'AbortError'
      throw err
    }
    return buildPromptAlignedDraft(type, {
      title: vars.title,
      targetUser: vars.targetUser,
      description: vars.description,
      serviceType: vars.serviceType,
      interviewAnswers: vars.interviewAnswers,
    })
  }
}
