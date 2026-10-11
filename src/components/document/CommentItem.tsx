import type { ProjectComment } from '../../types'
import { CommentReactionBar } from './CommentReactionBar'
import { cn } from '../../lib/utils'

interface CommentItemProps {
  comment: ProjectComment
  currentUserId: string
  depth?: number
  isResolved?: boolean
  canReply: boolean
  canReact: boolean
  onReply: (commentId: string) => void
  onToggleReaction: (commentId: string, emoji: string) => void
}

export function CommentItem({
  comment,
  currentUserId,
  depth = 0,
  isResolved,
  canReply,
  canReact,
  onReply,
  onToggleReaction,
}: CommentItemProps) {
  if (comment.deleted_at) {
    return (
      <p className="text-xs italic text-gray-400" style={{ marginLeft: depth * 12 }}>
        삭제된 댓글
      </p>
    )
  }

  return (
    <div style={{ marginLeft: depth * 12 }} className={cn(isResolved && depth === 0 && 'opacity-70')}>
      <div className="flex items-start gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
          {comment.author_name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-gray-900">{comment.author_name}</span>
            <span className="text-[10px] text-gray-400">
              {new Date(comment.created_at).toLocaleString('ko-KR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
          <CommentReactionBar
            reactions={comment.reactions}
            currentUserId={currentUserId}
            onToggle={(emoji) => onToggleReaction(comment.id, emoji)}
            disabled={!canReact}
          />
          {canReply && (
            <button
              type="button"
              className="mt-1 text-xs text-gray-500 hover:text-brand-600"
              onClick={() => onReply(comment.id)}
            >
              답글
            </button>
          )}
        </div>
      </div>
      {comment.replies?.map((reply) => (
        <div key={reply.id} className="mt-2">
          <CommentItem
            comment={reply}
            currentUserId={currentUserId}
            depth={depth + 1}
            isResolved={isResolved}
            canReply={canReply}
            canReact={canReact}
            onReply={onReply}
            onToggleReaction={onToggleReaction}
          />
        </div>
      ))}
    </div>
  )
}
