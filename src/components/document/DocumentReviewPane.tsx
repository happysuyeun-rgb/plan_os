import type { CommentThread, RegionAnchor } from '../../types'
import { MarkdownPreview } from './MarkdownPreview'
import { CommentOverlay } from './CommentOverlay'

interface DocumentReviewPaneProps {
  content: string
  threads: CommentThread[]
  isCommentMode: boolean
  activeThreadId: string | null
  onSelectThread: (threadId: string) => void
  onCreateComment: (anchor: RegionAnchor, body: string) => void
}

export function DocumentReviewPane({
  content,
  threads,
  isCommentMode,
  activeThreadId,
  onSelectThread,
  onCreateComment,
}: DocumentReviewPaneProps) {
  const existingAnchors = threads
    .filter((t) => t.root.anchor_type === 'region' && 'pin_index' in t.root.anchor_meta)
    .map((t) => {
      const meta = t.root.anchor_meta as RegionAnchor
      return { pin_index: meta.pin_index, rect_norm: meta.rect_norm }
    })

  return (
    <CommentOverlay
      content={content}
      threads={threads}
      isCommentMode={isCommentMode}
      activeThreadId={activeThreadId}
      existingAnchors={existingAnchors}
      onSelectThread={onSelectThread}
      onCreateComment={onCreateComment}
      onCancelSelection={() => {}}
    >
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <MarkdownPreview content={content} />
      </div>
    </CommentOverlay>
  )
}
