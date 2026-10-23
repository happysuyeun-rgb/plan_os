import type { DocumentType } from '../../types'
import { buildGeneratedContent } from '../generation/placeholderContent'
import type { GenerationProvider, GenerationVars } from './GenerationProvider'

/** Deterministic stand-in used until a real LLM provider is approved. */
export class PlaceholderProvider implements GenerationProvider {
  readonly id = 'placeholder'

  async generateDocument(type: DocumentType, vars: GenerationVars): Promise<string> {
    return buildGeneratedContent(type, vars)
  }
}
