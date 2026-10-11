import { useState } from 'react'
import type { CommentReaction } from '../../types'
import { EmojiPicker } from './EmojiPicker'
import { cn } from '../../lib/utils'

interface CommentReactionBarProps {
  reactions: CommentReaction[]
  currentUserId: string
  onToggle: (emoji: string) => void
  disabled?: boolean
}

function groupReactions(reactions: CommentReaction[], currentUserId: string) {
  const map = new Map<string, { emoji: string; count: number; mine: boolean }>()
  for (const r of reactions) {
    const prev = map.get(r.emoji)
    if (prev) {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: prev.count + 1,
        mine: prev.mine || r.user_id === currentUserId,
      })
    } else {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        mine: r.user_id === currentUserId,
      })
    }
  }
  return [...map.values()]
}

export function CommentReactionBar({
  reactions,
  currentUserId,
  onToggle,
  disabled,
}: CommentReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false)
  const withMine = groupReactions(reactions, currentUserId)

  return (
    <div className="relative mt-1 flex flex-wrap items-center gap-1">
      {withMine.map((g) => (
        <button
          key={g.emoji}
          type="button"
          disabled={disabled}
          onClick={() => onToggle(g.emoji)}
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs',
            g.mine
              ? 'border-brand-300 bg-brand-50 text-brand-800'
              : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100',
          )}
        >
          {g.emoji} {g.count}
        </button>
      ))}
      {!disabled && (
        <div className="relative">
          <button
            type="button"
            className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-gray-400"
            onClick={() => setShowPicker(!showPicker)}
          >
            +
          </button>
          {showPicker && (
            <div className="absolute bottom-full left-0 z-20 mb-1">
              <EmojiPicker
                onSelect={(emoji) => {
                  onToggle(emoji)
                  setShowPicker(false)
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
