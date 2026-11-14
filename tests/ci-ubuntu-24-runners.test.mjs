import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const workflowsDir = join(dirname(fileURLToPath(import.meta.url)), '../.github/workflows')

test('GitHub Actions runners pin ubuntu-24.04 (Playwright Chromium support)', () => {
  const files = readdirSync(workflowsDir).filter((name) => name.endsWith('.yml'))
  assert.ok(files.length >= 10)
  for (const name of files) {
    const body = readFileSync(join(workflowsDir, name), 'utf8')
    assert.doesNotMatch(
      body,
      /runs-on:\s*ubuntu-latest/,
      `${name} must not use ubuntu-latest (maps to unsupported 26.04 for Playwright 1.58)`,
    )
    assert.match(body, /runs-on:\s*ubuntu-24\.04/, `${name} should pin ubuntu-24.04`)
  }
})
