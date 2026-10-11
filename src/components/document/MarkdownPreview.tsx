import { useMemo } from 'react'
import { marked } from 'marked'
import { cn } from '../../lib/utils'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

marked.setOptions({ breaks: true, gfm: true })

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    try {
      return marked.parse(content || '') as string
    } catch {
      return `<p>${content}</p>`
    }
  }, [content])

  return (
    <article
      className={cn(
        'prose prose-sm max-w-none text-gray-800',
        'prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg',
        'prose-pre:bg-gray-100 prose-code:text-brand-700',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
