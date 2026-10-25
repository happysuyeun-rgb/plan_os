import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { canAiReview, assertCanAiReview } from '../src/lib/ai/reviewAccess.ts'

test('AC-04: Owner/Editor can run and accept; Viewer view-only; null blocked', () => {
  assert.equal(canAiReview('owner', 'run'), true)
  assert.equal(canAiReview('editor', 'accept'), true)
  assert.equal(canAiReview('viewer', 'view'), true)
  assert.equal(canAiReview('viewer', 'run'), false)
  assert.equal(canAiReview('viewer', 'accept'), false)
  assert.equal(canAiReview('viewer', 'request_changes'), false)
  assert.equal(canAiReview(null, 'view'), false)
  assert.equal(canAiReview(null, 'run'), false)
  assert.throws(() => assertCanAiReview('viewer', 'accept'), /권한/)
  assert.throws(() => assertCanAiReview(null, 'run'), /권한/)
})

test('permissions.ts grants ai.review.* aligned with reviewAccess', () => {
  const src = readFileSync('src/lib/permissions.ts', 'utf8')
  assert.match(src, /'ai\.review\.view'/)
  assert.match(src, /'ai\.review\.run'/)
  assert.match(src, /'ai\.review\.accept'/)
  // viewer block includes view but not run/accept in the viewer array only once each for view
  const viewerBlock = src.slice(src.indexOf('viewer: ['), src.indexOf('],', src.indexOf('viewer: [')) + 2)
  assert.match(viewerBlock, /ai\.review\.view/)
  assert.doesNotMatch(viewerBlock, /ai\.review\.run/)
  assert.doesNotMatch(viewerBlock, /ai\.review\.accept/)
})

test('AI review page gates Viewer readonly and Owner/Editor actions', () => {
  const page = readFileSync('src/pages/ProjectAiReviewPage.tsx', 'utf8')
  assert.match(page, /canAiReview/)
  assert.match(page, /ai-review-viewer-readonly/)
  assert.match(page, /resolveMemberRole/)
  assert.match(page, /loadLatestProjectReviewJob/)
  assert.match(page, /ai-review-unpaid-preview/)
})
