import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const api = readFileSync(path.join(root, 'src/lib/api/projects.ts'), 'utf8')
const store = readFileSync(path.join(root, 'src/store/projectStore.ts'), 'utf8')
const page = readFileSync(path.join(root, 'src/pages/TrashPage.tsx'), 'utf8')

test('purgeProject verifies trashed delete and supports purge-all', () => {
  assert.match(api, /export async function purgeProject/)
  assert.match(api, /\.not\('deleted_at', 'is', null\)/)
  assert.match(api, /\.select\('id'\)/)
  assert.match(api, /export async function purgeAllTrashedProjects/)
})

test('store purge skips post-delete activity log that caused FK failure', () => {
  const purgeBlock = store.match(/purgeProject: async \(id\) => \{[\s\S]*?\},[\r\n]+[\r\n]+ {2}purgeAllTrashedProjects/)
  assert.ok(purgeBlock, 'purgeProject block missing')
  assert.doesNotMatch(purgeBlock[0], /logProjectActivity/)
  assert.match(store, /purgeAllTrashedProjects: async/)
})

test('TrashPage has purge-all CTA and busy confirm', () => {
  assert.match(page, /data-testid="trash-purge-all"/)
  assert.match(page, /모두 삭제/)
  assert.match(page, /purgeAllTrashedProjects/)
  assert.match(page, /confirming=\{busy\}/)
})
