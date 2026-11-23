import { useMemo, useState, type ReactNode } from 'react'
import { marked } from 'marked'
import { cn } from '../../lib/utils'

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

marked.setOptions({ breaks: true, gfm: true })

const REGION_LABEL: Record<string, string> = {
  KR: '한국',
  US: '미국',
  GLOBAL: '글로벌',
}

const DEPTH_LABEL: Record<string, string> = {
  standard: '표준',
  deep: '심층',
}

function asReport(value: unknown): Report | null {
  if (!value || typeof value !== 'object') return null
  return value as Report
}

/** Soften citation noise and turn bold-only bullets into section headings. */
function cleanResearchText(raw: string): string {
  return raw
    .replace(/\(\((\d+)\)\)/g, '[$1]')
    .replace(/\(\(([\d,\s()]+)\)\)/g, (_, inner: string) => {
      const nums = inner.match(/\d+/g) ?? []
      return nums.length ? `[${nums.join(',')}]` : ''
    })
    .replace(/^[*\-]\s+\*\*([^*\n]+)\*\*\s*$/gm, '\n### $1\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function ReportMarkdown({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => {
    try {
      return marked.parse(cleanResearchText(content || '')) as string
    } catch {
      return `<p>${cleanResearchText(content || '')}</p>`
    }
  }, [content])

  return (
    <div
      className={cn(
        'mr-report text-[15px] leading-7 text-gray-800',
        '[&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900',
        '[&_h2]:mb-2.5 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900',
        '[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900',
        '[&_p]:mb-3 [&_p]:text-gray-700',
        '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5',
        '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5',
        '[&_ul_ul]:mt-2 [&_ul_ul]:space-y-2 [&_ul_ul]:pl-4',
        '[&_li]:leading-7 [&_li]:text-gray-700',
        '[&_li>p]:mb-0',
        '[&_strong]:font-semibold [&_strong]:text-gray-900',
        '[&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-teal-200 [&_blockquote]:bg-teal-50/50 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:text-gray-700',
        '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:text-sm',
        '[&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-800',
        '[&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-gray-700',
        '[&_tr:nth-child(even)_td]:bg-gray-50/60',
        '[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-50 [&_pre]:p-3 [&_pre]:text-sm',
        '[&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:text-[0.9em]',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
      {children}
    </span>
  )
}

export function MarketResearchReportView({
  resultJson,
  runId,
}: {
  resultJson: unknown
  runId?: string
}) {
  const report = asReport(resultJson)
  const [showRaw, setShowRaw] = useState(false)

  if (!report) {
    return <p className="text-sm text-gray-500">보고서 데이터가 없습니다.</p>
  }

  const title = report.researchTarget || report.goalAndScope?.goal || '시장조사'
  const summary = report.structuredSummaryKo?.trim() || ''
  const answer = (report.rawLinerAnswer || report.marketOverview || '').trim()
  const sources = Array.isArray(report.sources) ? report.sources : []
  const primary = summary || answer
  const hasSeparateAnswer = Boolean(summary && answer && answer !== summary)

  return (
    <article className="space-y-5" data-testid="market-research-report">
      <header className="space-y-3 border-b border-gray-100 pb-4">
        <p className="text-xs font-semibold tracking-wide text-teal-700">시장조사 보고서</p>
        <h3 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {report.asOfDate && <MetaChip>기준일 {report.asOfDate}</MetaChip>}
          {report.region && (
            <MetaChip>지역 {REGION_LABEL[report.region] || report.region}</MetaChip>
          )}
          {report.researchDepth && (
            <MetaChip>수준 {DEPTH_LABEL[report.researchDepth] || report.researchDepth}</MetaChip>
          )}
          <MetaChip>출처 {sources.length}건</MetaChip>
        </div>
      </header>

      {report.goalAndScope?.ownerTask && (
        <section className="rounded-xl bg-teal-50/70 px-4 py-3 text-sm text-teal-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">조사 요청</p>
          <p className="mt-1 leading-relaxed">{report.goalAndScope.ownerTask}</p>
          {report.goalAndScope.acceptanceCriteria && (
            <p className="mt-2 text-xs text-teal-800/80">
              완료 기준 · {report.goalAndScope.acceptanceCriteria}
            </p>
          )}
        </section>
      )}

      {primary && (
        <section
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          data-testid="market-research-summary"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h4 className="text-base font-bold text-gray-900">
              {summary ? '핵심 요약' : '조사 결과'}
            </h4>
            {summary && (
              <span className="text-xs text-gray-400">분석 · 출처 번호는 [n]으로 표시</span>
            )}
          </div>
          <ReportMarkdown content={primary} />
        </section>
      )}

      {hasSeparateAnswer && (
        <section
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          data-testid="market-research-facts"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-bold text-gray-900">상세 근거</h4>
              <p className="mt-0.5 text-xs text-gray-500">
                {report.factVsAnalysis?.analysisNote ||
                  '검색 엔진이 수집한 근거 답변입니다. 요약과 함께 확인하세요.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {showRaw ? '접기' : '펼쳐 보기'}
            </button>
          </div>
          {showRaw && (
            <div className="mt-4 max-h-[32rem] overflow-auto rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <ReportMarkdown content={answer} />
            </div>
          )}
        </section>
      )}

      <section
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        data-testid="market-research-sources"
      >
        <h4 className="text-base font-bold text-gray-900">출처</h4>
        {sources.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">표시할 출처가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {sources.map((s, i) => (
              <li key={`${s.url}-${i}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-800">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-teal-800 underline-offset-2 hover:underline"
                  >
                    {s.title || s.url}
                  </a>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {s.hostname || ''}
                    {s.publishedDate ? ` · ${s.publishedDate}` : ''}
                    {s.urlValid === false ? ' · 링크 확인 필요' : ''}
                  </p>
                  {s.description && (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">
                      {s.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {Array.isArray(report.unverifiedOrWeakEvidence) && report.unverifiedOrWeakEvidence.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <h4 className="font-semibold text-amber-950">참고 · 근거가 약한 부분</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-950/90">
            {report.unverifiedOrWeakEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {(runId || report.runId) && (
        <p className="text-[11px] text-gray-400">실행 ID {(report.runId || runId)?.slice(0, 8)}…</p>
      )}
    </article>
  )
}
