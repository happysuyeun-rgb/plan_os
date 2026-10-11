import type {
  CommentCounts,
  CommentFilter,
  CommentParticipant,
  CommentReaction,
  CommentThread,
  DocumentType,
  ProjectComment,
  RegionAnchor,
  ThreadStatus,
} from '../../types'
import { buildThreads, mergeParticipantStatus } from '../comments/buildThreads'
import {
  notifyCommentCreated,
  notifyThreadResolved,
} from '../notifications/notify'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

type CommentRow = {
  id: string
  project_id: string
  document_id: string | null
  thread_root_id: string | null
  parent_id: string | null
  user_id: string
  author_name: string
  author_avatar_url: string
  body: string
  anchor_type: 'region' | 'none' | 'project'
  anchor_meta: RegionAnchor | Record<string, never>
  status: ThreadStatus
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function pickUserName(users: unknown): string {
  if (!users || typeof users !== 'object') return ''
  if (Array.isArray(users)) {
    const first = users[0]
    return first && typeof first === 'object' && 'name' in first
      ? String((first as { name: string }).name)
      : ''
  }
  return 'name' in users ? String((users as { name: string }).name) : ''
}

function pickUserProfile(users: unknown): { name: string; avatar_url: string } {
  const empty = { name: '', avatar_url: '' }
  if (!users || typeof users !== 'object') return empty
  const row = Array.isArray(users) ? users[0] : users
  if (!row || typeof row !== 'object') return empty
  return {
    name: 'name' in row ? String((row as { name: string }).name) : '',
    avatar_url: 'avatar_url' in row ? String((row as { avatar_url: string }).avatar_url) : '',
  }
}

async function requireAuthProfile(): Promise<{ id: string; name: string; avatar_url: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('로그인이 필요합니다')

  const { data, error } = await supabase
    .from('users')
    .select('id, name, avatar_url')
    .eq('id', session.user.id)
    .single()
  return unwrap(data, error)
}

function mapComment(row: CommentRow): ProjectComment {
  return {
    ...row,
    reactions: [],
  }
}

function containsText(comment: ProjectComment, q: string): boolean {
  if (comment.body.toLowerCase().includes(q)) return true
  return comment.replies?.some((r) => containsText(r, q)) ?? false
}

async function fetchFlatComments(projectId: string, documentId?: string): Promise<CommentRow[]> {
  let query = supabase
    .from('project_comments')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (documentId) {
    query = query.eq('document_id', documentId)
  }

  const { data, error } = await query
  throwIfError(error)
  return (data ?? []) as CommentRow[]
}

async function fetchReactionsForComments(commentIds: string[]): Promise<CommentReaction[]> {
  if (commentIds.length === 0) return []

  const { data, error } = await supabase
    .from('comment_reactions')
    .select('id, comment_id, user_id, emoji, created_at, users(name)')
    .in('comment_id', commentIds)

  throwIfError(error)

  return (data ?? []).map((r) => ({
    id: r.id as string,
    comment_id: r.comment_id as string,
    user_id: r.user_id as string,
    user_name: pickUserName(r.users),
    emoji: r.emoji as string,
    created_at: r.created_at as string,
  }))
}

async function fetchParticipantsForThreads(
  threadRootIds: string[],
): Promise<Map<string, CommentParticipant[]>> {
  const map = new Map<string, CommentParticipant[]>()
  if (threadRootIds.length === 0) return map

  const { data, error } = await supabase
    .from('comment_participant_status')
    .select('thread_root_id, user_id, status, users(name, avatar_url)')
    .in('thread_root_id', threadRootIds)

  throwIfError(error)

  for (const row of data ?? []) {
    const threadRootId = row.thread_root_id as string
    const profile = pickUserProfile(row.users)
    const list = map.get(threadRootId) ?? []
    list.push({
      user_id: row.user_id as string,
      name: profile.name,
      avatar_url: profile.avatar_url,
      status: row.status as 'pending' | 'completed',
    })
    map.set(threadRootId, list)
  }

  return map
}

async function loadThreads(projectId: string, documentId?: string): Promise<CommentThread[]> {
  const flat = await fetchFlatComments(projectId, documentId)
  const commentIds = flat.map((c) => c.id)
  const rootIds = flat.filter((c) => c.parent_id === null).map((c) => c.id)
  const [reactions, participantsByThread] = await Promise.all([
    fetchReactionsForComments(commentIds),
    fetchParticipantsForThreads(rootIds),
  ])
  return buildThreads(flat.map(mapComment), participantsByThread, reactions)
}

async function ensureParticipant(threadRootId: string, userId: string): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from('comment_participant_status')
    .select('user_id')
    .eq('thread_root_id', threadRootId)
    .eq('user_id', userId)
    .maybeSingle()

  throwIfError(findError)
  if (existing) return

  const { error } = await supabase.from('comment_participant_status').insert({
    thread_root_id: threadRootId,
    user_id: userId,
    status: 'pending',
    completed_at: null,
  })
  throwIfError(error)
}

async function attachReactions(comment: ProjectComment): Promise<ProjectComment> {
  const reactions = await fetchReactionsForComments([comment.id])
  return { ...comment, reactions }
}

export async function fetchCommentThreads(
  projectId: string,
  documentId?: string,
  filter?: CommentFilter,
  search?: string,
): Promise<CommentThread[]> {
  let threads = await loadThreads(projectId, documentId)
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id

  if (filter === 'open') threads = threads.filter((t) => t.root.status === 'open')
  if (filter === 'resolved') threads = threads.filter((t) => t.root.status === 'resolved')
  if (filter === 'mine_pending' && userId) {
    threads = threads.filter((t) => {
      const mine = t.participants.find((p) => p.user_id === userId)
      return t.root.status === 'open' && (!mine || mine.status === 'pending')
    })
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    threads = threads.filter(
      (t) =>
        t.root.body.toLowerCase().includes(q) ||
        t.replies.some((r) => containsText(r, q)),
    )
  }

  return threads
}

export async function fetchCommentCounts(projectId: string): Promise<CommentCounts> {
  const { data: roots, error: rootsError } = await supabase
    .from('project_comments')
    .select('id, status, document_id')
    .eq('project_id', projectId)
    .is('parent_id', null)
    .is('deleted_at', null)

  throwIfError(rootsError)

  const openRoots = (roots ?? []).filter((r) => r.status === 'open')
  const docIds = [...new Set(openRoots.map((r) => r.document_id).filter(Boolean))] as string[]

  const docTypeById = new Map<string, DocumentType>()
  if (docIds.length > 0) {
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, type')
      .in('id', docIds)
    throwIfError(docsError)
    for (const doc of docs ?? []) {
      docTypeById.set(doc.id, doc.type as DocumentType)
    }
  }

  const by_document: CommentCounts['by_document'] = {}
  for (const root of openRoots) {
    if (!root.document_id) continue
    const type = docTypeById.get(root.document_id)
    if (!type) continue
    const prev = by_document[type]?.open ?? 0
    by_document[type] = { open: prev + 1 }
  }

  return {
    by_document,
    project_open: openRoots.length,
  }
}

export async function createRootComment(input: {
  project_id: string
  document_id: string
  body: string
  anchor_meta: RegionAnchor
}): Promise<ProjectComment> {
  const user = await requireAuthProfile()
  const trimmed = input.body.trim()
  if (!trimmed) throw new Error('댓글 내용을 입력해주세요')

  const { data, error } = await supabase
    .from('project_comments')
    .insert({
      project_id: input.project_id,
      document_id: input.document_id,
      thread_root_id: null,
      parent_id: null,
      user_id: user.id,
      author_name: user.name,
      author_avatar_url: user.avatar_url,
      body: trimmed,
      anchor_type: 'region',
      anchor_meta: input.anchor_meta,
      status: 'open',
    })
    .select()
    .single()

  const comment = mapComment(unwrap(data, error) as CommentRow)

  await ensureParticipant(comment.id, user.id)

  const result = await attachReactions(comment)
  void notifyCommentCreated(result, null)
  return result
}

export async function replyToComment(parentId: string, body: string): Promise<ProjectComment> {
  const user = await requireAuthProfile()
  const trimmed = body.trim()
  if (!trimmed) throw new Error('댓글 내용을 입력해주세요')

  const { data: parent, error: parentError } = await supabase
    .from('project_comments')
    .select('*')
    .eq('id', parentId)
    .is('deleted_at', null)
    .single()

  const parentRow = unwrap(parent, parentError) as CommentRow
  const threadRootId = parentRow.thread_root_id ?? parentRow.id

  const { data, error } = await supabase
    .from('project_comments')
    .insert({
      project_id: parentRow.project_id,
      document_id: parentRow.document_id,
      thread_root_id: threadRootId,
      parent_id: parentId,
      user_id: user.id,
      author_name: user.name,
      author_avatar_url: user.avatar_url,
      body: trimmed,
      anchor_type: 'none',
      anchor_meta: {},
      status: 'open',
    })
    .select()
    .single()

  const comment = mapComment(unwrap(data, error) as CommentRow)
  await ensureParticipant(threadRootId, user.id)

  const result = await attachReactions(comment)
  void notifyCommentCreated(result, mapComment(parentRow))
  return result
}

export async function setThreadResolved(
  threadRootId: string,
  resolved: boolean,
): Promise<ProjectComment> {
  const user = await requireAuthProfile()

  const { data, error } = await supabase
    .from('project_comments')
    .update({
      status: resolved ? 'resolved' : 'open',
      resolved_by: resolved ? user.id : null,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq('id', threadRootId)
    .is('parent_id', null)
    .select()
    .single()

  const root = attachReactions(mapComment(unwrap(data, error) as CommentRow))
  void notifyThreadResolved(threadRootId, resolved, user.id, user.name)
  return root
}

export async function setMyCompletion(
  threadRootId: string,
  completed: boolean,
): Promise<void> {
  const user = await requireAuthProfile()

  const { data: existingRows } = await supabase
    .from('comment_participant_status')
    .select('user_id, status, users(name, avatar_url)')
    .eq('thread_root_id', threadRootId)

  const existing: CommentParticipant[] = (existingRows ?? []).map((r) => {
    const profile = pickUserProfile(r.users)
    return {
      user_id: r.user_id as string,
      name: profile.name,
      avatar_url: profile.avatar_url,
      status: r.status as 'pending' | 'completed',
    }
  })

  const merged = mergeParticipantStatus(
    user.id,
    user.name,
    user.avatar_url,
    existing,
    completed ? 'completed' : 'pending',
  )

  const mine = merged.find((p) => p.user_id === user.id)
  if (!mine) return

  const { error } = await supabase.from('comment_participant_status').upsert(
    {
      thread_root_id: threadRootId,
      user_id: user.id,
      status: mine.status,
      completed_at: mine.status === 'completed' ? new Date().toISOString() : null,
    },
    { onConflict: 'thread_root_id,user_id' },
  )
  throwIfError(error)
}

export async function toggleCommentReaction(
  commentId: string,
  emoji: string,
): Promise<ProjectComment> {
  const user = await requireAuthProfile()

  const { data: existing, error: findError } = await supabase
    .from('comment_reactions')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  throwIfError(findError)

  if (existing) {
    const { error } = await supabase.from('comment_reactions').delete().eq('id', existing.id)
    throwIfError(error)
  } else {
    const { error } = await supabase.from('comment_reactions').insert({
      comment_id: commentId,
      user_id: user.id,
      emoji,
    })
    throwIfError(error)
  }

  const { data: comment, error: commentError } = await supabase
    .from('project_comments')
    .select('*')
    .eq('id', commentId)
    .single()

  return attachReactions(mapComment(unwrap(comment, commentError) as CommentRow))
}

export async function deleteComment(commentId: string): Promise<void> {
  const user = await requireAuthProfile()

  const { data: comment, error: fetchError } = await supabase
    .from('project_comments')
    .select('user_id, project_id')
    .eq('id', commentId)
    .single()

  const row = unwrap(comment, fetchError)
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', row.project_id)
    .single()

  if (row.user_id !== user.id && project?.user_id !== user.id) {
    throw new Error('삭제 권한이 없습니다')
  }

  const { error } = await supabase
    .from('project_comments')
    .update({ deleted_at: new Date().toISOString(), body: '' })
    .eq('id', commentId)

  throwIfError(error)
}
