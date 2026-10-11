interface ProjectNotificationBadgesProps {
  comment?: number
  chat?: number
}

export function ProjectNotificationBadges({ comment = 0, chat = 0 }: ProjectNotificationBadgesProps) {
  if (comment <= 0 && chat <= 0) return null

  return (
    <div className="flex items-center gap-1">
      {comment > 0 && (
        <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
          🗨{comment > 99 ? '99+' : comment}
        </span>
      )}
      {chat > 0 && (
        <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
          💬{chat > 99 ? '99+' : chat}
        </span>
      )}
    </div>
  )
}
