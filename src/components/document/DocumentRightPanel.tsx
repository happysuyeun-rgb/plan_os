import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface DocumentRightPanelProps {
  isOpen: boolean
  onToggle: () => void
  canComment: boolean
  commentBadge?: number
  commentPanel?: ReactNode
}

export function DocumentRightPanel({
  isOpen,
  onToggle,
  canComment,
  commentBadge = 0,
  commentPanel,
}: DocumentRightPanelProps) {
  if (!canComment) return null

  return (
    <div className="flex shrink-0">
      {isOpen && commentPanel}
      <nav
        className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-gray-200 bg-gray-50 py-2"
        aria-label="우측 패널"
      >
        <button
          type="button"
          title="댓글"
          onClick={onToggle}
          className={cn(
            'relative flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors',
            isOpen
              ? 'bg-orange-100 text-orange-700'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
          )}
        >
          <span className="text-base leading-none" aria-hidden>
            🗨
          </span>
          {commentBadge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-medium text-white">
              {commentBadge > 99 ? '99+' : commentBadge}
            </span>
          )}
        </button>
      </nav>
    </div>
  )
}
