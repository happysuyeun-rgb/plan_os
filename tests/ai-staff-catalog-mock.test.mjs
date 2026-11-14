import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/AiStaffCatalogMockPage.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const hub = readFileSync(new URL('../src/pages/AiStaffHubPage.tsx', import.meta.url), 'utf8')
const catalogSrc = readFileSync(new URL('../src/lib/aiStaffCatalog.ts', import.meta.url), 'utf8')

test('catalog route is protected and lists hireable mock specialist card', () => {
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*?specialists"/)
  assert.match(app, /AiStaffCatalogMockPage/)
  assert.match(app, /ai-staff/)
  assert.match(app, /AiStaffHubPage/)
  assert.match(page, /data-testid="ai-staff-catalog-card"/)
  assert.match(page, /hireableAiStaff/)
  assert.match(page, /결제·유료 LLM/)
  assert.match(page, /산정 전 · 유료 결제 없음/)
  assert.match(page, /specialists\/\$\{role\.requestPath \|\| 'request'\}/)
})

test('catalog does not claim paid hire or invent zero price checkout', () => {
  assert.doesNotMatch(page, /결제하기|지금 채용|₩\s*0|가격\s*0/)
  assert.match(page, /카탈로그 안내만 · 채용 확정 아님/)
})

test('hub lists hireable and upcoming staff without requiring project first', () => {
  assert.match(hub, /AI_STAFF_ROSTER/)
  assert.match(hub, /채용 가능/)
  assert.match(hub, /준비 중/)
  assert.match(hub, /data-testid="ai-staff-hub-hire"/)
  assert.match(hub, /#38|#37/)
})

test('roster reserves #37 sales and #38 marketer as unavailable display seats', () => {
  assert.match(catalogSrc, /ai_marketer_growth_v1/)
  assert.match(catalogSrc, /ai_sales_sdr_v1/)
  assert.match(catalogSrc, /futureRef: '#38'/)
  assert.match(catalogSrc, /futureRef: '#37'/)
  assert.match(catalogSrc, /무단 대량 발송/)
  assert.match(catalogSrc, /실계정 게시/)
  assert.match(page, /ai-staff-upcoming-\$\{role\.id\}/)
  assert.match(page, /구현·채용·발송 아님/)
  assert.match(page, /#37 영업·#38 마케터/)
})

test('MOCK_SPECIALIST and market researcher are hireable; FUTURE roles stay unavailable', () => {
  const availableTrue = catalogSrc.match(/available:\s*true/g) ?? []
  assert.equal(availableTrue.length, 2)
  assert.match(catalogSrc, /id: MOCK_SPECIALIST\.id[\s\S]*?available: true/)
  assert.match(catalogSrc, /id: MARKET_RESEARCHER\.id[\s\S]*?available: true/)
  assert.match(
    catalogSrc,
    /id: 'ai_marketer_growth_v1'[\s\S]*?available: false[\s\S]*?futureRef: '#38'/,
  )
  assert.match(
    catalogSrc,
    /id: 'ai_sales_sdr_v1'[\s\S]*?available: false[\s\S]*?futureRef: '#37'/,
  )
})
