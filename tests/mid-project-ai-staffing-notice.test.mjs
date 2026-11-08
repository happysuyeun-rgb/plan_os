import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const notice = readFileSync(
  new URL('../src/components/common/MidProjectAiStaffingNotice.tsx', import.meta.url),
  'utf8',
)
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8')
const createPage = readFileSync(new URL('../src/pages/ProjectCreatePage.tsx', import.meta.url), 'utf8')
const documentPage = readFileSync(new URL('../src/pages/DocumentPage.tsx', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../src/components/layout/GlobalNavBar.tsx', import.meta.url), 'utf8')

test('notice points to single AI staffing entry and unpaid mock (E-03)', () => {
  assert.match(notice, /진행 중에도 AI 직원을 투입할 수 있습니다/)
  assert.match(notice, /실제 계약·과금·유료 LLM은 없습니다/)
  assert.match(notice, /data-testid="mid-project-ai-staffing-notice"/)
  assert.match(notice, /\/ai-staff/)
  assert.match(notice, /specialists/)
  assert.match(notice, /audits\/new/)
  assert.match(notice, /E-06 Mock/)
})

test('dashboard, project create, and document page surface mid-project AI staffing notice', () => {
  assert.match(dashboard, /MidProjectAiStaffingNotice/)
  assert.match(createPage, /MidProjectAiStaffingNotice/)
  assert.match(documentPage, /MidProjectAiStaffingNotice/)
})

test('global nav exposes AI staff entry', () => {
  assert.match(nav, /\/ai-staff/)
  assert.match(nav, /AI 직원/)
})
