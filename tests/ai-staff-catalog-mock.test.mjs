import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/AiStaffCatalogMockPage.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('catalog route is protected and lists one mock specialist card', () => {
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*?specialists"/)
  assert.match(app, /AiStaffCatalogMockPage/)
  assert.match(page, /data-testid="ai-staff-catalog-card"/)
  assert.match(page, /MOCK_SPECIALIST/)
  assert.match(page, /결제·채용 확정·실제 AI 실행은 없습니다/)
  assert.match(page, /산정 전 · 유료 결제 없음/)
  assert.match(page, /specialists\/request/)
})

test('catalog does not claim paid hire or invent zero price checkout', () => {
  assert.doesNotMatch(page, /결제하기|지금 채용|₩\s*0|가격\s*0/)
  assert.match(page, /카탈로그 안내만 · 채용 확정 아님/)
})
