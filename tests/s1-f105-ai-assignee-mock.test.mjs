import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const libSource = readFileSync(new URL('../src/lib/taskAiAssigneeMock.ts', import.meta.url), 'utf8')
const libJs = ts.transpileModule(libSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
  // Drop the MOCK_SPECIALIST import for unit isolation; inline constant already matches.
  .replace(
    /import\s*\{\s*MOCK_SPECIALIST\s*\}\s*from\s*['"]\.\/mockSpecialistRequest['"];?/,
    "const MOCK_SPECIALIST = { id: 'requirements_auditor_v1', title: '요구사항 검수 전문가' };",
  )

const {
  getTaskAiAssignee,
  writeTaskAiAssignee,
  readTaskAiAssigneeMap,
  formatTaskAssigneeDisplay,
  MOCK_AI_ASSIGNEE_ROLE,
} = await import('data:text/javascript;base64,' + Buffer.from(libJs).toString('base64'))

const detail = readFileSync(new URL('../src/pages/ProjectTaskDetailPage.tsx', import.meta.url), 'utf8')
const list = readFileSync(new URL('../src/pages/ProjectTasksPage.tsx', import.meta.url), 'utf8')

function memoryStorage() {
  const entries = new Map()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
}

test('AI assignee Mock defaults to human and persists agent kind locally', () => {
  globalThis.localStorage = memoryStorage()
  assert.equal(getTaskAiAssignee('p1', 't1').kind, 'human')
  const saved = writeTaskAiAssignee('p1', 't1', { kind: 'agent', agentRoleId: null })
  assert.equal(saved.kind, 'agent')
  assert.equal(saved.agentRoleId, MOCK_AI_ASSIGNEE_ROLE.id)
  assert.equal(getTaskAiAssignee('p1', 't1').kind, 'agent')
  assert.equal(readTaskAiAssigneeMap('p2').t1, undefined)
})

test('rejects unknown agent role ids when reading storage', () => {
  const store = memoryStorage()
  globalThis.localStorage = store
  store.setItem(
    'planos:s1-ai-assignee-mock:v1:p1',
    JSON.stringify({ t1: { kind: 'agent', agentRoleId: 'evil_role', updatedAt: 'x' } }),
  )
  assert.deepEqual(readTaskAiAssigneeMap('p1'), {})
})

test('display copy marks AI assignee as non-executing Mock', () => {
  assert.match(formatTaskAssigneeDisplay('agent', 'ignored'), /실행 아님/)
  assert.equal(formatTaskAssigneeDisplay('human', 'Alice'), 'Alice')
})

test('task detail exposes F-105 kind UI without hire/pay/run claims', () => {
  assert.match(detail, /data-testid="task-detail-assignee-kind"/)
  assert.match(detail, /data-testid="task-detail-ai-assignee-mock"/)
  assert.match(detail, /메타데이터만 저장/)
  assert.match(detail, /specialists/)
  assert.doesNotMatch(detail, /결제하기|지금 채용|유료 LLM 실행/)
  assert.match(list, /formatTaskAssigneeDisplay/)
  assert.match(list, /getTaskAiAssignee/)
})
