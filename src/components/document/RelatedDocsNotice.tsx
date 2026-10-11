import type { DocumentType } from '../../types'
import { DOCUMENT_TYPE_LABELS } from '../../types'

const RELATED_DOCS: Partial<Record<DocumentType, DocumentType[]>> = {
  prd: ['ia', 'screen_list', 'policy', 'wireframe', 'cursor_prompt'],
  ia: ['screen_list', 'policy', 'wireframe', 'cursor_prompt'],
  screen_list: ['policy', 'wireframe', 'cursor_prompt'],
  policy: ['wireframe', 'cursor_prompt'],
  wireframe: ['cursor_prompt'],
}

interface RelatedDocsNoticeProps {
  docType: DocumentType
}

export function RelatedDocsNotice({ docType }: RelatedDocsNoticeProps) {
  const related = RELATED_DOCS[docType]
  if (!related?.length) return null

  return (
    <p className="text-xs text-amber-700">
      이 문서를 수정하면{' '}
      {related.map((t) => DOCUMENT_TYPE_LABELS[t]).join(', ')}
      도 업데이트가 필요할 수 있습니다.
    </p>
  )
}
