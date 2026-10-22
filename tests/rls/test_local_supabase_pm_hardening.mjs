// Negative-permission and integrity suite for the PM plan hardening
// (migration 023, Issue #32 review fixes). Every forged or stale write
// must be rejected server-side while the legitimate review loop keeps
// working. Disposable local Supabase only.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  people, projectOne, projectTwo, anonKey, API_URL,
} from './test_local_supabase_auth.mjs'

async function rest(role, method, path, body, params = '') {
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
  return { status: response.status, ok: response.ok, data }
}

async function rpc(role, fn, params) {
  const response = await fetch(API_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + people[role].access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15000),
  })
  const raw = await response.text()
  let data = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  return { status: response.status, ok: response.ok, data }
}

const step = (title, criteria, dep = null) => ({
  title, acceptance_criteria: criteria, depends_on_position: dep, position: 0,
})

// 1) Atomic creation: an invalid step aborts the whole create.
const badCreate = await rpc('editor', 'create_pm_plan', {
  p_project_id: projectOne,
  p_objective: 'Hardening fixture objective text',
  p_steps: [step('Fine step', 'criteria fine'), step('Bad step', 'x')],
  p_client_request_id: randomUUID(),
})
assert(!badCreate.ok, 'invalid step must abort creation: ' + JSON.stringify(badCreate.data))
const residue = await rest('editor', 'GET', 'pm_plans', null,
  '?project_id=eq.' + projectOne + '&objective=eq.Hardening%20fixture%20objective%20text')
assert.equal(residue.data.length, 0, 'aborted create must leave no partial plan')
console.log('PASS invalid step aborts the whole plan creation (atomic)')

// 2) Idempotent creation: same request id twice, one plan, wired steps.
const requestId = randomUUID()
const createArgs = {
  p_project_id: projectOne,
  p_objective: 'Hardening plan main objective',
  p_steps: [step('Alpha step', 'alpha criteria'), step('Beta step', 'beta criteria', 1)],
  p_client_request_id: requestId,
}
const created1 = await rpc('editor', 'create_pm_plan', createArgs)
assert(created1.ok, 'create failed: ' + JSON.stringify(created1.data))
const created2 = await rpc('editor', 'create_pm_plan', createArgs)
assert(created2.ok && created2.data.id === created1.data.id, 'retry must return the same plan')
const plan = created1.data
const planSteps = await rest('editor', 'GET', 'pm_plan_steps', null, '?plan_id=eq.' + plan.id + '&order=position')
assert.equal(planSteps.data.length, 2)
assert(planSteps.data[1].depends_on_step_id === planSteps.data[0].id, 'dependency must be wired')
const alphaStep = planSteps.data[0]
const betaStep = planSteps.data[1]
console.log('PASS create_pm_plan is atomic and idempotent per request id')

// 3) Cross-plan and cyclic dependencies are rejected.
const foreign = await rest('editor', 'PATCH', 'pm_plan_steps',
  { depends_on_step_id: alphaStep.id }, '?id=eq.' + alphaStep.id)
assert(foreign.ok === false || foreign.data?.[0]?.depends_on_step_id !== alphaStep.id,
  'self dependency must not stick')
const selfDep = await rest('editor', 'PATCH', 'pm_plan_steps',
  { depends_on_step_id: alphaStep.id }, '?id=eq.' + alphaStep.id)
assert(!selfDep.ok, 'self dependency must be rejected: ' + JSON.stringify(selfDep.data))
const cycle = await rest('editor', 'PATCH', 'pm_plan_steps',
  { depends_on_step_id: betaStep.id }, '?id=eq.' + alphaStep.id)
assert(!cycle.ok, 'cyclic dependency must be rejected: ' + JSON.stringify(cycle.data))
const otherCreate = await rpc('editor', 'create_pm_plan', {
  p_project_id: projectOne,
  p_objective: 'Second hardening plan objective',
  p_steps: [step('Foreign step', 'foreign criteria')],
  p_client_request_id: randomUUID(),
})
assert(otherCreate.ok)
const foreignLink = await rest('editor', 'PATCH', 'pm_plan_steps',
  { depends_on_step_id: betaStep.id }, '?plan_id=eq.' + otherCreate.data.id)
assert(!foreignLink.ok, 'cross-plan dependency must be rejected: ' + JSON.stringify(foreignLink.data))
console.log('PASS self/cyclic/cross-plan step dependencies are rejected')

// 4) Direct step edits bump the plan version and append audit events.
const before = await rest('editor', 'GET', 'pm_plans', null, '?id=eq.' + plan.id)
const directEdit = await rest('editor', 'PATCH', 'pm_plan_steps',
  { title: 'Alpha step direct edit' }, '?id=eq.' + alphaStep.id)
assert(directEdit.ok, 'direct step edit should be allowed in draft: ' + JSON.stringify(directEdit.data))
const after = await rest('editor', 'GET', 'pm_plans', null, '?id=eq.' + plan.id)
assert.equal(after.data[0].version, before.data[0].version + 1, 'direct step edit must bump the plan version')
const eventsAfterEdit = await rest('editor', 'GET', 'pm_plan_approval_events', null, '?plan_id=eq.' + plan.id)
assert(eventsAfterEdit.data.filter((e) => e.event_type === 'draft_saved').length >= 2,
  'direct step edit must append an audit event')
console.log('PASS direct step edits advance plan version and append audit events')

// 5) A plan under review is locked against direct content rewrites.
const currentVersion = after.data[0].version
const requested = await rpc('editor', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: currentVersion, p_action: 'request_approval', p_comment: null,
})
assert(requested.ok, 'approval request failed: ' + JSON.stringify(requested.data))
const forgedPatch = await rest('editor', 'PATCH', 'pm_plans',
  { objective: 'SNEAKY REWRITE while pending approval', version: requested.data.version + 1 },
  '?id=eq.' + plan.id)
assert(!forgedPatch.ok, 'pending plan rewrite must be rejected: ' + JSON.stringify(forgedPatch.data))
const pendingNow = await rest('editor', 'GET', 'pm_plans', null, '?id=eq.' + plan.id)
assert.equal(pendingNow.data[0].objective, 'Hardening plan main objective', 'objective must survive the forged PATCH')
console.log('PASS pending plan content is locked against direct PATCH rewrites')

// 6) Task source forgery: unapproved plans and foreign projects rejected.
const forgeTask = await rest('editor', 'POST', 'project_tasks', {
  project_id: projectOne,
  created_by: people.editor.id,
  title: 'forged source task',
  objective: 'forgery attempt',
  acceptance_criteria: [],
  source_plan_id: plan.id,
  source_plan_step_id: alphaStep.id,
})
assert(!forgeTask.ok, 'direct task insert with a plan source must be rejected: ' + JSON.stringify(forgeTask.data))
// Linking from the RPC also refuses while the plan is not approved.
const earlyLink = await rpc('editor', 'link_pm_plan_step_to_task', { p_step_id: alphaStep.id })
assert(!earlyLink.ok && earlyLink.data?.code === 'P4001', 'unapproved link must be rejected: ' + JSON.stringify(earlyLink.data))
console.log('PASS task source forgery rejected for direct writes and unapproved links')

// 7) Re-review after a rejection uses the same transition map everywhere.
const rejected = await rpc('owner', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: pendingNow.data[0].version, p_action: 'reject', p_comment: 'not yet',
})
assert(rejected.ok && rejected.data.status === 'rejected')
const directReRequest = await rpc('editor', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: rejected.data.version, p_action: 'request_approval', p_comment: 'please reconsider',
})
assert(directReRequest.ok && directReRequest.data.status === 'pending_owner_approval',
  'rejected plan must re-request approval directly: ' + JSON.stringify(directReRequest.data))
const approved = await rpc('owner', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: directReRequest.data.version, p_action: 'approve', p_comment: 'ok',
})
assert(approved.ok && approved.data.status === 'approved')
console.log('PASS rejected plan re-requests approval without a forced detour')

// 8) Concurrent links return the same task id.
const links = await Promise.all([
  rpc('editor', 'link_pm_plan_step_to_task', { p_step_id: alphaStep.id }),
  rpc('owner', 'link_pm_plan_step_to_task', { p_step_id: alphaStep.id }),
])
assert(links.every((r) => r.ok), 'concurrent links must both succeed: ' + JSON.stringify(links))
assert.equal(links[0].data.id, links[1].data.id, 'concurrent links must return the same task')
const linkedRows = await rest('owner', 'GET', 'project_tasks', null,
  '?source_plan_step_id=eq.' + alphaStep.id)
assert.equal(linkedRows.data.length, 1)
console.log('PASS concurrent step links converge on the same task id')

// 9) Source columns cannot be rewritten afterwards, and viewer/outsider
//    reads stay isolated to their own project.
const tamper = await rest('editor', 'PATCH', 'project_tasks',
  { source_plan_id: otherCreate.data.id }, '?id=eq.' + links[0].data.id)
assert(!tamper.ok, 'rewriting a task source must be rejected: ' + JSON.stringify(tamper.data))
const otherProjectPlans = await rest('otherEditor', 'GET', 'pm_plans', null, '?project_id=eq.' + projectOne)
assert.equal(otherProjectPlans.data.length, 0, 'other project editor must not read these plans')
const outsiderAll = await rest('outsider', 'GET', 'pm_plans', null, '?project_id=eq.' + projectOne)
assert.equal(outsiderAll.data.length, 0)
const twoSide = await rest('otherEditor', 'GET', 'pm_plans', null, '?project_id=eq.' + projectTwo)
assert(twoSide.ok, 'other editor keeps access to its own project')
console.log('PASS task sources are immutable and plan reads stay project-isolated')

console.log('SUCCESS PM plan hardening negatives over genuine Supabase Auth/JWT/PostgREST')
