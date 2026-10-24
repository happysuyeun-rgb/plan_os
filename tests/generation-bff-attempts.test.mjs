import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  appendGenerationAttempt,
  clearGenerationAttemptsForTests,
  listGenerationAttempts,
} from '../src/server/ai/generationAttemptLog.ts'

test('attempt log keeps fail/retry/abort history', () => {
  clearGenerationAttemptsForTests()
  appendGenerationAttempt({
    attemptId: 'a1',
    providerId: 'placeholder',
    mode: 'placeholder',
    documentType: 'prd',
    status: 'failed',
    retryIndex: 0,
    errorMessage: 'boom',
    startedAt: '2026-10-24T00:00:00.000Z',
    finishedAt: '2026-10-24T00:00:01.000Z',
  })
  appendGenerationAttempt({
    attemptId: 'a1',
    providerId: 'placeholder',
    mode: 'placeholder',
    documentType: 'prd',
    status: 'ok',
    retryIndex: 1,
    startedAt: '2026-10-24T00:00:02.000Z',
    finishedAt: '2026-10-24T00:00:03.000Z',
  })
  const rows = listGenerationAttempts(10)
  assert.equal(rows.length, 2)
  assert.equal(rows[1].retryIndex, 1)
  assert.equal(rows[1].status, 'ok')
})

test('BFF and provider honor abort, attempt log, unpaid placeholder', () => {
  const bff = readFileSync('src/server/ai/generationBff.ts', 'utf8')
  const provider = readFileSync('src/lib/ai/PlaceholderProvider.ts', 'utf8')
  const iface = readFileSync('src/lib/ai/GenerationProvider.ts', 'utf8')
  assert.match(bff, /appendGenerationAttempt/)
  assert.match(bff, /mode:\s*'placeholder'/)
  assert.match(bff, /Paid generation provider is not registered/)
  assert.match(bff, /AbortError/)
  assert.match(provider, /AbortError/)
  assert.match(iface, /GenerationCallOptions/)
  assert.match(iface, /GenerationAttemptRecord/)
})
