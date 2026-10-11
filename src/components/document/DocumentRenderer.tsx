import type { DocumentType } from '../../types'
import { shouldUseStructuredRenderer } from '../../lib/documentContent'
import { MarkdownEditor } from './MarkdownEditor'
import { ScreenListTable } from './ScreenListTable'
import { WireframeSlideView } from './WireframeSlideView'

interface DocumentRendererProps {
  docType: DocumentType
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function DocumentRenderer({ docType, value, onChange, readOnly }: DocumentRendererProps) {
  if (docType === 'screen_list' && shouldUseStructuredRenderer('screen_list', value)) {
    return <ScreenListTable content={value} onChange={onChange} readOnly={readOnly} />
  }

  if (docType === 'wireframe' && shouldUseStructuredRenderer('wireframe', value)) {
    return <WireframeSlideView content={value} onChange={onChange} readOnly={readOnly} />
  }

  return (
    <MarkdownEditor value={value} onChange={onChange} readOnly={readOnly} />
  )
}
