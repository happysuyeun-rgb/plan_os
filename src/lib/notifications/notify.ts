import type { DocumentType, NotificationType, ProjectComment } from '../../types'
import { fetchProjectMembers } from '../api/members'
import { supabase } from '../supabase'
import {
  buildChatLink,
  buildCommentLink,
  buildNotificationTitle,
  parseMentionNames,
  truncateText,
} from './helpers'

type InsertNotificationInput = {
  user_id: string
  project_id: string
  document_id: string | null
  type: NotificationType
  actor_id: string
  actor_name: string
  title: string
  body: string
  link_path: string
  thread_root_id?: string | null
  comment_id?: string | null
  chat_message_id?: string | null
}

async function getDocumentMeta(documentId: string | null): Promise<{
  docType: DocumentType | null
  projectId: string | null
}> {
  if (!documentId) return { docType: null, projectId: null }
  const { data } = await supabase
    .from('documents')
    .select('type, project_id')
    .eq('id', documentId)
    .maybeSingle()
  if (!data) return { docType: null, projectId: null }
  return { docType: data.type as DocumentType, projectId: data.project_id }
}

async function insertNotification(input: InsertNotificationInput): Promise<void> {
  if (input.user_id === input.actor_id) return

  const { error } = await supabase.from('user_notifications').insert({
    user_id: input.user_id,
    project_id: input.project_id,
    document_id: input.document_id,
    type: input.type,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
    title: input.title,
    body: input.body,
    link_path: input.link_path,
    thread_root_id: input.thread_root_id ?? null,
    comment_id: input.comment_id ?? null,
    chat_message_id: input.chat_message_id ?? null,
  })

  if (error) {
    console.warn('[notify] insert failed', error.message)
  }
}

async function notifyProjectMembers(
  projectId: string,
  actorId: string,
  _actorName: string,
  build: (recipientId: string) => Omit<InsertNotificationInput, 'user_id'> | null,
): Promise<void> {
  const { data: project } = await supabase
    .from('projects')
    .select('user_id, deleted_at')
    .eq('id', projectId)
    .maybeSingle()

  if (!project || project.deleted_at) return

  const recipientIds = new Set<string>()
  if (project.user_id !== actorId) recipientIds.add(project.user_id)

  const members = await fetchProjectMembers(projectId)
  for (const m of members) {
    if (m.status === 'active' && m.user_id && m.user_id !== actorId) {
      recipientIds.add(m.user_id)
    }
  }

  await Promise.all(
    [...recipientIds].map(async (userId) => {
      const payload = build(userId)
      if (!payload) return
      await insertNotification({ user_id: userId, ...payload })
    }),
  )
}

async function notifyMentions(
  comment: ProjectComment,
  actorId: string,
  actorName: string,
  docType: DocumentType | null,
): Promise<void> {
  const names = parseMentionNames(comment.body)
  if (names.length === 0) return

  const members = await fetchProjectMembers(comment.project_id)
  const threadRootId = comment.thread_root_id ?? comment.id
  const link = docType
    ? buildCommentLink(comment.project_id, docType, threadRootId)
    : `/projects/${comment.project_id}`

  for (const m of members) {
    if (m.status !== 'active' || !m.user_id || m.user_id === actorId) continue
    const matched = names.some(
      (n) =>
        m.name.includes(n) ||
        m.email.split('@')[0].toLowerCase() === n.toLowerCase(),
    )
    if (!matched) continue

    await insertNotification({
      user_id: m.user_id,
      project_id: comment.project_id,
      document_id: comment.document_id,
      type: 'comment.mention',
      actor_id: actorId,
      actor_name: actorName,
      title: buildNotificationTitle(actorName, docType),
      body: truncateText(comment.body),
      link_path: link,
      thread_root_id: threadRootId,
      comment_id: comment.id,
    })
  }
}

export async function notifyCommentCreated(
  comment: ProjectComment,
  parent: ProjectComment | null,
): Promise<void> {
  const actorId = comment.user_id
  const actorName = comment.author_name
  const { docType } = await getDocumentMeta(comment.document_id)
  const threadRootId = comment.thread_root_id ?? comment.id
  const link = docType
    ? buildCommentLink(comment.project_id, docType, threadRootId)
    : `/projects/${comment.project_id}`

  if (parent && parent.user_id !== actorId) {
    await insertNotification({
      user_id: parent.user_id,
      project_id: comment.project_id,
      document_id: comment.document_id,
      type: 'comment.reply',
      actor_id: actorId,
      actor_name: actorName,
      title: buildNotificationTitle(actorName, docType),
      body: truncateText(comment.body),
      link_path: link,
      thread_root_id: threadRootId,
      comment_id: comment.id,
    })
  }

  await notifyMentions(comment, actorId, actorName, docType)
}

export async function notifyThreadResolved(
  threadRootId: string,
  resolved: boolean,
  actorId: string,
  actorName: string,
): Promise<void> {
  const { data: root } = await supabase
    .from('project_comments')
    .select('*')
    .eq('id', threadRootId)
    .maybeSingle()

  if (!root) return

  const { docType } = await getDocumentMeta(root.document_id)
  const link = docType
    ? buildCommentLink(root.project_id, docType, threadRootId)
    : `/projects/${root.project_id}`

  const type: NotificationType = resolved ? 'comment.resolve' : 'comment.reopen'
  const body = resolved ? '댓글 스레드를 해결했습니다' : '댓글 스레드를 다시 열었습니다'

  if (root.user_id !== actorId) {
    await insertNotification({
      user_id: root.user_id,
      project_id: root.project_id,
      document_id: root.document_id,
      type,
      actor_id: actorId,
      actor_name: actorName,
      title: buildNotificationTitle(actorName, docType),
      body,
      link_path: link,
      thread_root_id: threadRootId,
      comment_id: threadRootId,
    })
  }
}

export async function notifyChatDocumentUpdated(
  projectId: string,
  documentId: string,
  actorId: string,
  actorName: string,
  chatMessageId: string,
): Promise<void> {
  const { docType } = await getDocumentMeta(documentId)
  if (!docType) return

  const link = buildChatLink(projectId, docType)

  await notifyProjectMembers(projectId, actorId, actorName, () => ({
    project_id: projectId,
    document_id: documentId,
    type: 'chat.document_updated',
    actor_id: actorId,
    actor_name: actorName,
    title: buildNotificationTitle(actorName, docType),
    body: 'AI 채팅으로 문서가 업데이트되었습니다',
    link_path: link,
    chat_message_id: chatMessageId,
  }))
}
