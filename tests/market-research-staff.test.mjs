import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

test('catalog includes market researcher as hireable live role', () => {
  const catalog = readFileSync(path.join(root, 'src/lib/aiStaffCatalog.ts'), 'utf8')
  const staff = readFileSync(path.join(root, 'src/lib/marketResearchStaff.ts'), 'utf8')
  assert.match(staff, /ai_market_researcher_v1/)
  assert.match(catalog, /MARKET_RESEARCHER/)
  assert.match(catalog, /market-research/)
  assert.match(catalog, /available:\s*true/)
})

test('App routes market-research request page', () => {
  const app = readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
  assert.match(app, /specialists\/market-research/)
  assert.match(app, /MarketResearchRequestPage/)
})

test('market research staff terms and validation helpers exist', () => {
  const staff = readFileSync(path.join(root, 'src/lib/marketResearchStaff.ts'), 'utf8')
  assert.match(staff, /ai_market_researcher_v1_terms_2026-11-14/)
  assert.match(staff, /validateMarketResearchInput/)
  assert.match(staff, /MARKET_RESEARCH_BUDGET_CAP_MINOR = 500/)
})

test('liner gateway exposes search agent and web search', () => {
  const gw = readFileSync(path.join(root, 'src/server/ai/linerGateway.ts'), 'utf8')
  assert.match(gw, /linerSearchAgent/)
  assert.match(gw, /linerWebSearch/)
  assert.match(gw, /agents\/search/)
  assert.match(gw, /tools\/search\/web/)
  assert.match(gw, /include_knowledge: false/)
})

test('local_only 035 adds market research contract RPC', () => {
  const sql = readFileSync(
    path.join(root, 'supabase/local_only/035_market_researcher_agent.sql'),
    'utf8',
  )
  assert.match(sql, /create_market_research_contract_draft/)
  assert.match(sql, /ai_market_researcher_v1/)
  assert.doesNotMatch(sql, /planos\.supabase\.co/)
})

test('crewai worker routes market researcher slug', () => {
  const worker = readFileSync(
    path.join(root, 'workers/crewai/src/planos_crewai/worker.py'),
    'utf8',
  )
  assert.match(worker, /MARKET_RESEARCHER/)
  assert.match(worker, /run_market_research/)
  assert.match(worker, /requirements_auditor/)
})
