import type { NotificationType } from '../../types'

export type NotificationPreferences = {
  comments: boolean
  chat: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  comments: true,
  chat: true,
}

function storageKey(userId: string): string {
  return `planos-notification-prefs:${userId}`
}

export function readNotificationPreferences(userId: string): NotificationPreferences {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>
    return {
      comments: parsed.comments !== false,
      chat: parsed.chat !== false,
    }
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES }
  }
}

export function writeNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(prefs))
}

export function isNotificationTypeEnabled(
  prefs: NotificationPreferences,
  type: NotificationType,
): boolean {
  if (type.startsWith('comment.')) return prefs.comments
  if (type.startsWith('chat.')) return prefs.chat
  return true
}
