import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const terms = readFileSync(new URL('../src/lib/agentContractTerms.ts', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/lib/api/agentContracts.ts', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../supabase/migrations/029_agent_contracts_mvp.sql', import.meta.url),
  'utf8',
)

test('F-A terms version and consent are explicit Mock-only statements', () => {
  assert.match(terms, /requirements_auditor_v1_terms_2026-10-27/)
  assert.match(terms, /Mock 실행만 승인하며 유료 LLM을 호출하지 않습니다/)
  assert.match(terms, /MOCK_BUDGET_CAP_MINOR = 0/)
})

test('client API routes mutations through SECURITY DEFINER RPCs only', () => {
  assert.match(api, /create_agent_contract_draft/)
  assert.match(api, /accept_agent_contract/)
  assert.match(api, /revoke_agent_contract/)
  assert.match(api, /from\('agent_contracts'\)/)
  assert.doesNotMatch(api, /\.insert\(/)
})

test('migration freezes Mock terms and blocks paid LLM in scope', () => {
  assert.match(migration, /paidLlmAllowed', false/)
  assert.match(migration, /mockOnly', true/)
  assert.match(migration, /agent_contract_events/)
  assert.match(migration, /ONLY_OWNER_MAY_ACCEPT/)
  assert.match(migration, /STALE_SOURCE/)
})
