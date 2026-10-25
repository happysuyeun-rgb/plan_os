import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const notice = readFileSync(
  new URL('../src/components/common/MidProjectAiStaffingNotice.tsx', import.meta.url),
  'utf8',
)
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8')
const createPage = readFileSync(new URL('../src/pages/ProjectCreatePage.tsx', import.meta.url), 'utf8')

test('notice asserts dual-entry and unpaid mock staffing', () => {
  assert.match(notice, /직접 기획·사람 PM 경로를 대체하지 않습니다/)
  assert.match(notice, /실제 계약·과금·유료 LLM 실행은 없습니다/)
  assert.match(notice, /data-testid="mid-project-ai-staffing-notice"/)
  assert.match(notice, /specialists\/request/)
  assert.match(notice, /ai-review/)
  assert.match(notice, /plans/)
})

test('dashboard and project create surface the mid-project AI staffing notice', () => {
  assert.match(dashboard, /MidProjectAiStaffingNotice/)
  assert.match(createPage, /MidProjectAiStaffingNotice/)
})
