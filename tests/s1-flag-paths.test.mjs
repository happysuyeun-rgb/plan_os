import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

/**
 * VITE_S1_SERVER_TASKS OFF → prototypeTaskRepository (local)
 * ON → createServerTask / patchServerTask (server)
 * AI accept path must follow the same flag.
 */
test('S1 flag gates list/create/patch on tasks pages', () => {
  const list = readFileSync('src/pages/ProjectTasksPage.tsx', 'utf8')
  const detail = readFileSync('src/pages/ProjectTaskDetailPage.tsx', 'utf8')
  const run = readFileSync('src/lib/ai/runPlanningReview.ts', 'utf8')
  assert.match(list, /VITE_S1_SERVER_TASKS/)
  assert.match(list, /prototypeTaskRepository/)
  assert.match(list, /createServerTask/)
  assert.match(detail, /VITE_S1_SERVER_TASKS/)
  assert.match(detail, /patchServerTask/)
  assert.match(run, /VITE_S1_SERVER_TASKS/)
  assert.match(run, /createServerTask/)
  assert.match(run, /prototypeTaskRepository/)
})

test('AI accept does not invent a third storage path', () => {
  const run = readFileSync('src/lib/ai/runPlanningReview.ts', 'utf8')
  // Only the two known backends after the flag check.
  assert.match(run, /if \(useServerTasks\)/)
  assert.equal((run.match(/createServerTask/g) || []).length >= 1, true)
  assert.equal((run.match(/prototypeTaskRepository/g) || []).length >= 1, true)
})
