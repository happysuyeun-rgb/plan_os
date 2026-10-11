import type { ProjectActivity } from '../../types'
import { ACTIVITY_ACTION_LABELS } from '../../types'

interface ActivityTimelineProps {
  activities: ProjectActivity[]
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">활동 기록이 없습니다</p>
  }

  return (
    <ul className="space-y-3">
      {activities.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
          <div>
            <p className="font-medium text-gray-800">{ACTIVITY_ACTION_LABELS[a.action]}</p>
            <p className="text-xs text-gray-400">
              {new Date(a.created_at).toLocaleString('ko-KR')}
            </p>
            {Object.keys(a.meta).length > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">
                {formatMeta(a.meta)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function formatMeta(meta: Record<string, unknown>): string {
  if (meta.email) return String(meta.email)
  if (meta.format) return String(meta.format)
  if (meta.from && meta.to) return `${meta.from} → ${meta.to}`
  return ''
}
