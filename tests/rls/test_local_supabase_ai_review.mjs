/**
 * 027 AI review RLS/CAS/idempotency on disposable LOCAL Supabase only.
 * Applies supabase/local_only/027 via apply script; never touches hosted DBs.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { people, projectOne, anonKey, API_URL } from './test_local_supabase_auth.mjs'

assert(process.env.PLANOS_LOCAL_SUPABASE_DIR, 'PLANOS_LOCAL_SUPABASE_DIR required')

const apply = spawnSync(process.execPath, ['scripts/apply-027-local-only.mjs'], {
  env: {
    ...process.env,
    PGHOST: '127.0.0.1',
    PGPORT: process.env.PLANOS_LOCAL_DB_PORT ?? '54322',
  },
  encoding: 'utf8',
})
if (apply.status !== 0) {
  console.error(apply.stdout, apply.stderr)
  process.exit(apply.status ?? 1)
}
console.log('PASS 027 applied on local-only stack')

async function rest(role, method, path, body, params = '', prefer = 'return=representation') {
  const response = await fetch(API_URL + '/rest/v1/' + path + params, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + people[role].access_token,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  const raw = await response.text()
  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = raw
  }
  return { status: response.status, ok: response.ok, data }
}

async function rpc(role, fn, args) {
  const response = await fetch(API_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + people[role].access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15000),
  })
  const raw = await response.text()
  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = raw
  }
  return { status: response.status, ok: response.ok, data }
}

const jobId = randomUUID()
const findingId = randomUUID()

const inserted = await rest('editor', 'POST', 'ai_review_jobs', {
  id: jobId,
  project_id: projectOne,
  status: 'awaiting_human',
  row_version: 1,
  accepted_finding_task_ids: {},
})
assert(inserted.ok, 'editor insert job: ' + JSON.stringify(inserted.data))
console.log('PASS editor inserts ai_review_job')

const finding = await rest('editor', 'POST', 'ai_review_findings', {
  id: findingId,
  job_id: jobId,
  severity: 'warning',
  category: 'inconsistent',
  reviewer_state: 'source_validated',
  summary: 'gap',
  document_id: randomUUID(),
  document_type: 'prd',
  start_offset: 0,
  end_offset: 4,
  quote: 'test',
  rationale: 'r',
})
assert(finding.ok, 'finding insert: ' + JSON.stringify(finding.data))
console.log('PASS editor inserts finding')

const viewerRead = await rest('viewer', 'GET', 'ai_review_jobs', null, '?id=eq.' + jobId)
assert(viewerRead.ok && viewerRead.data?.length === 1, 'viewer must read jobs')
console.log('PASS viewer can read jobs')

const outsider = await rest('outsider', 'GET', 'ai_review_jobs', null, '?id=eq.' + jobId)
assert(outsider.ok && Array.isArray(outsider.data) && outsider.data.length === 0,
  'outsider must see zero rows')
console.log('PASS outsider blocked by RLS')

const viewerWrite = await rest('viewer', 'POST', 'ai_review_jobs', {
  id: randomUUID(),
  project_id: projectOne,
  status: 'queued',
  row_version: 1,
})
assert(!viewerWrite.ok, 'viewer must not insert jobs')
console.log('PASS viewer cannot insert jobs')

const casOk = await rpc('editor', 'cas_ai_review_job', {
  p_id: jobId,
  p_expected_version: 1,
  p_status: 'accepted',
})
assert(casOk.ok && casOk.data?.row_version === 2, 'CAS ok: ' + JSON.stringify(casOk.data))
console.log('PASS CAS advances row_version')

const casStale = await rpc('editor', 'cas_ai_review_job', {
  p_id: jobId,
  p_expected_version: 1,
  p_status: 'failed',
})
assert(!casStale.ok, 'stale CAS must fail')
console.log('PASS stale CAS rejected')

// Create a task then bind idempotently
const task = await rest('editor', 'POST', 'project_tasks', {
  project_id: projectOne,
  created_by: people.editor.id,
  title: 'from review',
  objective: 'o',
  acceptance_criteria: [],
})
assert(task.ok, 'task: ' + JSON.stringify(task.data))
const taskId = task.data[0].id

const bind1 = await rpc('editor', 'bind_ai_review_finding_task', {
  p_job_id: jobId,
  p_finding_id: findingId,
  p_task_id: taskId,
})
assert(bind1.ok && bind1.data?.task_id === taskId, JSON.stringify(bind1.data))

const otherTask = await rest('editor', 'POST', 'project_tasks', {
  project_id: projectOne,
  created_by: people.editor.id,
  title: 'dup attempt',
  objective: 'o',
  acceptance_criteria: [],
})
const bind2 = await rpc('editor', 'bind_ai_review_finding_task', {
  p_job_id: jobId,
  p_finding_id: findingId,
  p_task_id: otherTask.data[0].id,
})
assert(bind2.ok && bind2.data?.task_id === taskId, 'idempotent bind must keep first task')
console.log('PASS finding→task bind is idempotent')

console.log('SUCCESS local 027 AI review RLS/CAS/idempotency')
