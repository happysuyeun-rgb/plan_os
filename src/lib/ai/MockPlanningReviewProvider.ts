/**
 * Mock AI planning-review employee (Phase D).
 * Heuristic findings only — never calls a paid LLM.
 * Quote offsets are exact slices (no trim) so citations verify against source.
 */

import type {
  ReviewFinding,
  ReviewFindingCategory,
  ReviewerState,
  SourceManifestEntry,
} from './reviewJob'

export type ReviewDocumentInput = {
  id: string
  type: string
  content: string
  revision?: number
}

export const MOCK_PLANNING_REVIEWER_ID = 'mock-planning-reviewer' as const

/** MVP AC-01: at least two project documents for a full Mock audit. */
export const MIN_REVIEW_DOCUMENTS = 2

export type MockPlanningReviewResult = {
  mode: 'mock'
  providerId: typeof MOCK_PLANNING_REVIEWER_ID
  findings: ReviewFinding[]
  sourceManifest: SourceManifestEntry[]
  insufficientInput: boolean
}

function windowAroundNeedle(content: string, needle: string, radius = 40) {
  const idx = content.toLowerCase().indexOf(needle.toLowerCase())
  if (idx < 0) {
    return { start: 0, end: Math.min(80, content.length) }
  }
  return {
    start: Math.max(0, idx - radius),
    end: Math.min(content.length, idx + needle.length + radius),
  }
}

function buildManifest(docs: ReviewDocumentInput[]): SourceManifestEntry[] {
  return docs.map((d) => ({
    documentId: d.id,
    documentType: d.type,
    revisionOrVersion: d.revision,
  }))
}

function finding(
  severity: ReviewFinding['severity'],
  category: ReviewFindingCategory,
  summary: string,
  doc: ReviewDocumentInput,
  needle: string,
  rationale: string,
  reviewerState: ReviewerState = 'source_validated',
): ReviewFinding {
  const { start, end } = windowAroundNeedle(doc.content, needle)
  return {
    id: crypto.randomUUID(),
    severity,
    category,
    summary,
    reviewerState,
    citation: {
      documentId: doc.id,
      documentType: doc.type,
      versionNumber: doc.revision,
      startOffset: start,
      endOffset: end,
      quote: doc.content.slice(start, end),
      rationale,
    },
  }
}

/** Pure heuristic reviewer for unit tests and Preview without paid AI. */
export function runMockPlanningReview(docs: ReviewDocumentInput[]): MockPlanningReviewResult {
  const sourceManifest = buildManifest(docs)

  if (docs.length < MIN_REVIEW_DOCUMENTS) {
    const anchor = docs[0]
    const findings: ReviewFinding[] = anchor
      ? [
          finding(
            'blocker',
            'untestable',
            `검수 입력이 부족합니다. 최소 ${MIN_REVIEW_DOCUMENTS}개 문서가 필요합니다 (현재 ${docs.length}개).`,
            anchor,
            anchor.content.slice(0, 24) || anchor.type,
            'AC-03 / FIRST_SPECIALIST: insufficient_input — do not claim project quality.',
            'proposed',
          ),
        ]
      : []
    return {
      mode: 'mock',
      providerId: MOCK_PLANNING_REVIEWER_ID,
      findings,
      sourceManifest,
      insufficientInput: true,
    }
  }

  const findings: ReviewFinding[] = []
  const byType = new Map(docs.map((d) => [d.type, d]))

  const prd = byType.get('prd')
  const policy = byType.get('policy')
  const wireframe = byType.get('wireframe')
  const ia = byType.get('ia')

  if (prd && !/\b(목표|사용자|persona|user)\b/i.test(prd.content)) {
    findings.push(
      finding(
        'blocker',
        'missing',
        'PRD에 목표 사용자(또는 persona) 서술이 없습니다.',
        prd,
        prd.content.slice(0, 20) || 'PRD',
        '기획 검수 기준: PRD는 대상 사용자를 명시해야 합니다.',
      ),
    )
  }

  if (prd && policy) {
    const prdMentionsAuth = /로그인|인증|auth/i.test(prd.content)
    const policyMentionsAuth = /로그인|인증|auth|권한/i.test(policy.content)
    if (prdMentionsAuth && !policyMentionsAuth) {
      findings.push(
        finding(
          'warning',
          'inconsistent',
          'PRD는 인증을 언급하지만 정책 문서에 대응 조항이 없습니다.',
          policy,
          policy.content.slice(0, 24) || 'policy',
          'PRD–정책 충돌/누락 후보 (Mock heuristic).',
        ),
      )
    }
  }

  if (
    wireframe &&
    prd &&
    /결제|billing|payment/i.test(prd.content) &&
    !/결제|billing|payment/i.test(wireframe.content)
  ) {
    findings.push(
      finding(
        'warning',
        'missing',
        'PRD의 결제 흐름이 화면설계(wireframe)에 반영되지 않은 것으로 보입니다.',
        wireframe,
        wireframe.content.slice(0, 24) || 'wireframe',
        '문서 간 누락 후보 (Mock).',
      ),
    )
  }

  if (ia && prd && prd.content.length > 200 && ia.content.trim().length < 40) {
    findings.push(
      finding(
        'info',
        'untestable',
        'IA 문서가 PRD 분량 대비 지나치게 짧습니다. 정보구조 보완이 필요할 수 있습니다.',
        ia,
        ia.content.slice(0, 24) || 'ia',
        '완성도 휴리스틱 (Mock).',
      ),
    )
  }

  if (findings.length === 0 && docs[0]) {
    findings.push(
      finding(
        'info',
        'missing',
        'Mock 검수: 치명적 누락 패턴은 탐지되지 않았습니다. (유료 LLM 미사용)',
        docs[0],
        docs[0].content.slice(0, 24) || docs[0].type,
        '통과 후보 — 실제 LLM 검수 전 참고용입니다. finding 0 ≠ 품질 보증.',
        'proposed',
      ),
    )
  }

  return {
    mode: 'mock',
    providerId: MOCK_PLANNING_REVIEWER_ID,
    findings,
    sourceManifest,
    insufficientInput: false,
  }
}
