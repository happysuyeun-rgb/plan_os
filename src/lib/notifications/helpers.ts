import type { DocumentType, NotificationSummary, NotificationType, UserNotification } from '../../types'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_PATHS } from '../../types'

export function truncateText(text: string, max = 60): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export function buildCommentLink(
  projectId: string,
  docType: DocumentType,
  threadRootId: string,
): string {
  const path = DOCUMENT_TYPE_PATHS[docType]
  return `/projects/${projectId}/${path}?panel=comments&thread=${threadRootId}`
}

export function buildChatLink(projectId: string, docType: DocumentType): string {
  const path = DOCUMENT_TYPE_PATHS[docType]
  return `/projects/${projectId}/${path}?panel=chat`
}

export function buildNotificationTitle(actorName: string, docType: DocumentType | null): string {
  if (!docType) return actorName
  return `${actorName} · ${DOCUMENT_TYPE_LABELS[docType]}`
}

export function isCommentNotification(type: NotificationType): boolean {
  return type.startsWith('comment.')
}

export function isChatNotification(type: NotificationType): boolean {
  return type.startsWith('chat.')
}

export function computeNotificationSummary(
  items: UserNotification[],
  userId: string,
): NotificationSummary {
  const unread = items.filter((n) => n.user_id === userId && !n.read_at)
  const by_project: NotificationSummary['by_project'] = {}

  for (const n of unread) {
    if (!by_project[n.project_id]) {
      by_project[n.project_id] = { unread: 0, comment: 0, chat: 0 }
    }
    by_project[n.project_id].unread++
    if (isCommentNotification(n.type)) by_project[n.project_id].comment++
    if (isChatNotification(n.type)) by_project[n.project_id].chat++
  }

  return { total_unread: unread.length, by_project }
}

export function parseMentionNames(body: string): string[] {
  const matches = body.matchAll(/@([\w가-힣]+)/g)
  return [...new Set([...matches].map((m) => m[1]))]
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '방금 전'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR')
}
