import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const patchSrc = readFileSync(path.join(root, 'src/lib/researchPrdPatch.ts'), 'utf8')
const modalSrc = readFileSync(
  path.join(root, 'src/components/ai/ResearchPrdApplyModal.tsx'),
  'utf8',
)
const resultsSrc = readFileSync(
  path.join(root, 'src/pages/ProjectResearchResultsPage.tsx'),
  'utf8',
)

test('researchPrdPatch unwraps nested report and maps ##/### headings', () => {
  assert.match(patchSrc, /function unwrapReport/)
  assert.match(patchSrc, /row\.report/)
  assert.match(patchSrc, /#\{2,3\}/)
  assert.match(patchSrc, /s\.level >= 1/)
})

test('ResearchPrdApplyModal portals, snapshots report, navigates after apply', () => {
  assert.match(modalSrc, /createPortal/)
  assert.match(modalSrc, /document\.body/)
  assert.match(modalSrc, /reportSnapshotRef/)
  assert.match(modalSrc, /navigate\(`\/projects\/\$\{projectId\}\/\$\{DOCUMENT_TYPE_PATHS\.prd\}`\)/)
  assert.match(modalSrc, /normalizeReportJson/)
  assert.match(modalSrc, /z-\[200\]/)
})

test('ResearchPrdApplyModal checkpoints previous PRD into version history before CAS', () => {
  assert.match(modalSrc, /createVersion/)
  assert.match(modalSrc, /PRE_APPLY_VERSION_NAME/)
  assert.match(modalSrc, /POST_APPLY_VERSION_NAME/)
  assert.match(modalSrc, /previousContent/)
  assert.match(modalSrc, /await createVersion\(prdId, previousContent/)
  assert.match(modalSrc, /await saveDocumentContentCas\(prdId, revision, plan\.nextContent\)/)
  assert.match(modalSrc, /fetchVersions\(prdId\)/)
})

test('research results page keeps pending apply across URL strip race', () => {
  assert.match(resultsSrc, /pendingApplyRef/)
  assert.match(resultsSrc, /currentProject\?\.user_id === userId/)
})
