// Final integrity negatives (migration 024):
// composite PATCH attacks, immutable steps/idempotency, concurrency.

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

const rpc = async (role, fn, params) => {
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

const step = (title) => ({ title, acceptance_criteria: title + ' criteria', depends_on_position: null, position: 0 })

function createPlanRaw(role, overrides = {}) {
  return rpc(role, 'create_pm_plan', {
    p_project_id: projectOne,
    p_objective: 'Final integrity plan',
    p_steps: [step('Anchor task')],
    p_client_request_id: randomUUID(),
    ...overrides,
  })
}

async function assertOriginalPlan(name, id, expectedVersion) {
  const rows = await rest('owner', 'GET', 'pm_plans', null, '?id=eq.' + id)
  assert.equal(rows.data.length, 1, name + ': 계획을 읽지 못함')
  assert.equal(rows.data[0].objective, 'Final integrity plan', name + ': 목표가 변경됨')
  assert.equal(rows.data[0].status, 'draft', name + ': 상태가 변경됨')
  assert.equal(rows.data[0].version, expectedVersion, name + ': 버전이 변경됨')
}

// ----------------------------------------------------------------
// A-03: request id required, tuple-bound, and raw inserts are barred
const missingKey = await createPlanRaw('owner', { p_client_request_id: null })
assert.equal(missingKey.ok, false, '빈 요청 ID가 허용됨')
const forged = await rest('editor', 'POST', 'pm_plans', {
  project_id: projectOne, objective: 'forged', source: 'human',
  created_by: people.editor.id, client_request_id: randomUUID(),
})
assert.equal(forged.ok, false, 'pm_plans 직접 POST가 부분 계획을 남김')
console.log('A-03 direct insert barred and request id required')

const requestId = randomUUID()
const create1 = await createPlanRaw('editor', { p_client_request_id: requestId })
assert.equal(create1.ok, true, 'create failed: ' + JSON.stringify(create1.data))
const create2 = await createPlanRaw('editor', { p_client_request_id: requestId })
assert.equal(create2.ok, true, '재시도 create failed')
assert.equal(create2.data.id, create1.data.id, '재시도가 다른 계획을 반환함')

const wrongProject = await rpc('otherEditor', 'create_pm_plan', {
  p_project_id: projectTwo,
  p_objective: 'Final integrity plan',
  p_steps: [step('Anchor task')],
  p_client_request_id: requestId,
})
assert.equal(wrongProject.ok, true, '다른 사용자의 동일 키는 별개 계획이어야 함')
assert.notEqual(wrongProject.data.id, create1.data.id)
const wrongPayload = await rpc('editor', 'create_pm_plan', {
  p_project_id: projectOne,
  p_objective: 'Completely different objective',
  p_steps: [step('Anchor task')],
  p_client_request_id: requestId,
})
assert.equal(wrongPayload.ok, false, '같은 키의 다른 본문이 기존 계획을 반환함')
assert.equal(wrongPayload.data?.code, '23505', '멱등 키 재사용은 23505 충돌이어야 함: ' + JSON.stringify(wrongPayload.data))

const patchedKey = await rest('owner', 'PATCH', 'pm_plans', {
  objective: 'Final integrity plan',
  client_request_id: randomUUID(),
  version: create1.data.version,
}, '?id=eq.' + create1.data.id)
assert.equal(patchedKey.ok, false, '요청 ID 직접 변경이 허용됨')
await assertOriginalPlan('A-03', create1.data.id, create1.data.version)
console.log('A-03 request id tuple-bound and immutable')

// ----------------------------------------------------------------
// A-01: composite status + content patch is never accepted
const plan = create1.data
const requestApproval = await rpc('editor', 'transition_pm_plan', {
  p_plan_id: plan.id,
  p_expected_version: plan.version,
  p_action: 'request_approval',
})
assert.equal(requestApproval.ok, true, '승인 요청 실패')
const pending = requestApproval.data

const various = [
  ['owner', 'approved'],
  ['owner', 'rejected'],
  ['owner', 'needs_revision'],
  ['editor', 'approved'],
]
for (const [role, toStatus] of various) {
  const patch = await rest(role, 'PATCH', 'pm_plans', {
    status: toStatus,
    objective: '변조된 내용',
    version: pending.version,
  }, '?id=eq.' + plan.id)
  assert.equal(patch.ok, false, role + '가 전이와 함께 본문을 변경함: ' + JSON.stringify(patch.data))
}
const stillPending = await rest('owner', 'GET', 'pm_plans', null, '?id=eq.' + plan.id)
assert.equal(stillPending.data.length, 1)
assert.equal(stillPending.data[0].status, 'pending_owner_approval', '복합 PATCH로 전이가 통과됨')
assert.equal(stillPending.data[0].objective, 'Final integrity plan', '복합 PATCH로 본문이 변조됨')
assert.equal(stillPending.data[0].version, pending.version, '복합 PATCH로 버전이 변경됨')

const approval = await rpc('owner', 'transition_pm_plan', {
  p_plan_id: plan.id,
  p_expected_version: pending.version,
  p_action: 'approve',
})
assert.equal(approval.ok, true, '정상 승인 RPC 실패')
const events = await rest('owner', 'GET', 'pm_plan_approval_events', null, '?plan_id=eq.' + plan.id + '&order=created_at')
assert.deepEqual(
  events.data.map((event) => event.event_type),
  ['draft_saved', 'approval_requested', 'approved'],
)
assert.equal(events.data[2].comment ?? null, null)
console.log('A-01 composite PATCH attack leaves original unless owner-approved via RPC')

// ----------------------------------------------------------------
// A-02: steps cannot move to another plan; locked parents reject them
const other = await createPlanRaw('editor')
assert.equal(other.ok, true)
const victimPlan = other.data
const victimStep = (await rest('editor', 'GET', 'pm_plan_steps', null, '?plan_id=eq.' + victimPlan.id)).data[0]
const moved = await rest('editor', 'PATCH', 'pm_plan_steps', { plan_id: plan.id }, '?id=eq.' + victimStep.id)
assert.equal(moved.ok, false, '단계의 plan_id 변경이 허용됨')
const after = await rest('editor', 'GET', 'pm_plans', null, '?id=eq.' + victimPlan.id)
assert.equal(after.data[0].version, victimPlan.version)
console.log('A-02 step redirection and parent audit drift prevented')

const pendingPlan = await createPlanRaw('editor')
assert.equal(pendingPlan.ok, true)
const requested = await rpc('editor', 'transition_pm_plan', {
  p_plan_id: pendingPlan.data.id,
  p_expected_version: pendingPlan.data.version,
  p_action: 'request_approval',
})
assert.equal(requested.ok, true)
const updated = await rest('editor', 'PATCH', 'pm_plan_steps', {
  title: 'tampered step',
}, '?plan_id=eq.' + pendingPlan.data.id)
assert.equal(updated.data?.length ?? 0, 0, 'pending 계획의 단계 변경이 허용됨')
const lockedStep = await rest('editor', 'GET', 'pm_plan_steps', null, '?plan_id=eq.' + pendingPlan.data.id)
assert.equal(lockedStep.data[0].title, 'Anchor task', 'pending 단계 제목이 변경됨')
const deleted = await rest('editor', 'DELETE', 'pm_plan_steps', null, '?plan_id=eq.' + pendingPlan.data.id)
assert.equal(deleted.data?.length ?? 0, 0, 'pending 계획의 단계 삭제가 허용됨')
console.log('A-02 pending/approved plans lock step writes')

// ----------------------------------------------------------------
// A-03 concurrency: parallel calls with one request id make one plan
const currentRequestId = randomUUID()
const parallel = await Promise.all([1, 2, 3, 4, 5].map(async () =>
  rpc('editor', 'create_pm_plan', {
    p_project_id: projectOne,
    p_objective: 'Concurrent fixture objective',
    p_steps: [step('Anchor task')],
    p_client_request_id: currentRequestId,
  })))
assert.equal(parallel.every((result) => result.ok), true, '병렬 요청 중 하나라도 실패')
const ids = new Set(parallel.map((result) => result.data?.id))
assert.equal(ids.size, 1, '병렬 요청이 중복을 만들었음')
const countForKey = await rest('editor', 'GET', 'pm_plans', null, '?client_request_id=eq.' + currentRequestId)
assert.equal(countForKey.data.length, 1)
console.log('A-03 concurrent retries collapse to one plan')

console.log('SUCCESS PM final integrity negatives')
