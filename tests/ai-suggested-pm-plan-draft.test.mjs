import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const draftSrc = readFileSync(new URL('../src/lib/aiSuggestedPmPlanDraft.ts', import.meta.url), 'utf8')
const apiSrc = readFileSync(new URL('../src/lib/api/pmPlans.ts', import.meta.url), 'utf8')
const listSrc = readFileSync(new URL('../src/pages/PmPlanListPage.tsx', import.meta.url), 'utf8')
const detailSrc = readFileSync(new URL('../src/pages/PmPlanDetailPage.tsx', import.meta.url), 'utf8')
const mig = readFileSync(
  new URL('../supabase/migrations/032_pm_plan_ai_suggested_source.sql', import.meta.url),
  'utf8',
)

test('ai suggested draft prefers Gemini BFF and keeps honest non-hire labels', () => {
  assert.match(draftSrc, /buildAiSuggestedPlanDraftAsync/)
  assert.match(draftSrc, /generateDocumentViaBff/)
  assert.match(draftSrc, /mode: 'gemini'/)
  assert.match(draftSrc, /템플릿 폴백/)
  assert.match(draftSrc, /Does not start AI PM hire/)
  assert.doesNotMatch(draftSrc, /AI 제안 Mock/)
})

test('createPmPlan accepts ai_suggested source for display-only persistence', () => {
  assert.match(apiSrc, /source:\s*PmPlanSource\s*=\s*'human'/)
  assert.match(apiSrc, /p_source:\s*source/)
  assert.match(apiSrc, /ai_suggested` does not start AI execution/)
})

test('list page exposes Gemini suggest CTA without claiming live AI PM hire', () => {
  assert.match(listSrc, /Gemini AI 제안/)
  assert.match(listSrc, /AI 제안 초안/)
  assert.match(listSrc, /ai_suggested/)
  assert.match(listSrc, /buildAiSuggestedPlanDraftAsync/)
  assert.match(listSrc, /채용·실행·결제가 아닙니다/)
  assert.doesNotMatch(listSrc, /AI 제안 초안\(Mock\)/)
})

test('detail page warns ai_suggested is Gemini draft not hired AI PM output', () => {
  assert.match(detailSrc, /Gemini AI 제안/)
  assert.match(detailSrc, /AI PM 채용·워커 실행 결과가 아니/)
  assert.doesNotMatch(detailSrc, /AI 제안 Mock/)
})

test('migration 032 allows human|ai_suggested and keeps default human', () => {
  assert.match(mig, /p_source text default 'human'/)
  assert.match(mig, /v_source not in \('human', 'ai_suggested'\)/)
  assert.match(mig, /Does NOT start AI execution/)
})
