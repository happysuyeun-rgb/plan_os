/**
 * End-to-end Mock planning-review flow (node:test, no Playwright):
 * docs → cited findings → accept → task map → reconnect → reject path.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { MemoryCasReviewJobStore } from '../src/lib/ai/browserReviewJobStore.ts'
import { runMockPlanningReview } from '../src/lib/ai/MockPlanningReviewProvider.ts'
import { assertFindingsMatchDocuments } from '../src/lib/ai/citationVerify.ts'
import { canAiReview } from '../src/lib/ai/reviewAccess.ts'
import { transitionReviewJob } from '../src/lib/ai/reviewJob.ts'

test('Mock E2E: run-accept-task-reconnect with RBAC', () => {
  assert.equal(canAiReview('viewer', 'run'), false)
  assert.equal(canAiReview('editor', 'run'), true)

  const store = new MemoryCasReviewJobStore()
  const docs = [
    { id: 'prd1', type: 'prd', content: '사용자는 로그인 후 대시보드에 진입한다.', revision: 2 },
    { id: 'pol1', type: 'policy', content: '개인정보 보관 기간은 1년이다.', revision: 1 },
  ]
  const mock = runMockPlanningReview(docs)
  assertFindingsMatchDocuments(mock.findings, docs)
  assert.equal(mock.insufficientInput, false)
  assert.equal(mock.sourceManifest.length, 2)
  assert.ok(mock.findings.length >= 1)
  assert.ok(mock.findings.every((f) => f.category && f.reviewerState))

  let job = store.put({
    id: crypto.randomUUID(),
    projectId: 'e2e-project',
    status: 'queued',
    findings: [],
    acceptedFindingTaskIds: {},
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  job = store.put(transitionReviewJob(job, 'running'))
  job = store.put(
    transitionReviewJob(job, 'awaiting_human', {
      findings: mock.findings,
      sourceManifest: mock.sourceManifest,
      insufficientInput: mock.insufficientInput,
    }),
  )

  const findingId = job.findings[0].id
  const taskId = 's1-1'
  job = store.putCas(
    transitionReviewJob(job, 'accepted', {
      linkedTaskId: taskId,
      acceptedFindingTaskIds: { [findingId]: taskId },
    }),
    job.version,
  )

  const reReview = store.put({
    id: crypto.randomUUID(),
    projectId: 'e2e-project',
    status: 'queued',
    findings: [],
    parentReviewJobId: job.id,
    sourceTaskId: taskId,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  assert.equal(job.status, 'accepted')
  assert.equal(job.acceptedFindingTaskIds[findingId], taskId)
  assert.equal(reReview.status, 'queued')
  assert.equal(reReview.parentReviewJobId, job.id)
  assert.equal(reReview.sourceTaskId, taskId)

  const again = store.listByProject('e2e-project')
  assert.ok(again.some((j) => j.id === job.id && j.status === 'accepted'))
  assert.ok(again.some((j) => j.id === reReview.id))
})

test('Mock E2E: request changes rejects job', () => {
  const store = new MemoryCasReviewJobStore()
  let job = store.put({
    id: 'e2e-reject',
    projectId: 'p',
    status: 'queued',
    findings: [],
    version: 0,
    createdAt: 't',
    updatedAt: 't',
  })
  job = store.put(transitionReviewJob(job, 'running'))
  job = store.put(transitionReviewJob(job, 'awaiting_human', { findings: [] }))
  job = store.put(transitionReviewJob(job, 'rejected', { errorMessage: '범위 수정 필요' }))
  assert.equal(job.status, 'rejected')
  assert.match(job.errorMessage, /범위/)
})

test('Preview API route and Vite plugin stay distinct', () => {
  const api = readFileSync('api/ai/generate.ts', 'utf8')
  const vite = readFileSync('src/server/ai/viteAiBffPlugin.ts', 'utf8')
  const vercel = readFileSync('vercel.json', 'utf8')
  const contract = readFileSync('docs/engineering/AI_BFF_RUNTIME_CONTRACT_2026-10-24.md', 'utf8')
  assert.match(api, /vercel-preview/)
  assert.match(vite, /vite-dev/)
  assert.match(vite, /production\/Preview BFF/)
  assert.match(vercel, /api\/\(\.\*\)/)
  assert.match(contract, /Vite 개발/)
  assert.match(contract, /Vercel Preview/)
})
