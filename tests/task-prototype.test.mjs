import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/taskPrototype.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { isTaskStatus, permittedTransition, readPrototypeTasks, writePrototypeTasks } =
  await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

function memoryStorage() {
  const entries = new Map()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
}
function exampleTask(projectId='project-1') {
  return {
    id: 'task-1', projectId, title: 'Review PRD', objective: 'Review',
    assigneeName: null, assigneeId: null, deletedAt: null,
    status: 'todo', blockedReason: null,
    createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z',
  }
}

test('only supported task states are accepted', () => {
  assert.equal(isTaskStatus('todo'), true)
  assert.equal(isTaskStatus('blocked'), true)
  assert.equal(isTaskStatus('approved'), false)
})
test('blocked requires resuming work, done is terminal', () => {
  assert.equal(permittedTransition('todo', 'blocked'), true)
  assert.equal(permittedTransition('blocked', 'done'), false)
  assert.equal(permittedTransition('blocked', 'in_progress'), true)
  assert.equal(permittedTransition('done', 'in_progress'), false)
})
test('local task records are isolated by user and project', () => {
  globalThis.localStorage = memoryStorage()
  assert.equal(writePrototypeTasks('user-a', 'project-1', [exampleTask()]), true)
  assert.equal(readPrototypeTasks('user-a', 'project-1').length, 1)
  assert.equal(readPrototypeTasks('user-b', 'project-1').length, 0)
  assert.equal(readPrototypeTasks('user-a', 'project-2').length, 0)
})
test('stored legacy records have nullable assignee and deleted defaults', () => {
  const store = memoryStorage()
  globalThis.localStorage = store
  const task = exampleTask()
  delete task.assigneeId
  delete task.deletedAt
  store.setItem('planos:s1-prototype:v1:user-a:project-1', JSON.stringify([task]))
  assert.deepEqual(readPrototypeTasks('user-a', 'project-1')[0].assigneeId, null)
  assert.deepEqual(readPrototypeTasks('user-a', 'project-1')[0].deletedAt, null)
})
test('malformed storage and mismatched project records are discarded', () => {
  const store = memoryStorage()
  globalThis.localStorage = store
  store.setItem('planos:s1-prototype:v1:user-a:project-1', '{bad json')
  assert.deepEqual(readPrototypeTasks('user-a', 'project-1'), [])
  store.setItem('planos:s1-prototype:v1:user-a:project-1', JSON.stringify([exampleTask('project-2')]))
  assert.deepEqual(readPrototypeTasks('user-a', 'project-1'), [])
})
