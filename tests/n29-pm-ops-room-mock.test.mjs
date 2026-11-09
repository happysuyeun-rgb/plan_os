import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/PmOpsRoomMockPage.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const hub = readFileSync(new URL('../src/pages/AiStaffHubPage.tsx', import.meta.url), 'utf8')

test('N29 pm-ops route is protected lazy page', () => {
  assert.match(app, /PmOpsRoomMockPage/)
  assert.match(app, /path="\/ai-staff\/pm-ops"/)
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*?ai-staff\/pm-ops/)
})

test('ops room is Mock-only: no auto-run, paid, or hire claims', () => {
  assert.match(page, /data-testid="n29-pm-ops-room"/)
  assert.match(page, /data-testid="n29-pm-ops-disclaimer"/)
  assert.match(page, /자동 운영 중/)
  assert.match(page, /scheduler/)
  assert.match(page, /유료/)
  assert.match(page, /미배정 \(Mock\)/)
  assert.doesNotMatch(page, /자동 운영 중입니다|scheduler 실행 중|₩\s*0|결제하기/)
})

test('side panel CTAs are disabled placeholders', () => {
  assert.match(page, /data-testid="n29-pm-ops-assign-disabled"/)
  assert.match(page, /data-testid="n29-pm-ops-budget-disabled"/)
  assert.match(page, /data-testid="n29-pm-ops-dismiss-disabled"/)
  assert.match(page, /disabled/)
  assert.match(page, /미구현 · 유료·worker 없음/)
})

test('center links reuse existing plans/tasks/ai-review routes', () => {
  assert.match(page, /data-testid="n29-pm-ops-link-plans"/)
  assert.match(page, /data-testid="n29-pm-ops-link-tasks"/)
  assert.match(page, /data-testid="n29-pm-ops-link-ai-review"/)
  assert.match(page, /\/plans/)
  assert.match(page, /\/tasks/)
  assert.match(page, /\/ai-review/)
})

test('hub exposes N29 entry without claiming live PM hire', () => {
  assert.match(hub, /data-testid="ai-staff-hub-n29-link"/)
  assert.match(hub, /\/ai-staff\/pm-ops/)
  assert.match(hub, /배정·scheduler·유료 없음/)
})
