import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('store mode switch contract in factory source', () => {
  const factory = readFileSync('src/lib/ai/reviewStoreFactory.ts', 'utf8')
  const server = readFileSync('src/lib/ai/serverReviewJobStore.ts', 'utf8')
  assert.match(factory, /VITE_AI_REVIEW_STORE/)
  assert.match(factory, /REVIEW_STORE_MODE_SERVER/)
  assert.match(factory, /REVIEW_STORE_MODE_BROWSER/)
  assert.match(factory, /raw === 'server'/)
  assert.match(server, /SERVER_027/)
})

test('027 executable SQL is local_only not migrations', () => {
  const sql = readFileSync('supabase/local_only/027_ai_review_jobs.sql', 'utf8')
  assert.match(sql, /create table if not exists public\.ai_review_jobs/)
  assert.match(sql, /cas_ai_review_job/)
  assert.match(sql, /bind_ai_review_finding_task/)
  assert.match(sql, /can_access_project/)
  assert.match(sql, /can_edit_project_content/)
  assert.match(sql, /P4001/)
  assert.match(sql, /source_manifest/)
  assert.match(sql, /insufficient_input/)
  assert.match(sql, /reviewer_state/)
  const apply = readFileSync('scripts/apply-027-local-only.mjs', 'utf8')
  assert.match(apply, /127\.0\.0\.1|localhost/)
  assert.match(apply, /SUPABASE_ACCESS_TOKEN/)
  const draft = readFileSync('supabase/drafts/027_ai_review_jobs_DRAFT.sql', 'utf8')
  assert.match(draft, /local_only\/027_ai_review_jobs\.sql/)
  assert.doesNotMatch(draft, /create table if not exists public\.ai_review_jobs/)
  assert.match(draft, /PREVIEW_027_APPLY_RUNBOOK/)
})

test('Preview 027 apply runbook is gated and forbids local-only script on hosted', () => {
  const runbook = readFileSync('docs/plans/PREVIEW_027_APPLY_RUNBOOK_2026-10-25.md', 'utf8')
  assert.match(runbook, /Gate A-027/)
  assert.match(runbook, /apply-027-local-only/)
  assert.match(runbook, /FORBIDDEN|금지/)
  assert.match(runbook, /PlanOS-Preview/)
  assert.match(runbook, /VITE_AI_REVIEW_STORE=server/)
  assert.doesNotMatch(runbook, /db push.*027|migrations\/027/)
})

test('server store and pipeline factory wiring', () => {
  const server = readFileSync('src/lib/ai/serverReviewJobStore.ts', 'utf8')
  const pipeline = readFileSync('src/lib/ai/reviewPipeline.ts', 'utf8')
  assert.match(server, /cas_ai_review_job/)
  assert.match(server, /ServerReviewJobStore/)
  assert.match(pipeline, /createReviewStore/)
})

test('Playwright AI review E2E and API contracts exist', () => {
  const e2e = readFileSync('tests/e2e/browser_ai_review.mjs', 'utf8')
  assert.match(e2e, /ai-review-hire/)
  assert.match(e2e, /ai-review-viewer-readonly/)
  assert.match(e2e, /ai-review-unpaid-preview/)
  assert.match(e2e, /ai-review-insufficient-block/)
  assert.match(e2e, /\/api\/ai\/generate/)
  assert.match(e2e, /placeholder/)
  assert.match(e2e, /other_project|otherProjectId/)
  const envWriter = readFileSync('tests/e2e/local_browser_env.mjs', 'utf8')
  assert.match(envWriter, /VITE_AI_REVIEW_STORE/)
  assert.match(envWriter, /server/)
  assert.match(envWriter, /VITE_S1_SERVER_TASKS/)
})
