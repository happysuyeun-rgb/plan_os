import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function transpile(relPath) {
  const text = readFileSync(new URL(relPath, import.meta.url), 'utf8')
  return ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
}

const mockJs = transpile('../src/lib/mockSpecialistRequest.ts')
const mockUrl = 'data:text/javascript;base64,' + Buffer.from(mockJs).toString('base64')
const handoffJs = transpile('../src/lib/specialistReviewHandoff.ts').replace(
  /from ["']\.\/mockSpecialistRequest["']/,
  `from "${mockUrl}"`,
)
const { createMockDraft, MOCK_SPECIALIST } = await import(mockUrl)
const {
  buildHandoffFromDraft,
  validateHandoff,
  writeSpecialistReviewHandoff,
  consumeSpecialistReviewHandoff,
  SPECIALIST_REVIEW_HANDOFF_KEY,
} = await import('data:text/javascript;base64,' + Buffer.from(handoffJs).toString('base64'))

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

const draft = createMockDraft({
  roleId: MOCK_SPECIALIST.id,
  projectId: 'fixture-owner',
  task: '기획 요구사항 문서의 누락 항목을 검토해 주세요.',
  acceptanceCriteria: '누락과 근거를 보고서로 정리',
})

test('buildHandoffFromDraft marks mockOnly and copies request fields', () => {
  const h = buildHandoffFromDraft(draft)
  assert.equal(h.mockOnly, true)
  assert.equal(h.projectId, 'fixture-owner')
  assert.equal(h.roleId, 'requirements_auditor_v1')
  assert.equal(h.task, draft.task)
  assert.equal(h.acceptanceCriteria, draft.acceptanceCriteria)
  assert.ok(h.createdAt)
})

test('validateHandoff rejects fabricated paid hire or wrong role', () => {
  assert.equal(validateHandoff(null), null)
  assert.equal(validateHandoff({ ...buildHandoffFromDraft(draft), mockOnly: false }), null)
  assert.equal(validateHandoff({ ...buildHandoffFromDraft(draft), roleId: 'other' }), null)
  assert.equal(validateHandoff({ ...buildHandoffFromDraft(draft), task: '짧음' }), null)
})

test('consumeSpecialistReviewHandoff is once-only and project-scoped', () => {
  const storage = memoryStorage()
  writeSpecialistReviewHandoff(buildHandoffFromDraft(draft), storage)
  assert.ok(storage.getItem(SPECIALIST_REVIEW_HANDOFF_KEY))
  assert.equal(consumeSpecialistReviewHandoff('other-project', storage), null)
  assert.equal(storage.getItem(SPECIALIST_REVIEW_HANDOFF_KEY), null)

  writeSpecialistReviewHandoff(buildHandoffFromDraft(draft), storage)
  const once = consumeSpecialistReviewHandoff('fixture-owner', storage)
  assert.equal(once?.projectId, 'fixture-owner')
  assert.equal(consumeSpecialistReviewHandoff('fixture-owner', storage), null)
})
