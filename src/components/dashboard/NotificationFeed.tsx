import { useEffect } from 'react'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { NotificationItem } from './NotificationItem'
import { useNotificationStore } from '../../store/notificationStore'

interface NotificationFeedProps {
  limit?: number
  className?: string
}

export function NotificationFeed({ limit = 30, className }: NotificationFeedProps) {
  const { items, isLoading, refresh, markRead, markAllRead } = useNotificationStore()

  useEffect(() => {
    refresh({ limit })
  }, [refresh, limit])

  const unreadCount = items.filter((n) => !n.read_at).length

  return (
    <aside
      className={`flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white ${className ?? ''}`}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">알림</h2>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead()}
            className="text-xs text-brand-600 hover:text-brand-700"
          >
            모두 읽음
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && items.length === 0 ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-400">
            모든 피드백을 확인했습니다
          </p>
        ) : (
          items.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={markRead} />
          ))
        )}
      </div>
    </aside>
  )
}
