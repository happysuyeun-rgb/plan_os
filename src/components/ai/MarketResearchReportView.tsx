type Source = {
  title?: string | null
  url?: string
  hostname?: string | null
  description?: string | null
  publishedDate?: string | null
  urlValid?: boolean
  kind?: string
}

type Report = {
  kind?: string
  runId?: string
  asOfDate?: string
  researchTarget?: string
  region?: string
  researchDepth?: string
  marketOverview?: string | null
  rawLinerAnswer?: string | null
  structuredSummaryKo?: string | null
  factVsAnalysis?: { factsFromLiner?: string; analysisNote?: string }
  sources?: Source[]
  unverifiedOrWeakEvidence?: string[]
  goalAndScope?: { goal?: string; ownerTask?: string; acceptanceCriteria?: string }
  engine?: string
  usage?: Record<string, unknown>
}

function asReport(value: unknown): Report | null {
  if (!value || typeof value !== 'object') return null
  return value as Report
}

export function MarketResearchReportView({
  resultJson,
  runId,
}: {
  resultJson: unknown
  runId?: string
}) {
  const report = asReport(resultJson)
  if (!report) {
    return <p className="text-sm text-gray-500">보고서 데이터가 없습니다.</p>
  }

  const linkedRun = report.runId || runId
  const answer = report.rawLinerAnswer || report.marketOverview || ''
  const sources = Array.isArray(report.sources) ? report.sources : []

  return (
    <article className="space-y-4" data-testid="market-research-report">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
          시장조사 보고서 · {report.kind || 'market_research_report_v1'}
        </p>
        <h3 className="text-lg font-bold text-gray-900">
          {report.researchTarget || report.goalAndScope?.goal || '시장조사'}
        </h3>
        <p className="text-xs text-gray-600">
          조사 기준일 {report.asOfDate || '—'} · 지역 {report.region || '—'} · 수준{' '}
          {report.researchDepth || '—'}
          {linkedRun ? ` · run ${linkedRun}` : ''}
          {report.engine ? ` · engine ${report.engine}` : ''}
        </p>
      </header>

      {report.goalAndScope && (
        <section className="rounded-lg border border-teal-100 bg-white p-3 text-sm">
          <h4 className="font-semibold text-gray-800">조사 목표 및 범위</h4>
          <p className="mt-1 text-gray-700">{report.goalAndScope.ownerTask}</p>
          <p className="mt-1 text-xs text-gray-500">완료 기준: {report.goalAndScope.acceptanceCriteria}</p>
        </section>
      )}

      {report.structuredSummaryKo && (
        <section className="rounded-lg border bg-white p-3 text-sm" data-testid="market-research-summary">
          <h4 className="font-semibold text-gray-800">구조화 요약 (분석)</h4>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-gray-700">{report.structuredSummaryKo}</pre>
        </section>
      )}

      <section className="rounded-lg border bg-white p-3 text-sm" data-testid="market-research-facts">
        <h4 className="font-semibold text-gray-800">시장 현황 · Liner 근거 답변 (사실)</h4>
        <p className="mt-1 text-xs text-teal-800">
          {report.factVsAnalysis?.analysisNote ||
            '아래 본문은 Liner 검색 응답이며, 해석·제안과 구분해서 읽으세요.'}
        </p>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-gray-800">
          {answer || '(답변 없음)'}
        </pre>
      </section>

      <section className="rounded-lg border bg-white p-3 text-sm" data-testid="market-research-sources">
        <h4 className="font-semibold text-gray-800">출처 URL</h4>
        {sources.length === 0 ? (
          <p className="mt-2 text-gray-500">표시할 출처가 없습니다.</p>
        ) : (
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {sources.map((s, i) => (
              <li key={`${s.url}-${i}`}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-teal-800 underline"
                >
                  {s.title || s.url}
                </a>
                <span className="ml-2 text-xs text-gray-500">
                  {s.hostname || ''}
                  {s.publishedDate ? ` · ${s.publishedDate}` : ''}
                  {s.urlValid === false ? ' · 유효성 실패' : ''}
                </span>
                {s.description && <p className="text-xs text-gray-600">{s.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {Array.isArray(report.unverifiedOrWeakEvidence) && report.unverifiedOrWeakEvidence.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <h4 className="font-semibold text-amber-900">미확인·근거 부족</h4>
          <ul className="mt-2 list-disc pl-5 text-amber-950">
            {report.unverifiedOrWeakEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
