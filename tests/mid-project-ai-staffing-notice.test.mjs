import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const notice = readFileSync(
  new URL('../src/components/common/MidProjectAiStaffingNotice.tsx', import.meta.url),
  'utf8',
)
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8')
const createPage = readFileSync(new URL('../src/pages/ProjectCreatePage.tsx', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../src/components/layout/GlobalNavBar.tsx', import.meta.url), 'utf8')

test('notice points to single AI staffing entry and unpaid mock', () => {
  assert.match(notice, /상단 메뉴 「AI 직원」에서 채용합니다/)
  assert.match(notice, /실제 계약·과금·유료 LLM은 없습니다/)
  assert.match(notice, /data-testid="mid-project-ai-staffing-notice"/)
  assert.match(notice, /\/ai-staff/)
  assert.match(notice, /specialists/)
})

test('dashboard and project create surface the mid-project AI staffing notice', () => {
  assert.match(dashboard, /MidProjectAiStaffingNotice/)
  assert.match(createPage, /MidProjectAiStaffingNotice/)
})

test('global nav exposes AI staff entry', () => {
  assert.match(nav, /\/ai-staff/)
  assert.match(nav, /AI 직원/)
})
