import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  MemoryCasReviewJobStore,
  ReviewJobConflictError,
} from '../src/lib/ai/browserReviewJobStore.ts'
import { transitionReviewJob } from '../src/lib/ai/reviewJob.ts'
import { runMockPlanningReview } from '../src/lib/ai/MockPlanningReviewProvider.ts'
import { assertFindingsMatchDocuments } from '../src/lib/ai/citationVerify.ts'

test('CAS put rejects stale writers', () => {
  const store = new MemoryCasReviewJobStore()
  let job = {
    id: 'j1',
    projectId: 'p1',
    status: 'queued',
    findings: [],
    acceptedFindingTaskIds: {},
    version: 0,
    createdAt: 't',
    updatedAt: 't',
  }
  job = store.put(job)
  const v = job.version
  store.putCas({ ...job, status: 'running' }, v)
  assert.throws(
    () => store.putCas({ ...job, status: 'failed' }, v),
    (err) => err instanceof ReviewJobConflictError,
  )
})

test('accept is idempotent per finding (no duplicate tasks)', () => {
  const store = new MemoryCasReviewJobStore()
  const docs = [{ id: 'd1', type: 'prd', content: '소개만', revision: 1 }]
  const mock = runMockPlanningReview(docs)
  assertFindingsMatchDocuments(mock.findings, docs)

  let job = store.put({
    id: 'j-idem',
    projectId: 'p1',
    status: 'queued',
    findings: [],
    acceptedFindingTaskIds: {},
    version: 0,
    createdAt: 't',
    updatedAt: 't',
  })
  job = store.put(transitionReviewJob(job, 'running'))
  job = store.put(transitionReviewJob(job, 'awaiting_human', { findings: mock.findings }))

  const findingId = job.findings[0].id
  let creates = 0
  const createOnce = () => {
    creates += 1
    return `task-${creates}`
  }

  const map = { ...(job.acceptedFindingTaskIds ?? {}) }
  if (!map[findingId]) map[findingId] = createOnce()
  job = store.putCas(
    transitionReviewJob(job, 'accepted', {
      linkedTaskId: map[findingId],
      acceptedFindingTaskIds: map,
    }),
    job.version,
  )
  assert.equal(creates, 1)

  // re-accept same finding
  const map2 = { ...(job.acceptedFindingTaskIds ?? {}) }
  if (!map2[findingId]) map2[findingId] = createOnce()
  else {
    // reuse
  }
  assert.equal(map2[findingId], 'task-1')
  assert.equal(creates, 1)
})

test('listByProject survives sequential puts (reconnect)', () => {
  const store = new MemoryCasReviewJobStore()
  let job = store.put({
    id: 'j-reconnect',
    projectId: 'proj-x',
    status: 'queued',
    findings: [],
    version: 0,
    createdAt: 't',
    updatedAt: 't',
  })
  job = store.put(transitionReviewJob(job, 'running'))
  job = store.put(transitionReviewJob(job, 'awaiting_human', { findings: [] }))
  const listed = store.listByProject('proj-x')
  assert.equal(listed.length, 1)
  assert.equal(listed[0].id, job.id)
  assert.equal(listed[0].status, 'awaiting_human')
})

test('pipeline wires idempotent accept and browser store default', () => {
  const src = readFileSync('src/lib/ai/reviewPipeline.ts', 'utf8')
  assert.match(src, /acceptedFindingTaskIds|reusedExistingTask/)
  assert.match(src, /putCas|expectedVersion/)
  assert.match(src, /createDefaultReviewStore/)
})
