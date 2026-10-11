import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { NotificationItem } from '../dashboard/NotificationItem'
import { useNotificationStore } from '../../store/notificationStore'
import { cn } from '../../lib/utils'

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { items, summary, refresh, markRead } = useNotificationStore()

  useEffect(() => {
    refresh({ limit: 20 })
  }, [refresh])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unread = summary?.total_unread ?? 0
  const preview = items.slice(0, 8)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        aria-label={`알림${unread > 0 ? ` ${unread}건 미읽음` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-medium text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-900">알림</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {preview.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">새 알림이 없습니다</p>
            ) : (
              preview.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={(id) => {
                    markRead(id)
                    setOpen(false)
                  }}
                  compact
                />
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              navigate('/dashboard')
            }}
            className={cn(
              'w-full border-t border-gray-100 py-2.5 text-center text-xs text-brand-600 hover:bg-gray-50',
            )}
          >
            대시보드에서 모두 보기
          </button>
        </div>
      )}
    </div>
  )
}
