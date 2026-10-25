import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MIN_REVIEW_DOCUMENTS,
  runMockPlanningReview,
} from '../src/lib/ai/MockPlanningReviewProvider.ts'
import { readFileSync } from 'node:fs'

test('AC-01: two+ docs yield source_manifest and categorized findings', () => {
  const docs = [
    { id: 'd1', type: 'prd', content: '사용자는 로그인 후 대시보드에 진입한다.', revision: 2 },
    { id: 'd2', type: 'policy', content: '개인정보 보관 기간은 1년이다.', revision: 1 },
  ]
  const result = runMockPlanningReview(docs)
  assert.equal(result.mode, 'mock')
  assert.equal(result.providerId, 'mock-planning-reviewer')
  assert.equal(result.insufficientInput, false)
  assert.equal(result.sourceManifest.length, 2)
  assert.equal(result.sourceManifest[0].documentId, 'd1')
  assert.ok(result.findings.length >= 1)
  for (const f of result.findings) {
    assert.ok(f.category)
    assert.ok(f.reviewerState)
    assert.ok(f.citation.quote.length > 0)
  }
  assert.ok(result.findings.some((f) => /인증|정책/.test(f.summary)))
  assert.ok(docs.length >= MIN_REVIEW_DOCUMENTS)
})

test('AC-03: fewer than MIN docs marks insufficient_input (no quality claim)', () => {
  const result = runMockPlanningReview([
    { id: 'd1', type: 'prd', content: '서비스 소개만 있는 문서입니다.' },
  ])
  assert.equal(result.insufficientInput, true)
  assert.equal(result.sourceManifest.length, 1)
  assert.ok(result.findings.some((f) => f.severity === 'blocker' && f.category === 'untestable'))
  assert.ok(result.findings.some((f) => /부족|insufficient/i.test(f.summary + f.citation.rationale)))
  assert.equal(result.findings[0].reviewerState, 'proposed')
})

test('mock reviewer detects PRD auth vs policy gap (category=inconsistent)', () => {
  const result = runMockPlanningReview([
    { id: 'd1', type: 'prd', content: '사용자는 로그인 후 대시보드에 진입한다.' },
    { id: 'd2', type: 'policy', content: '개인정보 보관 기간은 1년이다.' },
  ])
  const gap = result.findings.find((f) => /인증|정책/.test(f.summary))
  assert.ok(gap)
  assert.equal(gap.category, 'inconsistent')
  assert.equal(gap.reviewerState, 'source_validated')
})

test('UI and orchestration mark mock / unpaid preview / browser-local store', () => {
  const page = readFileSync('src/pages/ProjectAiReviewPage.tsx', 'utf8')
  const run = readFileSync('src/lib/ai/runPlanningReview.ts', 'utf8')
  assert.match(page, /Mock/)
  assert.match(page, /REVIEW_STORE_MODE/)
  assert.match(page, /027/)
  assert.match(page, /ai-review-unpaid-preview/)
  assert.match(page, /ai-review-insufficient-block/)
  assert.match(page, /MIN_REVIEW_DOCUMENTS/)
  assert.match(run, /createServerTask/)
  assert.match(run, /prototypeTaskRepository/)
  assert.match(run, /sourceManifest|insufficientInput/)
  assert.match(run, /assertCanAiReview|Mock/i)
})

test('BFF plugin and Preview API force unpaid path', () => {
  const plugin = readFileSync('src/server/ai/viteAiBffPlugin.ts', 'utf8')
  const http = readFileSync('src/server/ai/generationHttp.ts', 'utf8')
  const api = readFileSync('api/ai/generate.ts', 'utf8')
  assert.match(plugin, /AI_GENERATE_PATH|\/api\/ai\/generate/)
  assert.match(http, /allowPaidCalls:\s*false/)
  assert.match(api, /allowPaidCalls:\s*false/)
})
