import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assertReviewTransition,
  transitionReviewJob,
  InMemoryReviewJobStore,
} from '../src/lib/ai/reviewJob.ts'

test('review job allows the human-approval happy path', () => {
  let job = {
    id: 'rj-1',
    projectId: 'p-1',
    status: 'queued',
    findings: [],
    createdAt: '2026-10-23T00:00:00.000Z',
    updatedAt: '2026-10-23T00:00:00.000Z',
  }
  job = transitionReviewJob(job, 'running')
  job = transitionReviewJob(job, 'awaiting_human', {
    findings: [{
      id: 'f-1',
      severity: 'warning',
      summary: '목표 사용자 불일치',
      citation: {
        documentId: 'd-1',
        documentType: 'prd',
        versionNumber: 2,
        quote: '목표 사용자: 기업',
        rationale: '인터뷰는 개인 사용자를 가리킴',
      },
    }],
  })
  job = transitionReviewJob(job, 'accepted')
  assert.equal(job.status, 'accepted')
  assert.equal(job.findings[0].citation.quote.includes('기업'), true)
})

test('illegal and terminal transitions throw', () => {
  assert.throws(() => assertReviewTransition('queued', 'accepted'), /Illegal review transition/)
  assert.throws(() => assertReviewTransition('accepted', 'running'), /already terminal/)
})

test('in-memory store keeps project-scoped jobs', () => {
  const store = new InMemoryReviewJobStore()
  store.put({
    id: 'a', projectId: 'p1', status: 'queued', findings: [],
    createdAt: 't', updatedAt: 't',
  })
  store.put({
    id: 'b', projectId: 'p2', status: 'queued', findings: [],
    createdAt: 't', updatedAt: 't',
  })
  assert.equal(store.listByProject('p1').length, 1)
  assert.equal(store.get('b')?.projectId, 'p2')
})
