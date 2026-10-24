import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runMockPlanningReview } from '../src/lib/ai/MockPlanningReviewProvider.ts'
import { readFileSync } from 'node:fs'

test('mock reviewer flags missing persona in PRD', () => {
  const result = runMockPlanningReview([
    { id: 'd1', type: 'prd', content: '서비스 소개만 있는 문서입니다.' },
  ])
  assert.equal(result.mode, 'mock')
  assert.equal(result.providerId, 'mock-planning-reviewer')
  assert.ok(result.findings.some((f) => f.severity === 'blocker'))
  assert.ok(result.findings[0].citation.quote.length > 0)
})

test('mock reviewer detects PRD auth vs policy gap', () => {
  const result = runMockPlanningReview([
    { id: 'd1', type: 'prd', content: '사용자는 로그인 후 대시보드에 진입한다.' },
    { id: 'd2', type: 'policy', content: '개인정보 보관 기간은 1년이다.' },
  ])
  assert.ok(result.findings.some((f) => /인증|정책/.test(f.summary)))
})

test('UI and orchestration mark mock / browser-local store (not ops 027)', () => {
  const page = readFileSync('src/pages/ProjectAiReviewPage.tsx', 'utf8')
  const run = readFileSync('src/lib/ai/runPlanningReview.ts', 'utf8')
  assert.match(page, /Mock/)
  assert.match(page, /REVIEW_STORE_MODE/)
  assert.match(page, /027/)
  assert.match(run, /createServerTask/)
  assert.match(run, /prototypeTaskRepository/)
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
