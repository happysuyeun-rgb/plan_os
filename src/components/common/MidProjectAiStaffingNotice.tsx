import { Link } from 'react-router-dom'

type Props = {
  /** When set, deep-links straight into that project's catalog. */
  projectId?: string
  className?: string
}

/**
 * E-03: mid-project AI staffing entry (catalog /ai-staff).
 * Not a mode switch — direct planning stays available.
 */
export function MidProjectAiStaffingNotice({ projectId, className = '' }: Props) {
  const href = projectId ? `/projects/${projectId}/specialists` : '/ai-staff'
  const auditsHref = projectId ? `/projects/${projectId}/audits/new` : null

  return (
    <aside
      role="note"
      aria-label="AI 직원 채용 안내"
      data-testid="mid-project-ai-staffing-notice"
      className={`rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 ${className}`}
    >
      <p className="font-semibold">진행 중에도 AI 직원을 투입할 수 있습니다</p>
      <p className="mt-1 text-indigo-900/90">
        상단 「AI 직원」·프로젝트 카탈로그에서 요청합니다. 프로젝트를 다시 만들 필요 없습니다.
        실제 계약·과금·유료 LLM은 없습니다.
      </p>
      {auditsHref && (
        <p className="mt-1 text-xs text-indigo-900/80">
          투입 전 문서 digest 고정이 필요하면{' '}
          <Link to={auditsHref} className="underline underline-offset-2">
            검수 문서 선택
          </Link>
          을 사용하세요 (E-06 Mock).
        </p>
      )}
      <p className="mt-2">
        <Link to={href} className="font-semibold underline underline-offset-2">
          {projectId ? '이 프로젝트 카탈로그로 이동' : 'AI 직원 채용으로 이동'}
        </Link>
      </p>
    </aside>
  )
}
