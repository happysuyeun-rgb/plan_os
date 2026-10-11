import { useState, useRef, useEffect } from 'react'
import { ArrowUp, Smile } from 'lucide-react'
import { EmojiPicker } from './EmojiPicker'
import { cn } from '../../lib/utils'

interface CommentFloatingComposerProps {
  style: { left: number; top: number }
  onSubmit: (body: string) => void
  onCancel: () => void
  placeholder?: string
}

export function CommentFloatingComposer({
  style,
  onSubmit,
  onCancel,
  placeholder = '댓글을 입력하세요',
}: CommentFloatingComposerProps) {
  const [body, setBody] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!body.trim()) return
    onSubmit(body.trim())
    setBody('')
  }

  return (
    <div
      className="absolute z-30 w-72 rounded-xl border border-gray-200 bg-white shadow-xl"
      style={{ left: style.left, top: style.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            handleSubmit()
          }
          if (e.key === 'Escape') onCancel()
        }}
        maxLength={4000}
        rows={3}
        placeholder={placeholder}
        className="w-full resize-none rounded-t-xl px-3 py-2 text-sm outline-none"
      />
      <div className="relative flex items-center justify-between border-t border-gray-100 px-2 py-1.5">
        <div className="relative">
          <button
            type="button"
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
            onClick={() => setShowEmoji(!showEmoji)}
          >
            <Smile className="h-4 w-4" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-full left-0 mb-1">
              <EmojiPicker
                onSelect={(emoji) => {
                  setBody((b) => b + emoji)
                  setShowEmoji(false)
                }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={!body.trim()}
          onClick={handleSubmit}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            body.trim()
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-gray-200 text-gray-400',
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
