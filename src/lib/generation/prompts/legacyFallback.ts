import type { DocumentType } from '../../../types'
import { DOCUMENT_TYPE_LABELS } from '../../../types'
import type { PromptBundle } from './types'

/** Temporary bundles until type-specific prompts are supplied. */
export function legacyPromptBundle(type: DocumentType): PromptBundle {
  const label = DOCUMENT_TYPE_LABELS[type] ?? type
  return {
    system: `당신은 PlanOS의 시니어 프로덕트 라이터입니다. 요청 산출물: ${label} (${type}).`,
    outline: `실무에서 바로 쓸 수 있게 구체적 섹션·체크리스트·예시를 포함한 한국어 Markdown으로 작성하세요.
첫 제목에는 프로젝트명을 포함하세요.
정보가 부족하면 \`[결정 필요]\`로 표시하고 확인할 질문을 제시하세요.`,
  }
}
