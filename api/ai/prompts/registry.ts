import { IA_OUTLINE } from './ia/outline.js'
import { IA_SYSTEM } from './ia/system.js'
import { PRD_OUTLINE } from './prd/outline.js'
import { PRD_SYSTEM } from './prd/system.js'
import type { ApiDocumentType, ApiPromptBundle } from './types.js'

const LABELS: Record<ApiDocumentType, string> = {
  prd: 'PRD',
  ia: '기능정의서',
  screen_list: '화면목록',
  policy: '정책서',
  wireframe: '와이어프레임',
  cursor_prompt: 'Cursor 프롬프트',
}

const BUNDLES: Partial<Record<ApiDocumentType, ApiPromptBundle>> = {
  prd: { system: PRD_SYSTEM, outline: PRD_OUTLINE },
  ia: { system: IA_SYSTEM, outline: IA_OUTLINE },
}

function legacyBundle(type: ApiDocumentType): ApiPromptBundle {
  const label = LABELS[type] ?? type
  return {
    system: `당신은 PlanOS의 시니어 프로덕트 라이터입니다. 요청 산출물: ${label} (${type}).`,
    outline: `실무에서 바로 쓸 수 있게 구체적 섹션·체크리스트·예시를 포함한 한국어 Markdown으로 작성하세요.
첫 제목에는 프로젝트명을 포함하세요.
정보가 부족하면 \`[결정 필요]\`로 표시하고 확인할 질문을 제시하세요.`,
  }
}

export function getApiPromptBundle(type: ApiDocumentType): ApiPromptBundle {
  return BUNDLES[type] ?? legacyBundle(type)
}

export function apiPromptKind(type: ApiDocumentType): 'prd' | 'ia' | 'legacy' {
  if (type === 'prd') return 'prd'
  if (type === 'ia') return 'ia'
  return 'legacy'
}
