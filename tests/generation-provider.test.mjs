import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('GenerationProvider interface and PlaceholderProvider are wired as Phase C foundation', () => {
  const iface = readFileSync('src/lib/ai/GenerationProvider.ts', 'utf8')
  const placeholder = readFileSync('src/lib/ai/PlaceholderProvider.ts', 'utf8')
  const registry = readFileSync('src/lib/ai/providerRegistry.ts', 'utf8')
  assert.match(iface, /interface GenerationProvider/)
  assert.match(iface, /generateDocument\(/)
  assert.match(placeholder, /class PlaceholderProvider implements GenerationProvider/)
  assert.match(placeholder, /buildGeneratedContent/)
  assert.match(registry, /preferredId \?\? placeholder\.id/)
  assert.match(registry, /Unknown generation provider/)
  assert.doesNotMatch(registry, /api[_-]?key|sk-[a-zA-Z0-9]/i)
})

test('placeholder content template still interpolates title and target user', () => {
  const source = readFileSync('src/lib/generation/placeholderContent.ts', 'utf8')
  assert.match(source, /\{title\}/)
  assert.match(source, /\{targetUser\}/)
  assert.match(source, /export function buildGeneratedContent/)
})
