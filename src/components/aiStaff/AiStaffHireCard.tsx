import { Link } from 'react-router-dom'
import type { AiStaffCard } from '../../lib/aiStaffCatalog'
import { execBadgeLabel } from '../../lib/aiStaffCatalog'
import { cn } from '../../lib/utils'
import { AiStaffImageSlot } from './AiStaffImageSlot'

type Props = {
  role: AiStaffCard
  selected?: boolean
  detailHref?: string
  hireHref?: string
  hireLabel?: string
  onDetail?: () => void
  onHire?: () => void
  testId?: string
}

export function AiStaffHireCard({
  role,
  selected,
  detailHref,
  hireHref,
  hireLabel = '업무 맡기기',
  onDetail,
  onHire,
  testId,
}: Props) {
  const badge = execBadgeLabel(role)
  const hireEnabled = role.available && (Boolean(hireHref) || Boolean(onHire))

  return (
    <article
      data-testid={testId ?? `ai-staff-card-${role.id}`}
      data-role-id={role.id}
      className={cn(
        'flex flex-col gap-4 rounded-[1.75rem] border bg-white p-4 shadow-[0_10px_30px_rgba(88,70,180,0.06)] transition sm:flex-row sm:items-stretch sm:gap-5 sm:p-5',
        selected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-gray-100 hover:border-brand-200',
      )}
    >
      <AiStaffImageSlot src={role.imageSrc} alt={`${role.title} 이미지`} variant="card" />

      <div className="flex min-w-0 flex-1 flex-col">
        {badge && (
          <p
            className={cn(
              'mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold',
              role.execKind === 'live' ? 'text-emerald-600' : 'text-amber-600',
            )}
            data-testid={`ai-staff-badge-${role.id}`}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                role.execKind === 'live' ? 'bg-emerald-500' : 'bg-amber-500',
              )}
              aria-hidden
            />
            {badge}
          </p>
        )}

        <h3 className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">{role.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-500">{role.description}</p>

        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="키워드">
          {role.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-500 ring-1 ring-gray-100"
            >
              {tag}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {detailHref ? (
            <Link
              to={detailHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:flex-none"
            >
              자세히
            </Link>
          ) : (
            <button
              type="button"
              onClick={onDetail}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:flex-none"
            >
              자세히
            </button>
          )}

          {hireHref && hireEnabled ? (
            <Link
              to={hireHref}
              data-testid="ai-staff-catalog-request-cta"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:flex-none sm:min-w-[7.5rem]"
            >
              {hireLabel}
            </Link>
          ) : (
            <button
              type="button"
              data-testid={`ai-staff-hire-cta-${role.id}`}
              disabled={!hireEnabled}
              onClick={onHire}
              className={cn(
                'inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition sm:flex-none sm:min-w-[7.5rem]',
                hireEnabled
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400',
              )}
            >
              {hireEnabled ? hireLabel : '준비 중'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
