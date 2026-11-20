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
      className="min-h-[calc(297mm-6rem)] w-full resize-y border-0 bg-transparent p-0 font-mono text-sm shadow-none focus:ring-0"
      placeholder="문서 내용이 여기에 표시됩니다..."
    />
  )
}
