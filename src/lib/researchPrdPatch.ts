import { parseDocumentOutline, replaceOutlineSection, type OutlineSection } from './documentOutline'

export type ResearchInsightKind = 'market' | 'competition' | 'customers' | 'opportunities'

export type ResearchInsight = {
  kind: ResearchInsightKind
  label: string
  markdown: string
}

export type PrdSectionPatch = {
  id: string
  action: 'replace' | 'insert'
  sectionTitle: string
  insightKind: ResearchInsightKind
  beforePreview: string
  afterBody: string
}

export type ResearchPrdPatchPlan = {
  patches: PrdSectionPatch[]
  nextContent: string
  researchTarget: string
  asOfDate: string | null
}

type ReportLike = {
  researchTarget?: string
  asOfDate?: string
  structuredSummaryKo?: string | null
  rawLinerAnswer?: string | null
  marketOverview?: string | null
}

const INSIGHT_DEFS: Array<{
  kind: ResearchInsightKind
  label: string
  titleMatchers: RegExp[]
  prdMatchers: RegExp[]
  insertTitle: string
}> = [
  {
    kind: 'market',
    label: '시장',
    titleMatchers: [/시장/, /market\s*overview/i, /현황/],
    prdMatchers: [/시장/, /제품\s*개요/, /^개요$/],
    insertTitle: '시장·경쟁 인사이트 (리서치)',
  },
  {
    kind: 'competition',
    label: '경쟁',
    titleMatchers: [/경쟁/, /competitor/i, /비교/],
    prdMatchers: [/경쟁/, /시장/, /문제\s*정의/],
    insertTitle: '시장·경쟁 인사이트 (리서치)',
  },
  {
    kind: 'customers',
    label: '고객·문제',
    titleMatchers: [/고객/, /문제/, /pain/i, /수요/],
    prdMatchers: [/문제\s*정의/, /대상\s*사용자/, /목표\s*사용자/, /사용자\s*목표/],
    insertTitle: '고객 문제·기회 (리서치)',
  },
  {
    kind: 'opportunities',
    label: '기회·위험',
    titleMatchers: [/기회/, /위험/, /차별/, /제안/, /risk/i, /opportunit/i],
    prdMatchers: [/제품\s*목표/, /성공\s*기준/, /가정/, /위험/],
    insertTitle: '시장 기회·위험 (리서치)',
  },
]

function cleanCitations(raw: string): string {
  return raw
    .replace(/\(\((\d+)\)\)/g, '[$1]')
    .replace(/\(\(([\d,\s()]+)\)\)/g, (_, inner: string) => {
      const nums = inner.match(/\d+/g) ?? []
      return nums.length ? `[${nums.join(',')}]` : ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Split research summary into labeled chunks (### headings or * **Title** bullets). */
export function extractResearchInsights(report: unknown): ResearchInsight[] {
  if (!report || typeof report !== 'object') return []
  const r = report as ReportLike
  const source = cleanCitations(
    (r.structuredSummaryKo || r.rawLinerAnswer || r.marketOverview || '').trim(),
  )
  if (!source) return []

  const chunks: Array<{ title: string; body: string }> = []
  const headingSplit = source.split(/\n(?=###\s+)/)
  if (headingSplit.length > 1 || /^###\s+/m.test(source)) {
    for (const part of headingSplit) {
      const m = part.match(/^###\s+(.+?)\s*\n([\s\S]*)$/)
      if (m) chunks.push({ title: m[1].trim(), body: m[2].trim() })
      else if (part.trim() && chunks.length === 0) {
        chunks.push({ title: '요약', body: part.trim() })
      }
    }
  } else {
    const boldBullet = /(?:^|\n)[*-]\s+\*\*([^*]+)\*\*\s*\n([\s\S]*?)(?=(?:\n[*-]\s+\*\*)|$)/g
    let match: RegExpExecArray | null
    while ((match = boldBullet.exec(source)) !== null) {
      chunks.push({ title: match[1].trim(), body: match[2].trim() })
    }
    if (chunks.length === 0) {
      chunks.push({ title: '리서치 요약', body: source })
    }
  }

  const byKind = new Map<ResearchInsightKind, string[]>()
  for (const chunk of chunks) {
    const def =
      INSIGHT_DEFS.find((d) => d.titleMatchers.some((re) => re.test(chunk.title))) ??
      (chunk.title === '리서치 요약' || chunk.title === '요약' ? INSIGHT_DEFS[0] : null)
    if (!def) continue
    const block = `### ${chunk.title}\n\n${chunk.body}`.trim()
    const list = byKind.get(def.kind) ?? []
    list.push(block)
    byKind.set(def.kind, list)
  }

  const insights: ResearchInsight[] = []
  for (const def of INSIGHT_DEFS) {
    const parts = byKind.get(def.kind)
    if (!parts?.length) continue
    insights.push({ kind: def.kind, label: def.label, markdown: parts.join('\n\n') })
  }

  if (insights.length === 0 && source) {
    insights.push({ kind: 'market', label: '시장', markdown: source.slice(0, 4000) })
  }

  return insights
}

function findSectionIndex(
  sections: OutlineSection[],
  matchers: RegExp[],
  used: Set<number>,
): number {
  for (const re of matchers) {
    const idx = sections.findIndex((s, i) => !used.has(i) && s.level >= 2 && re.test(s.title))
    if (idx >= 0) return idx
  }
  return -1
}

function buildSectionBody(sectionTitle: string, insightMarkdown: string, meta: string): string {
  return [
    `## ${sectionTitle.replace(/^#+\s*/, '')}`,
    '',
    '> 아래 내용은 시장조사 리서치 결과를 바탕으로 한 **섹션 패치**입니다. 수치·경쟁사 정보는 출처와 교차 확인하세요.',
    '',
    insightMarkdown.trim(),
    '',
    meta,
  ].join('\n')
}

function contentFromSections(sections: OutlineSection[]): string {
  return sections.map((s) => s.body).join('\n\n')
}

/**
 * Map research insights onto PRD ## sections (replace match or insert dedicated research sections).
 */
export function buildResearchPrdPatchPlan(
  prdContent: string,
  report: unknown,
): ResearchPrdPatchPlan {
  const r = report && typeof report === 'object' ? (report as ReportLike) : {}
  const insights = extractResearchInsights(report)
  const researchTarget = r.researchTarget?.trim() || '시장조사'
  const asOfDate = r.asOfDate ?? null
  const meta = `_출처: ${researchTarget}${asOfDate ? ` · 기준일 ${asOfDate}` : ''} · PlanOS 리서치 패치_`

  if (insights.length === 0) {
    return { patches: [], nextContent: prdContent, researchTarget, asOfDate }
  }

  const combinedMarket = insights.filter((i) => i.kind === 'market' || i.kind === 'competition')
  const others = insights.filter((i) => i.kind !== 'market' && i.kind !== 'competition')
  const work: ResearchInsight[] =
    combinedMarket.length > 1
      ? [
          {
            kind: 'market',
            label: '시장·경쟁',
            markdown: combinedMarket.map((i) => i.markdown).join('\n\n'),
          },
          ...others,
        ]
      : insights

  let sections = parseDocumentOutline(prdContent)
  const used = new Set<number>()
  const patches: PrdSectionPatch[] = []

  for (const insight of work) {
    const def = INSIGHT_DEFS.find((d) => d.kind === insight.kind) ?? INSIGHT_DEFS[0]
    const matchIdx = findSectionIndex(sections, def.prdMatchers, used)

    if (matchIdx >= 0) {
      used.add(matchIdx)
      const section = sections[matchIdx]
      const afterBody = buildSectionBody(section.title, insight.markdown, meta)
      patches.push({
        id: `replace-${insight.kind}-${matchIdx}`,
        action: 'replace',
        sectionTitle: section.title,
        insightKind: insight.kind,
        beforePreview: section.body.slice(0, 800),
        afterBody,
      })
      const next = replaceOutlineSection(contentFromSections(sections), sections, matchIdx, afterBody)
      sections = parseDocumentOutline(next)
      continue
    }

    const existing = sections.findIndex(
      (s, i) => !used.has(i) && s.title.includes('리서치') && def.prdMatchers.some((re) => re.test(s.title) || re.test(def.insertTitle)),
    )
    const researchExisting = sections.findIndex(
      (s, i) => !used.has(i) && s.title === def.insertTitle,
    )
    const targetExisting = researchExisting >= 0 ? researchExisting : existing

    if (targetExisting >= 0) {
      used.add(targetExisting)
      const section = sections[targetExisting]
      const afterBody = buildSectionBody(section.title, insight.markdown, meta)
      patches.push({
        id: `replace-${insight.kind}-research-${targetExisting}`,
        action: 'replace',
        sectionTitle: section.title,
        insightKind: insight.kind,
        beforePreview: section.body.slice(0, 800),
        afterBody,
      })
      const next = replaceOutlineSection(
        contentFromSections(sections),
        sections,
        targetExisting,
        afterBody,
      )
      sections = parseDocumentOutline(next)
      continue
    }

    const afterBody = buildSectionBody(def.insertTitle, insight.markdown, meta)
    patches.push({
      id: `insert-${insight.kind}`,
      action: 'insert',
      sectionTitle: def.insertTitle,
      insightKind: insight.kind,
      beforePreview: '(새 섹션)',
      afterBody,
    })
    const assumeIdx = sections.findIndex((s) => /가정|위험|추가\s*결정/.test(s.title))
    const bodies = sections.map((s) => s.body)
    if (assumeIdx >= 0) bodies.splice(assumeIdx, 0, afterBody)
    else bodies.push(afterBody)
    sections = parseDocumentOutline(bodies.join('\n\n'))
  }

  // Deduplicate by section title (market+competition may share insert title across loops — already combined).
  const unique: PrdSectionPatch[] = []
  const seen = new Set<string>()
  for (const p of patches) {
    const key = `${p.action}:${p.sectionTitle}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(p)
  }

  return {
    patches: unique,
    nextContent: contentFromSections(sections),
    researchTarget,
    asOfDate,
  }
}
