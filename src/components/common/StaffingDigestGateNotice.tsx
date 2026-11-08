import { Link } from 'react-router-dom'

type Props = {
  projectId: string
  /** When true, a manifest id is already bound for this flow. */
  hasManifest?: boolean
  className?: string
}

/**
 * E-06 Mock: remind that AI staffing/review must pin document digest via S2.
 * Does not claim paid execution; stale docs need re-select / re-consent.
 */
export function StaffingDigestGateNotice({
  projectId,
  hasManifest = false,
  className = '',
}: Props) {
  const auditsHref = `/projects/${projectId}/audits/new`

  return (
    <aside
      role="note"
      aria-label="문서 digest 고정 안내"
      data-testid="staffing-digest-gate-notice"
      data-has-manifest={hasManifest ? 'true' : 'false'}
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}
    >
      <p className="font-semibold">AI 투입 전 문서 snapshot(digest)을 고정하세요</p>
      <p className="mt-1 text-amber-900/90">
        검수·계약 Mock은 S2 manifest에 묶인 문서 버전만 읽습니다. 문서를 수정하면 digest가
        stale이 되어 실행 전 재검증·재선택이 필요합니다. 이 안내만으로 유료 실행이 시작되지 않습니다.
      </p>
      <p className="mt-2">
        {hasManifest ? (
          <span data-testid="staffing-digest-bound">manifest 연결됨 · 변경 시 검수 문서 선택에서 갱신</span>
        ) : (
          <Link to={auditsHref} className="font-semibold underline underline-offset-2">
            검수 문서 선택에서 manifest 저장
          </Link>
        )}
      </p>
    </aside>
  )
}
