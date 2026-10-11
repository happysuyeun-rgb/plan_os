import type {
  CommentParticipant,
  CommentReaction,
  CommentThread,
  ParticipantStatus,
  ProjectComment,
} from '../../types'

function isRegionAnchor(
  meta: ProjectComment['anchor_meta'],
): meta is ProjectComment['anchor_meta'] & { pin_index: number } {
  return meta != null && 'pin_index' in meta && typeof meta.pin_index === 'number'
}

export function buildReplyTree(
  flat: ProjectComment[],
  parentId: string,
): ProjectComment[] {
  const children = flat
    .filter((c) => c.parent_id === parentId && !c.deleted_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  return children.map((child) => ({
    ...child,
    replies: buildReplyTree(flat, child.id),
  }))
}

export function getThreadRootId(comment: ProjectComment): string {
  return comment.thread_root_id ?? comment.id
}

export function collectParticipantUserIds(
  root: ProjectComment,
  replies: ProjectComment[],
): Set<string> {
  const ids = new Set<string>()
  const walk = (c: ProjectComment) => {
    ids.add(c.user_id)
    c.replies?.forEach(walk)
  }
  walk(root)
  replies.forEach(walk)
  return ids
}

export function buildThreads(
  flat: ProjectComment[],
  participantsByThread: Map<string, CommentParticipant[]>,
  reactions: CommentReaction[],
): CommentThread[] {
  const withReactions = flat.map((c) => ({
    ...c,
    reactions: reactions.filter((r) => r.comment_id === c.id),
  }))

  const roots = withReactions
    .filter((c) => c.parent_id === null && !c.deleted_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  return roots.map((root) => {
    const replies = buildReplyTree(withReactions, root.id)
    return {
      root,
      replies,
      participants: participantsByThread.get(root.id) ?? [],
    }
  })
}

export function countOpenThreads(threads: CommentThread[]): number {
  return threads.filter((t) => t.root.status === 'open').length
}

export function mergeParticipantStatus(
  userId: string,
  name: string,
  avatar_url: string,
  existing: CommentParticipant[],
  status: ParticipantStatus,
): CommentParticipant[] {
  const found = existing.find((p) => p.user_id === userId)
  if (found) {
    return existing.map((p) =>
      p.user_id === userId ? { ...p, status, name, avatar_url } : p,
    )
  }
  return [...existing, { user_id: userId, name, avatar_url, status }]
}

export function getPinThreads(threads: CommentThread[]): CommentThread[] {
  return threads.filter((t) => isRegionAnchor(t.root.anchor_meta))
}
