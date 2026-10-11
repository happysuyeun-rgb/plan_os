import type { RegionAnchor } from '../../types'

export interface RectNorm {
  x: number
  y: number
  w: number
  h: number
}

export function linesFromRectNorm(
  content: string,
  rect: Pick<RectNorm, 'y' | 'h'>,
): { line_start: number; line_end: number; excerpt: string } {
  const lines = content.split('\n')
  if (lines.length === 0) {
    return { line_start: 0, line_end: 0, excerpt: '' }
  }
  const line_start = Math.max(0, Math.floor(rect.y * lines.length))
  const line_end = Math.min(
    lines.length - 1,
    Math.max(line_start, Math.ceil((rect.y + rect.h) * lines.length) - 1),
  )
  const excerpt = lines.slice(line_start, line_end + 1).join('\n').slice(0, 200)
  return { line_start, line_end, excerpt }
}

export function nextPinIndex(
  existing: { anchor_meta: { pin_index?: number } | RegionAnchor | Record<string, never> }[],
): number {
  const indices = existing
    .map((c) => ('pin_index' in c.anchor_meta ? (c.anchor_meta.pin_index ?? 0) : 0))
    .filter((n) => n > 0)
  return indices.length === 0 ? 1 : Math.max(...indices) + 1
}

export function buildRegionAnchor(
  content: string,
  rect: RectNorm,
  pinIndex: number,
): RegionAnchor {
  const { line_start, line_end, excerpt } = linesFromRectNorm(content, rect)
  return {
    type: 'region',
    rect_norm: rect,
    line_start,
    line_end,
    excerpt,
    pin_index: pinIndex,
  }
}

/** Minimum click box when user clicks without dragging */
export function minRectFromPoint(x: number, y: number): RectNorm {
  return { x: Math.max(0, x - 0.02), y: Math.max(0, y - 0.02), w: 0.25, h: 0.06 }
}
