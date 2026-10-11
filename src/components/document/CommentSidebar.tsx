import { useEffect } from 'react'
import { Search, MessageSquare, X } from 'lucide-react'
import type { CommentFilter, CommentThread } from '../../types'
import { CommentThreadCard } from './CommentThreadCard'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { cn } from '../../lib/utils'

const FILTERS: { id: CommentFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'open', label: '미완료' },
  { id: 'resolved', label: '완료' },
  { id: 'mine_pending', label: '내 미완료' },
]

interface CommentSidebarProps {
  isOpen: boolean
  threads: CommentThread[]
  isLoading: boolean
  filter: CommentFilter
  search: string
  activeThreadId: string | null
  replyToId: string | null
  currentUserId: string
  canCreate: boolean
  canResolve: boolean
  canCompleteOwn: boolean
  onClose: () => void
  onFilterChange: (filter: CommentFilter) => void
  onSearchChange: (search: string) => void
  onSelectThread: (id: string) => void
  onReply: (parentId: string) => void
  onSubmitReply: (parentId: string, body: string) => void
  onCancelReply: () => void
  onResolve: (threadRootId: string, resolved: boolean) => void
  onMyComplete: (threadRootId: string, completed: boolean) => void
  onToggleReaction: (commentId: string, emoji: string, threadRootId: string) => void
}

export function CommentSidebar({
  isOpen,
  threads,
  isLoading,
  filter,
  search,
  activeThreadId,
  replyToId,
  currentUserId,
  canCreate,
  canResolve,
  canCompleteOwn,
  onClose,
  onFilterChange,
  onSearchChange,
  onSelectThread,
  onReply,
  onSubmitReply,
  onCancelReply,
  onResolve,
  onMyComplete,
  onToggleReaction,
}: CommentSidebarProps) {
  useEffect(() => {
    if (activeThreadId) {
      document.getElementById(`thread-${activeThreadId}`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeThreadId])

  if (!isOpen) return null

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">댓글</h3>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-gray-100 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="댓글 검색"
            className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-brand-500"
          />
        </div>
        <div className="mt-2 flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] font-medium',
                filter === f.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <LoadingSpinner className="py-8" />
        ) : threads.length === 0 ? (
          <p className="px-1 text-center text-xs leading-relaxed text-gray-400">
            피드백을 주거나, 질문을 하거나, 감사 인사를 남기세요.
            <br />
            댓글을 남기려면 문서에서 영역을 드래그하세요.
          </p>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <div key={thread.root.id} id={`thread-${thread.root.id}`}>
                <CommentThreadCard
                  thread={thread}
                  currentUserId={currentUserId}
                  isActive={activeThreadId === thread.root.id}
                  canCreate={canCreate}
                  canResolve={canResolve}
                  canCompleteOwn={canCompleteOwn}
                  replyToId={replyToId}
                  onSelect={() => onSelectThread(thread.root.id)}
                  onReply={onReply}
                  onSubmitReply={onSubmitReply}
                  onCancelReply={onCancelReply}
                  onResolve={(resolved) => onResolve(thread.root.id, resolved)}
                  onMyComplete={(completed) => onMyComplete(thread.root.id, completed)}
                  onToggleReaction={(commentId, emoji) =>
                    onToggleReaction(commentId, emoji, thread.root.id)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
