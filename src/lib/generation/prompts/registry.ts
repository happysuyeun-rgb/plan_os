import type { DocumentType } from '../../../types'
import { IA_OUTLINE } from './ia/outline'
import { IA_SYSTEM } from './ia/system'
import { legacyPromptBundle } from './legacyFallback'
import { PRD_OUTLINE } from './prd/outline'
import { PRD_SYSTEM } from './prd/system'
import type { PromptBundle } from './types'

const BUNDLES: Partial<Record<DocumentType, PromptBundle>> = {
  prd: {
    system: PRD_SYSTEM,
    outline: PRD_OUTLINE,
  },
  ia: {
    system: IA_SYSTEM,
    outline: IA_OUTLINE,
  },
}

export function getPromptBundle(type: DocumentType): PromptBundle {
  return BUNDLES[type] ?? legacyPromptBundle(type)
}

export function hasSpecializedPrompt(type: DocumentType): boolean {
  return Boolean(BUNDLES[type])
}
