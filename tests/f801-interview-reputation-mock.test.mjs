import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(
  new URL('../src/pages/StaffInterviewReputationMockPage.tsx', import.meta.url),
  'utf8',
)
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const hub = readFileSync(new URL('../src/pages/AiStaffHubPage.tsx', import.meta.url), 'utf8')

test('F-801 reputation route is protected lazy page', () => {
  assert.match(app, /StaffInterviewReputationMockPage/)
  assert.match(app, /path="\/ai-staff\/reputation"/)
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*?ai-staff\/reputation/)
})

test('page forbids fabricated scores and paid upgrade claims', () => {
  assert.match(page, /data-testid="f801-interview-reputation-mock"/)
  assert.match(page, /data-testid="f801-disclaimer"/)
  assert.match(page, /0점 위조/)
  assert.match(page, /가짜 성공률/)
  assert.match(page, /유료 승급/)
  assert.doesNotMatch(page, /성공률\s*\d|별점\s*[1-5]\.?0|₩\s*0|결제하기/)
})

test('interview and reputation CTAs stay disabled', () => {
  assert.match(page, /data-testid="f801-interview-start-disabled"/)
  assert.match(page, /data-testid="f801-rating-disabled"/)
  assert.match(page, /data-testid="f801-career-disabled"/)
  assert.match(page, /data-testid="f801-consent-disabled"/)
  assert.match(page, /disabled/)
})

test('recommend panel lists catalog seats without match scores', () => {
  assert.match(page, /data-testid="f801-recommend-panel"/)
  assert.match(page, /점수·매칭 알고리즘 추천이 아닙니다/)
  assert.match(page, /hireableAiStaff/)
  assert.match(page, /추천 점수 없음/)
})

test('hub links to F-801 mock', () => {
  assert.match(hub, /data-testid="ai-staff-hub-f801-link"/)
  assert.match(hub, /\/ai-staff\/reputation/)
  assert.match(hub, /별점\/경력 원장 없음/)
})
