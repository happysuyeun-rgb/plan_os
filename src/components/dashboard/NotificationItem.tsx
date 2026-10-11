import { useNavigate } from 'react-router-dom'
import type { UserNotification } from '../../types'
import { formatRelativeTime, isChatNotification } from '../../lib/notifications/helpers'
import { cn } from '../../lib/utils'

interface NotificationItemProps {
  notification: UserNotification
  onRead: (id: string) => void
  compact?: boolean
}

export function NotificationItem({ notification, onRead, compact }: NotificationItemProps) {
  const navigate = useNavigate()
  const isUnread = !notification.read_at
  const icon = isChatNotification(notification.type) ? '💬' : '🗨'

  const handleClick = () => {
    if (isUnread) onRead(notification.id)
    navigate(notification.link_path)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50',
        isUnread && 'border-l-[3px] border-l-brand-500 bg-brand-50/50',
        compact && 'px-3 py-2.5',
      )}
    >
      <span className="mt-0.5 shrink-0 text-base" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm text-gray-900', isUnread && 'font-medium')}>
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{notification.body}</p>
        <p className="mt-1 text-[11px] text-gray-400">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
    </button>
  )
}
