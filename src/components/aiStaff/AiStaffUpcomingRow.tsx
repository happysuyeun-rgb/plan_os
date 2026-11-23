import { CalendarDays } from 'lucide-react'
import type { AiStaffCard } from '../../lib/aiStaffCatalog'
import { AiStaffImageSlot } from './AiStaffImageSlot'

type Props = {
  roles: AiStaffCard[]
}

export function AiStaffUpcomingRow({ roles }: Props) {
  if (roles.length === 0) return null

  return (
    <section
      aria-label="곧 합류할 AI 직원"
      className="rounded-[1.75rem] border border-gray-100 bg-white px-5 py-5 shadow-[0_8px_24px_rgba(88,70,180,0.05)] sm:px-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden />
        <h2 className="text-base font-bold text-gray-900">곧 합류할 AI 직원</h2>
      </div>
      <ul className="flex gap-5 overflow-x-auto pb-1">
        {roles.map((role) => (
          <li
            key={role.id}
            className="flex w-[4.75rem] shrink-0 flex-col items-center gap-2 text-center"
            data-testid={`ai-staff-upcoming-${role.id}`}
            data-future-ref={role.futureRef ?? ''}
          >
            <AiStaffImageSlot src={role.imageSrc} alt={role.shortTitle} variant="avatar" />
            <p className="truncate text-xs font-semibold text-gray-800">{role.shortTitle}</p>
            <p className="text-[10px] font-medium text-gray-400">준비 중</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
