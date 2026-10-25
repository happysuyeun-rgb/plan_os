import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('budget module defaults block paid spend', () => {
  const budget = readFileSync('src/server/ai/budget.ts', 'utf8')
  assert.match(budget, /DEFAULT_TOKEN_CAP = 0/)
  assert.match(budget, /DEFAULT_COST_CAP = 0/)
  assert.match(budget, /paid_calls_disabled/)
})

test('BFF refuses unpaid paid-provider path and keeps secrets server-side', () => {
  const secrets = readFileSync('src/server/ai/secrets.ts', 'utf8')
  const bff = readFileSync('src/server/ai/generationBff.ts', 'utf8')
  const http = readFileSync('src/server/ai/generationHttp.ts', 'utf8')
  assert.match(secrets, /must not be read in the browser/)
  assert.match(secrets, /PLANOS_LLM_API_KEY/)
  assert.match(bff, /mode: 'placeholder'/)
  assert.match(bff, /Paid generation provider is not registered/)
  assert.match(http, /allowPaidCalls:\s*false/)
  assert.doesNotMatch(bff, /sk-[a-zA-Z0-9]{10,}/)
})

test('Gate C-LLM runbook exists and keeps paid off until approval', () => {
  const runbook = readFileSync('docs/plans/PAID_LLM_ENABLE_RUNBOOK_2026-10-25.md', 'utf8')
  assert.match(runbook, /Gate C-LLM/)
  assert.match(runbook, /allowPaidCalls:\s*false|항상.*allowPaidCalls/)
  assert.match(runbook, /PLANOS_LLM_API_KEY/)
  assert.match(runbook, /금지/)
  assert.match(runbook, /027과 \*\*독립\*\*|독립/)
})
