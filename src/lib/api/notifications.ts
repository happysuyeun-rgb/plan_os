import type { DocumentType, NotificationSummary, NotificationType, UserNotification } from '../../types'
import { computeNotificationSummary } from '../notifications/helpers'
import { supabase } from '../supabase'
import { throwIfError } from '../supabaseHelpers'

type NotificationRow = {
  id: string
  user_id: string
  project_id: string
  document_id: string | null
  type: NotificationType
  actor_id: string | null
  actor_name: string
  title: string
  body: string
  link_path: string
  thread_root_id: string | null
  comment_id: string | null
  chat_message_id: string | null
  read_at: string | null
  created_at: string
  projects: { title: string } | { title: string }[] | null
  documents: { type: DocumentType } | { type: DocumentType }[] | null
}

function pickTitle(projects: NotificationRow['projects']): string {
  if (!projects) return ''
  const row = Array.isArray(projects) ? projects[0] : projects
  return row?.title ?? ''
}

function pickDocType(documents: NotificationRow['documents']): DocumentType | null {
  if (!documents) return null
  const row = Array.isArray(documents) ? documents[0] : documents
  return row?.type ?? null
}

function mapRow(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    project_title: pickTitle(row.projects),
    document_id: row.document_id,
    doc_type: pickDocType(row.documents),
    type: row.type,
    actor_id: row.actor_id,
    actor_name: row.actor_name,
    title: row.title,
    body: row.body,
    link_path: row.link_path,
    thread_root_id: row.thread_root_id,
    comment_id: row.comment_id,
    chat_message_id: row.chat_message_id,
    read_at: row.read_at,
    created_at: row.created_at,
  }
}

async function requireUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('로그인이 필요합니다')
  return session.user.id
}

export async function fetchNotifications(opts?: {
  limit?: number
  projectId?: string
}): Promise<UserNotification[]> {
  const userId = await requireUserId()
  const limit = opts?.limit ?? 50

  let query = supabase
    .from('user_notifications')
    .select(
      '*, projects:project_id (title), documents:document_id (type)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (opts?.projectId) {
    query = query.eq('project_id', opts.projectId)
  }

  const { data, error } = await query
  throwIfError(error)
  return (data as NotificationRow[] | null)?.map(mapRow) ?? []
}

export async function fetchNotificationSummary(): Promise<NotificationSummary> {
  const userId = await requireUserId()
  const items = await fetchNotifications({ limit: 200 })
  return computeNotificationSummary(items, userId)
}

export async function markNotificationRead(id: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  throwIfError(error)
}

export async function markAllNotificationsRead(projectId?: string): Promise<void> {
  const userId = await requireUserId()
  let query = supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { error } = await query
  throwIfError(error)
}
