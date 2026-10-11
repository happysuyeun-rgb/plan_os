import { Textarea } from '../common/Textarea'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function MarkdownEditor({ value, onChange, readOnly }: MarkdownEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      maxLength={50000}
      showCount
      className="min-h-[calc(100vh-200px)] font-mono text-sm"
      placeholder="문서 내용이 여기에 표시됩니다..."
    />
  )
}
