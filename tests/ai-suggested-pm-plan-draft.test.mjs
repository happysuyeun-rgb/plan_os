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

test('ai suggested draft builder is labeled Mock and not a paid AI PM claim', () => {
  assert.match(draftSrc, /AI 제안 Mock/)
  assert.match(draftSrc, /실제 AI PM 실행 아님/)
  assert.match(draftSrc, /buildAiSuggestedPlanDraft/)
  assert.doesNotMatch(draftSrc, /유료|결제|LLM 실행/)
})

test('createPmPlan accepts ai_suggested source for display-only persistence', () => {
  assert.match(apiSrc, /source:\s*PmPlanSource\s*=\s*'human'/)
  assert.match(apiSrc, /p_source:\s*source/)
  assert.match(apiSrc, /ai_suggested` does not start AI execution/)
})

test('list page exposes Mock suggest CTA without claiming live AI PM', () => {
  assert.match(listSrc, /AI 제안 초안\(Mock\)/)
  assert.match(listSrc, /ai_suggested/)
  assert.match(listSrc, /buildAiSuggestedPlanDraft/)
  assert.match(listSrc, /실행·결제가 아닙니다/)
})

test('detail page warns ai_suggested is Mock not verified AI PM output', () => {
  assert.match(detailSrc, /AI 제안 Mock/)
  assert.match(detailSrc, /검증된 AI PM 실행 결과가 아니/)
})

test('migration 032 allows human|ai_suggested and keeps default human', () => {
  assert.match(mig, /p_source text default 'human'/)
  assert.match(mig, /v_source not in \('human', 'ai_suggested'\)/)
  assert.match(mig, /Does NOT start AI execution/)
})
