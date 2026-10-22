// Task version conflicts must fail fast over PostgREST.
// Migration 011 raised TASK_VERSION_CONFLICT with SQLSTATE 40001, which
// PostgREST retries: a PATCH reaching the trigger without the client's
// version filter hung ~60s until the gateway timed out (reproduced on the
// disposable local stack before migration 020). Since 020 the trigger
// raises the dedicated P4001 code and PostgREST returns it immediately.
import assert from 'node:assert/strict'
import {
  people, projectOne, anonKey, API_URL,
} from './test_local_supabase_auth.mjs'

async function rest(role, method, path, body, params = '') {
  const started = performance.now()
  const response = await fetch(API_URL + '/rest/v1/' + path + params, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + people[role].access_token,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  const raw = await response.text()
  let data = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  return { status: response.status, ok: response.ok, data, ms: Math.round(performance.now() - started) }
}

// Fixture: one task owned by the editor (trigger requires version=1, todo).
const created = await rest('editor', 'POST', 'project_tasks', {
  project_id: projectOne,
  created_by: people.editor.id,
  title: 'conflict fixture task',
  objective: 'fixture',
  acceptance_criteria: [],
})
assert(created.ok, 'task fixture insert failed: ' + JSON.stringify(created.data))
const task = created.data[0]
assert.equal(task.version, 1)

// The app CAS path (version filter) succeeds.
const goodPatch = await rest('editor', 'PATCH', 'project_tasks', { title: 'conflict fixture task v2', version: 2 },
  '?id=eq.' + task.id + '&version=eq.1')
assert(goodPatch.ok && goodPatch.data[0]?.version === 2, 'app-style CAS PATCH failed: ' + JSON.stringify(goodPatch.data))
console.log('PASS app-style task CAS PATCH succeeds')

// A stale app-style PATCH is filtered out by the WHERE clause: empty
// result, no error, and the client maps that to TaskConflictError.
const staleFiltered = await rest('editor', 'PATCH', 'project_tasks', { title: 'stale', version: 2 },
  '?id=eq.' + task.id + '&version=eq.1')
assert(staleFiltered.ok && Array.isArray(staleFiltered.data) && staleFiltered.data.length === 0,
  'stale filtered PATCH must return no rows, got ' + JSON.stringify(staleFiltered.data))
console.log('PASS stale task PATCH returns empty result immediately')

// Regression guard: a PATCH that bypasses the version filter reaches the
// trigger. It must be rejected with P4001 immediately — never the ~60s
// 40001 retry spiral — and must not modify the task.
const bad = await rest('editor', 'PATCH', 'project_tasks', { title: 'bad version write', version: 7 },
  '?id=eq.' + task.id)
assert(!bad.ok, 'trigger-reaching bad PATCH unexpectedly succeeded')
assert.equal(bad.data?.code, 'P4001', 'bad version write must fail with P4001, got ' + JSON.stringify(bad.data))
assert(bad.ms < 10000, 'bad version write took ' + bad.ms + 'ms; the 40001 retry spiral may be back')
const after = await rest('editor', 'GET', 'project_tasks', null, '?id=eq.' + task.id + '&select=id,title,version')
assert.deepEqual(
  after.data.map(({ title, version }) => [title, version]),
  [['conflict fixture task v2', 2]],
  'rejected write must leave the task untouched: ' + JSON.stringify(after.data),
)
console.log('PASS trigger version conflict rejected fast with P4001 (' + bad.ms + 'ms), task unchanged')

console.log('SUCCESS task version conflict fails fast over genuine Supabase Auth/JWT/PostgREST')
