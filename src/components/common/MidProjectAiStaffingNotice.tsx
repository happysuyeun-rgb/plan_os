import { Link } from 'react-router-dom'

type Props = {
  /** When set, deep-links to that project's specialist request + AI review. */
  projectId?: string
  className?: string
}

/**
 * Dual-entry E-03 notice: mid-project AI staffing Mock is additive.
 * Does not replace direct planning or human PM paths.
 */
export function MidProjectAiStaffingNotice({ projectId, className = '' }: Props) {
  const catalogHref = projectId ? `/projects/${projectId}/specialists` : '/projects'
  const requestHref = projectId ? `/projects/${projectId}/specialists/request` : '/projects'
  const reviewHref = projectId ? `/projects/${projectId}/ai-review` : '/projects'
  const plansHref = projectId ? `/projects/${projectId}/plans` : '/projects'

  return (
    <aside
      role="note"
      aria-label="진행 중 AI 투입 안내"
      data-testid="mid-project-ai-staffing-notice"
      className={`rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 ${className}`}
    >
      <p className="font-semibold">진행 중에도 AI 인력을 Mock으로 요청할 수 있습니다</p>
      <p className="mt-1 text-indigo-900/90">
        직접 기획·사람 PM 경로를 대체하지 않습니다. 실제 계약·과금·유료 LLM 실행은 없습니다.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-indigo-900/90">
        <li>
          {projectId ? (
            <>
              <Link to={catalogHref} className="font-medium underline underline-offset-2">
                AI 직원 카탈로그 Mock
              </Link>
              {' · '}
              <Link to={requestHref} className="font-medium underline underline-offset-2">
                업무 요청 Mock
              </Link>
            </>
          ) : (
            <span>프로젝트 → AI 직원 카탈로그 / 업무 요청 Mock</span>
          )}
        </li>
        <li>
          {projectId ? (
            <>
              <Link to={reviewHref} className="font-medium underline underline-offset-2">
                AI 기획 검수 (Mock)
              </Link>
              {' · '}
              <Link to={plansHref} className="font-medium underline underline-offset-2">
                사람 PM 계획
              </Link>
              {' (병행)'}
            </>
          ) : (
            <span>AI 기획 검수 Mock · 사람 PM 계획은 프로젝트에서 병행 가능</span>
          )}
        </li>
      </ul>
    </aside>
  )
}
