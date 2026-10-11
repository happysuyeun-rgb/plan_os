import { useState } from 'react'
import type { CommentThread } from '../../types'
import { CommentItem } from './CommentItem'
import { cn } from '../../lib/utils'
import { Check, RotateCcw } from 'lucide-react'

interface CommentThreadCardProps {
  thread: CommentThread
  currentUserId: string
  isActive: boolean
  canCreate: boolean
  canResolve: boolean
  canCompleteOwn: boolean
  replyToId: string | null
  onSelect: () => void
  onReply: (parentId: string) => void
  onSubmitReply: (parentId: string, body: string) => void
  onCancelReply: () => void
  onResolve: (resolved: boolean) => void
  onMyComplete: (completed: boolean) => void
  onToggleReaction: (commentId: string, emoji: string) => void
}

export function CommentThreadCard({
  thread,
  currentUserId,
  isActive,
  canCreate,
  canResolve,
  canCompleteOwn,
  replyToId,
  onSelect,
  onReply,
  onSubmitReply,
  onCancelReply,
  onResolve,
  onMyComplete,
  onToggleReaction,
}: CommentThreadCardProps) {
  const [showInlineReply, setShowInlineReply] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const { root } = thread
  const isResolved = root.status === 'resolved'
  const pinIndex =
    'pin_index' in root.anchor_meta ? root.anchor_meta.pin_index : null
  const excerpt =
    'excerpt' in root.anchor_meta ? root.anchor_meta.excerpt : null

  const myParticipant = thread.participants.find((p) => p.user_id === currentUserId)
  const completedCount = thread.participants.filter((p) => p.status === 'completed').length
  const totalParticipants = thread.participants.length

  const handleReplyClick = (id: string) => {
    onReply(id)
    setShowInlineReply(true)
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition',
        isActive ? 'border-orange-300 bg-orange-50/50' : 'border-gray-100 bg-white hover:border-gray-200',
        isResolved && 'opacity-75',
      )}
      onClick={onSelect}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {pinIndex != null && (
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
              {pinIndex}
            </span>
          )}
          {excerpt && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500 italic">"{excerpt}"</p>
          )}
        </div>
        {isResolved && (
          <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
            완료
          </span>
        )}
      </div>

      <CommentItem
        comment={{ ...root, replies: thread.replies }}
        currentUserId={currentUserId}
        isResolved={isResolved}
        canReply={canCreate && !isResolved}
        canReact={canCreate}
        onReply={handleReplyClick}
        onToggleReaction={(id, emoji) => onToggleReaction(id, emoji)}
      />

      {(showInlineReply || replyToId) && canCreate && replyToId && (
        <div className="mt-2 ml-9 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && replyBody.trim()) {
                onSubmitReply(replyToId, replyBody.trim())
                setReplyBody('')
                setShowInlineReply(false)
              }
              if (e.key === 'Escape') {
                onCancelReply()
                setShowInlineReply(false)
                setReplyBody('')
              }
            }}
            placeholder="답글 입력..."
            className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
            autoFocus
          />
          <button
            type="button"
            disabled={!replyBody.trim()}
            className="rounded-lg bg-orange-500 px-2 py-1 text-xs text-white disabled:bg-gray-200"
            onClick={() => {
              if (!replyBody.trim()) return
              onSubmitReply(replyToId, replyBody.trim())
              setReplyBody('')
              setShowInlineReply(false)
            }}
          >
            전송
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
        {totalParticipants > 0 && (
          <div className="flex items-center gap-1">
            {thread.participants.map((p) => (
              <span
                key={p.user_id}
                title={`${p.name}: ${p.status === 'completed' ? '완료' : '미완료'}`}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium',
                  p.status === 'completed'
                    ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
                    : 'bg-gray-100 text-gray-500',
                )}
              >
                {p.name.slice(0, 1)}
              </span>
            ))}
            <span className="text-[10px] text-gray-400">
              {completedCount}/{totalParticipants}명 완료
            </span>
          </div>
        )}

        {canCompleteOwn && !isResolved && (
          <label className="flex cursor-pointer items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={myParticipant?.status === 'completed'}
              onChange={(e) => {
                e.stopPropagation()
                onMyComplete(e.target.checked)
              }}
              onClick={(e) => e.stopPropagation()}
            />
            내 완료
          </label>
        )}

        {canResolve && (
          <button
            type="button"
            className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600"
            onClick={(e) => {
              e.stopPropagation()
              onResolve(!isResolved)
            }}
          >
            {isResolved ? (
              <>
                <RotateCcw className="h-3 w-3" /> 다시 열기
              </>
            ) : (
              <>
                <Check className="h-3 w-3" /> 스레드 완료
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
