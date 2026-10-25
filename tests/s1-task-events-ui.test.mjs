import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/ProjectTaskDetailPage.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/lib/api/projectTasks.ts', import.meta.url), 'utf8')

test('task detail loads read-only project_task_events via API', () => {
  assert.match(api, /listServerTaskEvents/)
  assert.match(api, /from\('project_task_events'\)/)
  assert.match(page, /listServerTaskEvents/)
  assert.match(page, /data-testid="task-detail-events"/)
  assert.match(page, /감사 이력/)
  assert.match(page, /주체:/)
})

test('task detail surfaces events load failure instead of silent empty', () => {
  assert.match(page, /data-testid="task-detail-events-error"/)
  assert.match(page, /업무 이력을 불러오지 못했습니다/)
})
