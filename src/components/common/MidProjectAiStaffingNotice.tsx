import { Link } from 'react-router-dom'

type Props = {
  /** When set, deep-links straight into that project's catalog. */
  projectId?: string
  className?: string
}

/**
 * Points to the single AI staffing entry (/ai-staff or project catalog).
 * Avoids scattering catalog / request / review / plans links.
 */
export function MidProjectAiStaffingNotice({ projectId, className = '' }: Props) {
  const href = projectId ? `/projects/${projectId}/specialists` : '/ai-staff'

  return (
    <aside
      role="note"
      aria-label="AI 직원 채용 안내"
      data-testid="mid-project-ai-staffing-notice"
      className={`rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 ${className}`}
    >
      <p className="font-semibold">AI 직원은 상단 메뉴 「AI 직원」에서 채용합니다</p>
      <p className="mt-1 text-indigo-900/90">
        카탈로그 → 업무 요청 한 줄 흐름입니다. 실제 계약·과금·유료 LLM은 없습니다.
      </p>
      <p className="mt-2">
        <Link to={href} className="font-semibold underline underline-offset-2">
          {projectId ? '이 프로젝트 카탈로그로 이동' : 'AI 직원 채용으로 이동'}
        </Link>
      </p>
    </aside>
  )
}
