import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const code = readFileSync(new URL('../src/lib/api/documents.ts', import.meta.url), 'utf8')

test('conditional save must match both document identity and last confirmed content', () => {
  const impl = code.slice(code.indexOf('export async function saveDocumentContentIfUnchanged('),code.indexOf('export async function upsertDocument('))
  assert.match(impl, /\.eq\('id', id\)/)
  assert.match(impl, /\.eq\('content', expectedServerContent\)/)
  assert.match(impl, /\.update\(\{ content: nextContent \}\)/)
  assert.match(impl, /\.select\(\)/)
  assert.match(impl, /data\.length !== 1/)
  assert.match(impl, /throw new DocumentWriteConflictError\(\)/)
})

test('legacy blind save remains documented as a dangerous unguarded path', () => {
  const impl = code.slice(code.indexOf('export async function saveDocumentContent('),code.indexOf('export class DocumentWriteConflictError'))
  assert.doesNotMatch(impl, /expectedServerContent/)
})
