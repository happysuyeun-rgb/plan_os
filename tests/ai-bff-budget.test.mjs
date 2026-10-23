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
  assert.match(secrets, /must not be read in the browser/)
  assert.match(secrets, /PLANOS_LLM_API_KEY/)
  assert.match(bff, /mode: 'placeholder'/)
  assert.match(bff, /Paid generation provider is not registered/)
  assert.doesNotMatch(bff, /sk-[a-zA-Z0-9]{10,}/)
})
