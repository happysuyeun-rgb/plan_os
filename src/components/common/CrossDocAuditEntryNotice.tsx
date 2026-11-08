import { Link } from 'react-router-dom'

type Props = {
  projectId: string
  /** Distinct document types present on the project. */
  docTypeCount: number
  className?: string
}

/**
 * #34 / DEV-03 entry: when 2+ document types exist, offer cross-doc audit preview.
 * Routes to Mock `/ai-review` only — never claims verified engine PASS or paid hire.
 */
export function CrossDocAuditEntryNotice({
  projectId,
  docTypeCount,
  className = '',
}: Props) {
  if (docTypeCount < 2) return null

  const reviewHref = `/projects/${projectId}/ai-review`

  return (
    <aside
      role="note"
      aria-label="문서 교차검수 미리보기 안내"
      data-testid="cross-doc-audit-entry-notice"
      data-doc-type-count={String(docTypeCount)}
      className={`rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 ${className}`}
    >
      <p className="font-semibold">문서 {docTypeCount}종이 있습니다 · 누락·모순 검토 미리보기</p>
      <p className="mt-1 text-teal-900/90">
        교차검수 진입 후보입니다. 지금은 Mock 미리보기만 가능하며 자동 PASS·검증된 AI 성능·유료 결제를
        의미하지 않습니다.
      </p>
      <p className="mt-2">
        <Link
          to={reviewHref}
          className="font-semibold underline underline-offset-2"
          data-testid="cross-doc-audit-entry-cta"
        >
          AI 기획 검수 (Mock) 열기
        </Link>
      </p>
    </aside>
  )
}
