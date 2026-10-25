import { Link } from 'react-router-dom'

type Lane = 'human-pm' | 'ai-review'

type Props = {
  projectId?: string
  /** Which lane the current page belongs to. */
  lane: Lane
  className?: string
}

/**
 * Dual-entry reminder: human PM (`/plans`) and AI review Mock (`/ai-review`)
 * run in parallel. Neither path replaces the other.
 */
export function DualEntryLaneNotice({ projectId, lane, className = '' }: Props) {
  const plansHref = projectId ? `/projects/${projectId}/plans` : '/projects'
  const reviewHref = projectId ? `/projects/${projectId}/ai-review` : '/projects'
  const onHumanPm = lane === 'human-pm'

  return (
    <aside
      role="note"
      aria-label="사람 PM과 AI 검수 병행 안내"
      data-testid="dual-entry-lane-notice"
      data-lane={lane}
      className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 ${className}`}
    >
      <p className="font-semibold">
        {onHumanPm
          ? '사람 PM 계획과 AI 기획 검수는 병행합니다'
          : 'AI 기획 검수와 사람 PM 계획은 병행합니다'}
      </p>
      <p className="mt-1 text-slate-700">
        한쪽이 다른 쪽을 대체하지 않습니다. AI 검수는 Mock·무과금이며 유료 LLM·계약·결제가 없습니다.
      </p>
      <p className="mt-2">
        {onHumanPm ? (
          projectId ? (
            <>
              병행 경로:{' '}
              <Link to={reviewHref} className="font-medium text-indigo-800 underline underline-offset-2">
                AI 기획 검수 (Mock)
              </Link>
            </>
          ) : (
            <span>병행 경로: 프로젝트 → AI 기획 검수 (Mock)</span>
          )
        ) : projectId ? (
          <>
            병행 경로:{' '}
            <Link to={plansHref} className="font-medium text-indigo-800 underline underline-offset-2">
              사람 PM 계획
            </Link>
          </>
        ) : (
          <span>병행 경로: 프로젝트 → 사람 PM 계획</span>
        )}
      </p>
    </aside>
  )
}
