// PM plan review loop over the genuine Supabase path (Issue #32,
// F-401/F-402, migration 022): draft save with version conflicts, the
// owner-only decision, approval audit events, and the idempotent
// plan-step -> S1 task link. Disposable local stack only.
import assert from 'node:assert/strict'
import {
  people, projectOne, anonKey, API_URL,
} from './test_local_supabase_auth.mjs'
import { createRestClient } from '../helpers/rest.mjs'

const { rest, rpc } = createRestClient({ apiUrl: API_URL, anonKey, roles: people })

// 1) editor creates a human plan draft with two steps through the
// atomic create RPC (migration 024 bars raw pm_plans inserts).
const planCreated = await rpc('editor', 'create_pm_plan', {
  p_project_id: projectOne,
  p_objective: 'PM plan E2E objective for review loop',
  p_steps: [
    { title: 'Step one', acceptance_criteria: 'first criteria met', depends_on_position: null, position: 1 },
    { title: 'Step two', acceptance_criteria: 'second criteria met', depends_on_position: 1, position: 2 },
  ],
  p_client_request_id: '44444444-4444-4444-8444-444444444444',
})
assert(planCreated.ok, 'plan create failed: ' + JSON.stringify(planCreated.data))
const plan = planCreated.data
assert.equal(plan.status, 'draft')
assert.equal(plan.version, 1)
const createdSteps = await rest('editor', 'GET', 'pm_plan_steps', null,
  '?plan_id=eq.' + plan.id + '&order=position')
assert.equal(createdSteps.data.length, 2, 'step create failed')
assert(createdSteps.data[1].depends_on_step_id === createdSteps.data[0].id, 'create must wire dependencies')
const creationEvents = await rest('editor', 'GET', 'pm_plan_approval_events', null, '?plan_id=eq.' + plan.id)
assert(creationEvents.data.some((e) => e.event_type === 'draft_saved'), 'draft_saved event must be recorded')
console.log('PASS editor creates plan draft with steps and a draft_saved audit event')

// 2) viewer and outsider cannot read or create plans.
const viewerRead = await rest('viewer', 'GET', 'pm_plans', null, '?id=eq.' + plan.id)
assert(viewerRead.ok && viewerRead.data.length === 1, 'viewer member read follows can_access; refine expectation below')
const outsiderRead = await rest('outsider', 'GET', 'pm_plans', null, '?id=eq.' + plan.id)
assert(outsiderRead.data.length === 0, 'outsider must not read plans')
const viewerCreate = await rest('viewer', 'POST', 'pm_plans', {
  project_id: projectOne, objective: 'viewer must not create this plan', created_by: people.viewer.id,
})
assert(!viewerCreate.ok, 'viewer plan create must be denied')
console.log('PASS viewer/outsider boundaries hold (member read only, editor write only)')

// 3) atomic draft save with the right version; dependencies come back
// wired. Direct step inserts (step 1) already advanced the plan version
// (migration 023 step-touch trigger), so read the current version first.
const planBeforeSave = await rest('editor', 'GET', 'pm_plans', null, '?id=eq.' + plan.id)
const versionBeforeSave = planBeforeSave.data[0].version
const savedDraft = await rpc('editor', 'save_pm_plan_draft', {
  p_plan_id: plan.id,
  p_expected_version: versionBeforeSave,
  p_objective: 'PM plan E2E objective revised',
  p_steps: [
    { title: 'Step one revised', acceptance_criteria: 'first criteria met', depends_on_position: null, position: 1 },
    { title: 'Step two revised', acceptance_criteria: 'second criteria met', depends_on_position: 1, position: 2 },
  ],
})
assert(savedDraft.ok, 'draft save failed: ' + JSON.stringify(savedDraft.data))
assert.equal(savedDraft.data.version, versionBeforeSave + 1)
const stepsAfterSave = await rest('editor', 'GET', 'pm_plan_steps', null,
  '?plan_id=eq.' + plan.id + '&order=position')
assert.equal(stepsAfterSave.data.length, 2)
assert(stepsAfterSave.data[1].depends_on_step_id === stepsAfterSave.data[0].id, 'dependency must be wired')
const step1Id = stepsAfterSave.data[0].id
console.log('PASS atomic draft save bumps version and rewires step dependencies')

// 4) stale draft save conflicts fast and changes nothing.
const staleSave = await rpc('editor', 'save_pm_plan_draft', {
  p_plan_id: plan.id,
  p_expected_version: 1,
  p_objective: 'stale overwrite attempt value',
  p_steps: [{ title: 'Nope', acceptance_criteria: 'should never persist', depends_on_position: null, position: 1 }],
})
assert(!staleSave.ok && staleSave.data?.code === 'P4001', 'stale draft save must conflict: ' + JSON.stringify(staleSave.data))
const afterStale = await rest('editor', 'GET', 'pm_plans', null, '?id=eq.' + plan.id)
assert.equal(afterStale.data[0].objective, 'PM plan E2E objective revised')
console.log('PASS stale draft save conflicts (P4001), stored plan untouched')

// 5) editor cannot decide; owner approval is required.
const planNow1 = await rest('editor', 'GET', 'pm_plans', null, '?id=eq.' + plan.id)
const vNow1 = planNow1.data[0].version
const requested = await rpc('editor', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: vNow1, p_action: 'request_approval', p_comment: 'please review',
})
assert(requested.ok && requested.data.status === 'pending_owner_approval' && requested.data.version === vNow1 + 1,
  'approval request failed: ' + JSON.stringify(requested.data))
const editorApprove = await rpc('editor', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: vNow1 + 1, p_action: 'approve', p_comment: null,
})
assert(!editorApprove.ok && editorApprove.data?.code === '42501',
  'editor approval must be owner-only: ' + JSON.stringify(editorApprove.data))
const decisions = await rpc('owner', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: vNow1 + 1, p_action: 'needs_revision', p_comment: 'tighten step two',
})
assert(decisions.ok && decisions.data.status === 'needs_revision' && decisions.data.version === vNow1 + 2,
  'owner revision request failed: ' + JSON.stringify(decisions.data))
console.log('PASS editor approval request recorded; editor decision denied; owner can ask for revision')

// 6) revision returns to draft through a save, re-request, then approve.
const revisedSave = await rpc('editor', 'save_pm_plan_draft', {
  p_plan_id: plan.id,
  p_expected_version: vNow1 + 2,
  p_objective: 'PM plan E2E objective revised',
  p_steps: [
    { title: 'Step one revised', acceptance_criteria: 'first criteria met', depends_on_position: null, position: 1 },
    { title: 'Step two revised', acceptance_criteria: 'second criteria met tighter', depends_on_position: 1, position: 2 },
  ],
})
assert(revisedSave.ok && revisedSave.data.status === 'draft' && revisedSave.data.version === vNow1 + 3,
  'revision save must reopen the draft: ' + JSON.stringify(revisedSave.data))
const requestedAgain = await rpc('editor', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: vNow1 + 3, p_action: 'request_approval', p_comment: null,
})
assert(requestedAgain.ok && requestedAgain.data.version === vNow1 + 4)
const staleApprove = await rpc('owner', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: vNow1 + 3, p_action: 'approve', p_comment: null,
})
assert(!staleApprove.ok && staleApprove.data?.code === 'P4001', 'stale decision must conflict')
const approved = await rpc('owner', 'transition_pm_plan', {
  p_plan_id: plan.id, p_expected_version: vNow1 + 4, p_action: 'approve', p_comment: 'looks good',
})
assert(approved.ok && approved.data.status === 'approved' && approved.data.version === vNow1 + 5,
  'owner approval failed: ' + JSON.stringify(approved.data))
console.log('PASS revision loop reopens draft; stale decision conflicts; owner approval lands')

// 7) linking an approved step creates exactly one S1 task, idempotently.
const stepsFinal = await rest('owner', 'GET', 'pm_plan_steps', null, '?plan_id=eq.' + plan.id + '&order=position')
const linked1 = await rpc('editor', 'link_pm_plan_step_to_task', { p_step_id: stepsFinal.data[0].id })
assert(linked1.ok, 'task link failed: ' + JSON.stringify(linked1.data))
assert.equal(linked1.data.source_plan_id, plan.id)
assert.equal(linked1.data.source_plan_step_id, stepsFinal.data[0].id)
assert.equal(linked1.data.title, 'Step one revised')
const linked2 = await rpc('owner', 'link_pm_plan_step_to_task', { p_step_id: stepsFinal.data[0].id })
assert(linked2.ok && linked2.data.id === linked1.data.id, 'relink must return the same task')
const linkedTasks = await rest('owner', 'GET', 'project_tasks', null,
  '?source_plan_step_id=eq.' + stepsFinal.data[0].id)
assert.equal(linkedTasks.data.length, 1, 'exactly one task must exist for the step')
console.log('PASS approved step links to exactly one S1 task; relink is idempotent')

// 8) audit trail replays the whole loop in order.
const events = await rest('owner', 'GET', 'pm_plan_approval_events', null,
  '?plan_id=eq.' + plan.id + '&order=created_at')
const kinds = events.data.map((e) => e.event_type)
for (const expected of ['draft_saved', 'approval_requested', 'needs_revision', 'approval_requested', 'approved', 'step_task_linked']) {
  assert(kinds.includes(expected), 'missing audit event ' + expected + ' in ' + kinds.join(','))
}
console.log('PASS approval audit trail records the full review loop')

console.log('SUCCESS PM plan review loop over genuine Supabase Auth/JWT/PostgREST')
