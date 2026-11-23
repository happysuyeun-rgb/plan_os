import type { ReactNode } from 'react'
import {
  AI_STAFF_CATEGORY_FILTERS,
  type AiStaffCategory,
} from '../../lib/aiStaffCatalog'
import { cn } from '../../lib/utils'
import { AiStaffImageSlot } from './AiStaffImageSlot'

type Props = {
  category?: 'all' | AiStaffCategory
  onCategoryChange?: (next: 'all' | AiStaffCategory) => void
  /** Hide 전체/리서치/기획… chips (e.g. dashboard promo). Default true. */
  showCategoryFilters?: boolean
  /** Replaces filter chips when provided (or shown below title when filters hidden). */
  cta?: ReactNode
  /** Optional hero art; default path under public/ai-staff/hero.png */
  heroImageSrc?: string
  eyebrow?: string
  title?: string
  subtitle?: string
}

export function AiStaffMarketplaceHero({
  category = 'all',
  onCategoryChange,
  showCategoryFilters = true,
  cta,
  heroImageSrc = '/ai-staff/hero.png',
  eyebrow = 'AI 인력사무소',
  title = '내 프로젝트에 딱 맞는 AI 직원 찾기',
  subtitle = '필요한 전문가를 선택하고 업무를 맡겨보세요',
}: Props) {
  return (
    <header className="landing-rise grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.7fr)]">
      <div className="space-y-5">
        <p className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
          {eyebrow}
        </p>
        <div className="space-y-2">
          <h1 className="landing-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-gray-500 sm:text-base">{subtitle}</p>
        </div>

        {showCategoryFilters && onCategoryChange ? (
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="직무 카테고리"
          >
            {AI_STAFF_CATEGORY_FILTERS.map((chip) => {
              const active = category === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`ai-staff-filter-${chip.id}`}
                  onClick={() => onCategoryChange(chip.id)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50',
                  )}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        ) : null}

        {cta ? <div className="pt-1">{cta}</div> : null}
      </div>

      <div className="landing-drift mx-auto w-full max-w-[280px] lg:mx-0 lg:justify-self-end">
        <AiStaffImageSlot src={heroImageSrc} alt="AI 인력사무소 히어로" variant="hero" />
      </div>
    </header>
  )
}
