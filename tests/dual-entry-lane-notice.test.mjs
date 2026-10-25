import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const notice = readFileSync(
  new URL('../src/components/common/DualEntryLaneNotice.tsx', import.meta.url),
  'utf8',
)
const plans = readFileSync(new URL('../src/pages/PmPlanListPage.tsx', import.meta.url), 'utf8')
const review = readFileSync(new URL('../src/pages/ProjectAiReviewPage.tsx', import.meta.url), 'utf8')

test('dual-entry notice asserts parallel lanes and unpaid AI review', () => {
  assert.match(notice, /data-testid="dual-entry-lane-notice"/)
  assert.match(notice, /한쪽이 다른 쪽을 대체하지 않습니다/)
  assert.match(notice, /유료 LLM·계약·결제가 없습니다/)
  assert.match(notice, /lane === 'human-pm'/)
  assert.match(notice, /\/plans/)
  assert.match(notice, /\/ai-review/)
})

test('plans and ai-review pages surface the dual-entry lane notice', () => {
  assert.match(plans, /DualEntryLaneNotice/)
  assert.match(plans, /lane="human-pm"/)
  assert.match(review, /DualEntryLaneNotice/)
  assert.match(review, /lane="ai-review"/)
})
