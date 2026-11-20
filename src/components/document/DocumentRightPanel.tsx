import type { ReactNode } from 'react'
import { MessageSquare } from 'lucide-react'
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
        className="flex w-12 shrink-0 flex-col items-center border-l border-slate-200 bg-slate-50 py-3"
        aria-label="우측 패널"
      >
        <button
          type="button"
          title="댓글"
          aria-label={commentBadge > 0 ? `댓글 ${commentBadge}개` : '댓글'}
          aria-pressed={isOpen}
          onClick={onToggle}
          className={cn(
            'relative inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
            isOpen
              ? 'border-brand-300 bg-brand-50 text-brand-700'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900',
          )}
        >
          <MessageSquare className="h-4 w-4" strokeWidth={2} aria-hidden />
          {commentBadge > 0 && (
            <span
              className={cn(
                'absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full',
                'bg-brand-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-slate-50',
              )}
            >
              {commentBadge > 99 ? '99+' : commentBadge}
            </span>
          )}
        </button>
      </nav>
    </div>
  )
}
