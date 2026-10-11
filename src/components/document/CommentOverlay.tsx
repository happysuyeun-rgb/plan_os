import { useRef, useState, useCallback, type ReactNode } from 'react'
import type { CommentThread, RegionAnchor } from '../../types'
import { CommentFloatingComposer } from './CommentFloatingComposer'
import { buildRegionAnchor, minRectFromPoint, nextPinIndex } from '../../lib/comments/regionAnchor'
import { cn } from '../../lib/utils'

interface DragState {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface CommentOverlayProps {
  content: string
  threads: CommentThread[]
  isCommentMode: boolean
  activeThreadId: string | null
  existingAnchors: { pin_index: number; rect_norm: RegionAnchor['rect_norm'] }[]
  onSelectThread: (threadId: string) => void
  onCreateComment: (anchor: RegionAnchor, body: string) => void
  onCancelSelection: () => void
  children: ReactNode
}

function normRect(container: DOMRect, x1: number, y1: number, x2: number, y2: number) {
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const w = Math.abs(x2 - x1)
  const h = Math.abs(y2 - y1)
  return {
    x: left / container.width,
    y: top / container.height,
    w: Math.max(w / container.width, 0.02),
    h: Math.max(h / container.height, 0.04),
  }
}

export function CommentOverlay({
  content,
  threads,
  isCommentMode,
  activeThreadId,
  existingAnchors,
  onSelectThread,
  onCreateComment,
  onCancelSelection,
  children,
}: CommentOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [composerPos, setComposerPos] = useState<{ left: number; top: number } | null>(null)
  const [pendingRect, setPendingRect] = useState<RegionAnchor['rect_norm'] | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isCommentMode || e.button !== 0) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDrag({ startX: x, startY: y, currentX: x, currentY: y })
    setComposerPos(null)
    setPendingRect(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setDrag({
      ...drag,
      currentX: e.clientX - rect.left,
      currentY: e.clientY - rect.top,
    })
  }

  const finishSelection = useCallback(
    (rectNorm: RegionAnchor['rect_norm'], pixelPos: { left: number; top: number }) => {
      setPendingRect(rectNorm)
      setComposerPos(pixelPos)
    },
    [],
  )

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drag || !isCommentMode) return
    const container = containerRef.current?.getBoundingClientRect()
    if (!container) return

    const moved =
      Math.abs(drag.currentX - drag.startX) > 4 || Math.abs(drag.currentY - drag.startY) > 4

    let rectNorm: RegionAnchor['rect_norm']
    if (moved) {
      rectNorm = normRect(
        container,
        drag.startX,
        drag.startY,
        drag.currentX,
        drag.currentY,
      )
    } else {
      const nx = drag.startX / container.width
      const ny = drag.startY / container.height
      rectNorm = minRectFromPoint(nx, ny)
    }

    const left = Math.min(container.width - 288, drag.currentX + 8)
    const top = Math.min(container.height - 120, drag.currentY + 8)
    finishSelection(rectNorm, { left, top })
    setDrag(null)
    e.preventDefault()
  }

  const selectionStyle = drag
    ? (() => {
        const left = Math.min(drag.startX, drag.currentX)
        const top = Math.min(drag.startY, drag.currentY)
        const width = Math.abs(drag.currentX - drag.startX)
        const height = Math.abs(drag.currentY - drag.startY)
        return { left, top, width: Math.max(width, 4), height: Math.max(height, 4) }
      })()
    : null

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => drag && setDrag(null)}
    >
      {children}

      {existingAnchors.map((a) => {
        const thread = threads.find(
          (t) =>
            'pin_index' in t.root.anchor_meta &&
            t.root.anchor_meta.pin_index === a.pin_index,
        )
        const isActive = thread?.root.id === activeThreadId
        const resolved = thread?.root.status === 'resolved'
        return (
          <button
            key={a.pin_index}
            type="button"
            className={cn(
              'absolute z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold shadow-md',
              isActive
                ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                : resolved
                  ? 'bg-gray-300 text-gray-600'
                  : 'bg-orange-500 text-white hover:bg-orange-600',
            )}
            style={{
              left: `${(a.rect_norm.x + a.rect_norm.w) * 100}%`,
              top: `${(a.rect_norm.y + a.rect_norm.h) * 100}%`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => thread && onSelectThread(thread.root.id)}
          >
            {a.pin_index}
          </button>
        )
      })}

      {existingAnchors.map((a) => {
        const thread = threads.find(
          (t) =>
            'pin_index' in t.root.anchor_meta &&
            t.root.anchor_meta.pin_index === a.pin_index,
        )
        const isActive = thread?.root.id === activeThreadId
        return (
          <div
            key={`box-${a.pin_index}`}
            className={cn(
              'pointer-events-none absolute border-2 border-dashed',
              isActive
                ? 'border-orange-500 bg-orange-50/40'
                : 'border-orange-300/60 bg-orange-50/20',
            )}
            style={{
              left: `${a.rect_norm.x * 100}%`,
              top: `${a.rect_norm.y * 100}%`,
              width: `${a.rect_norm.w * 100}%`,
              height: `${a.rect_norm.h * 100}%`,
            }}
          />
        )
      })}

      {selectionStyle && isCommentMode && (
        <div
          className="pointer-events-none absolute z-10 border-2 border-dashed border-orange-500 bg-orange-50/40"
          style={selectionStyle}
        />
      )}

      {composerPos && pendingRect && (
        <CommentFloatingComposer
          style={composerPos}
          onSubmit={(body) => {
            const pin = nextPinIndex(
              existingAnchors.map((a) => ({
                anchor_meta: { type: 'region' as const, pin_index: a.pin_index },
              })),
            )
            const anchor = buildRegionAnchor(content, pendingRect, pin)
            onCreateComment(anchor, body)
            setComposerPos(null)
            setPendingRect(null)
          }}
          onCancel={() => {
            setComposerPos(null)
            setPendingRect(null)
            onCancelSelection()
          }}
        />
      )}

      {isCommentMode && !drag && !composerPos && (
        <div className="pointer-events-none absolute inset-0 z-[5] cursor-crosshair" />
      )}
    </div>
  )
}
