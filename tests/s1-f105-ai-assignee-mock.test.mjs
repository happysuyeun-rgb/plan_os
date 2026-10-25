import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const libSource = readFileSync(new URL('../src/lib/taskAiAssigneeMock.ts', import.meta.url), 'utf8')
const libJs = ts.transpileModule(libSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(
  /import\s*\{\s*MOCK_SPECIALIST\s*\}\s*from\s*['"]\.\/mockSpecialistRequest['"];?/,
  "const MOCK_SPECIALIST = { id: 'requirements_auditor_v1', title: '요구사항 검수 전문가' };",
)

const {
  getTaskAiAssignee,
  writeTaskAiAssignee,
  readTaskAiAssigneeMap,
  formatTaskAssigneeDisplay,
  clearLegacyTaskAiAssigneeProjectKey,
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
    _entries: entries,
  }
}

test('AI assignee Mock defaults to human and persists agent kind locally', () => {
  globalThis.localStorage = memoryStorage()
  assert.equal(getTaskAiAssignee('u1', 'p1', 't1').kind, 'human')
  const saved = writeTaskAiAssignee('u1', 'p1', 't1', { kind: 'agent', agentRoleId: null })
  assert.equal(saved.kind, 'agent')
  assert.equal(saved.agentRoleId, MOCK_AI_ASSIGNEE_ROLE.id)
  assert.equal(getTaskAiAssignee('u1', 'p1', 't1').kind, 'agent')
})

test('F105-02: assignee Mock is isolated per user on the same project', () => {
  globalThis.localStorage = memoryStorage()
  writeTaskAiAssignee('owner', 'p1', 't1', { kind: 'agent', agentRoleId: null })
  assert.equal(getTaskAiAssignee('owner', 'p1', 't1').kind, 'agent')
  assert.equal(getTaskAiAssignee('editor', 'p1', 't1').kind, 'human')
  assert.deepEqual(readTaskAiAssigneeMap('editor', 'p1'), {})
})

test('F105-02: legacy project-only keys are cleared and not shared across users', () => {
  const store = memoryStorage()
  globalThis.localStorage = store
  store.setItem(
    'planos:s1-ai-assignee-mock:v1:p1',
    JSON.stringify({
      t1: { kind: 'agent', agentRoleId: MOCK_AI_ASSIGNEE_ROLE.id, updatedAt: 'x' },
    }),
  )
  assert.equal(getTaskAiAssignee('u1', 'p1', 't1').kind, 'human')
  writeTaskAiAssignee('u1', 'p1', 't1', { kind: 'human', agentRoleId: null })
  assert.equal(store.getItem('planos:s1-ai-assignee-mock:v1:p1'), null)
  clearLegacyTaskAiAssigneeProjectKey('p1')
  assert.equal(store.getItem('planos:s1-ai-assignee-mock:v1:p1'), null)
})

test('rejects unknown agent role ids when reading storage', () => {
  const store = memoryStorage()
  globalThis.localStorage = store
  store.setItem(
    'planos:s1-ai-assignee-mock:v2:u1:p1',
    JSON.stringify({ t1: { kind: 'agent', agentRoleId: 'evil_role', updatedAt: 'x' } }),
  )
  assert.deepEqual(readTaskAiAssigneeMap('u1', 'p1'), {})
})

test('display copy marks AI assignee as non-executing Mock', () => {
  assert.match(formatTaskAssigneeDisplay('agent', 'ignored'), /실행 아님/)
  assert.equal(formatTaskAssigneeDisplay('human', 'Alice'), 'Alice')
})

test('F105-01: detail writes Mock kind only after durable task persist', () => {
  const saveFn = detail.slice(detail.indexOf('async function saveAssignee'), detail.indexOf('const statusOptions'))
  const writeIdx = saveFn.indexOf('writeTaskAiAssignee')
  const patchIdx = saveFn.indexOf('patchServerTask')
  const replaceIdx = saveFn.indexOf('prototypeTaskRepository.replace')
  assert.ok(writeIdx > 0)
  assert.ok(patchIdx > 0 && writeIdx > patchIdx)
  assert.ok(replaceIdx > 0)
  // Both server and prototype branches must write after their durable call.
  const serverChunk = saveFn.slice(patchIdx, saveFn.indexOf('} else {'))
  assert.ok(serverChunk.indexOf('writeTaskAiAssignee') > serverChunk.indexOf('patchServerTask'))
  const protoChunk = saveFn.slice(saveFn.indexOf('} else {'))
  assert.ok(
    protoChunk.indexOf('writeTaskAiAssignee') >
      protoChunk.indexOf('prototypeTaskRepository.replace'),
  )
})

test('task detail exposes F-105 kind UI without hire/pay/run claims', () => {
  assert.match(detail, /data-testid="task-detail-assignee-kind"/)
  assert.match(detail, /data-testid="task-detail-ai-assignee-mock"/)
  assert.match(detail, /메타데이터만 저장/)
  assert.match(detail, /specialists/)
  assert.doesNotMatch(detail, /결제하기|지금 채용|유료 LLM 실행/)
  assert.match(list, /formatTaskAssigneeDisplay/)
  assert.match(list, /getTaskAiAssignee\(userId, projectId/)
})

test('human↔agent switch and refresh use user-scoped getters', () => {
  globalThis.localStorage = memoryStorage()
  writeTaskAiAssignee('u1', 'p1', 't1', { kind: 'agent', agentRoleId: null })
  assert.equal(getTaskAiAssignee('u1', 'p1', 't1').kind, 'agent')
  writeTaskAiAssignee('u1', 'p1', 't1', { kind: 'human', agentRoleId: null })
  assert.equal(getTaskAiAssignee('u1', 'p1', 't1').kind, 'human')
  assert.equal(getTaskAiAssignee('u1', 'p1', 't1').agentRoleId, null)
})
