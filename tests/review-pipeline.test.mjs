import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  InMemoryReviewJobStore,
  transitionReviewJob,
} from '../src/lib/ai/reviewJob.ts'

test('pipeline source wires citation → human → task → re-review', () => {
  const src = readFileSync('src/lib/ai/reviewPipeline.ts', 'utf8')
  assert.match(src, /submitFindingsForHumanReview/)
  assert.match(src, /awaiting_human/)
  assert.match(src, /acceptReviewAndOpenTask/)
  assert.match(src, /createTask/)
  assert.match(src, /requestReReview/)
  assert.match(src, /acceptedFindingTaskIds|reusedExistingTask/)
  assert.match(src, /createDefaultReviewStore|BROWSER|MOCK/i)
})

test('state machine supports the vertical-slice transitions', () => {
  const store = new InMemoryReviewJobStore()
  let job = {
    id: 'j1',
    projectId: 'p1',
    status: 'queued',
    findings: [],
    createdAt: 't',
    updatedAt: 't',
  }
  job = transitionReviewJob(job, 'running')
  job = transitionReviewJob(job, 'awaiting_human', {
    findings: [{
      id: 'f1',
      severity: 'warning',
      summary: 'x',
      citation: {
        documentId: 'd1',
        documentType: 'prd',
        quote: '목표 사용자: 기업',
        rationale: '인터뷰는 개인',
      },
    }],
  })
  job = transitionReviewJob(job, 'accepted', { linkedTaskId: 'task-1' })
  store.put(job)
  assert.equal(store.get('j1')?.linkedTaskId, 'task-1')
  assert.equal(job.findings[0].citation.quote.includes('기업'), true)
})

test('draft persistence SQL remains DRAFT and unapplied', () => {
  const sql = readFileSync('supabase/drafts/027_ai_review_jobs_DRAFT.sql', 'utf8')
  assert.match(sql, /DRAFT ONLY/)
  assert.match(sql, /ai_review_jobs/)
  assert.match(sql, /do not apply/i)
})
