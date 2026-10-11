import type { DocumentType } from '../types'

/** 파이프라인·export·생성 공통 순서 (전체 타입) */
export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'prd',
  'ia',
  'screen_list',
  'policy',
  'wireframe',
  'cursor_prompt',
]

/** UI 탭·카드 배지에 표시하는 타입 (화면목록 숨김) */
export const DOCUMENT_TYPE_UI_ORDER: DocumentType[] = DOCUMENT_TYPE_ORDER.filter(
  (type) => type !== 'screen_list',
)
