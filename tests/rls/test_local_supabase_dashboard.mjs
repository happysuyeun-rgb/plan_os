import assert from 'node:assert/strict'
import { people, projectOne, projectTwo, anonKey, API_URL } from './test_local_supabase_auth.mjs'

const bearer = (person, extra = {}) => ({
  Authorization: `Bearer ${person.access_token}`,
  apikey: anonKey,
  ...extra,
})

const via = (person, init) => fetch(API_URL + init.path, {
  headers: { ...bearer(person), 'Content-Type': 'application/json', Prefer: init.prefer ?? 'return=representation' },
  method: init.method ?? 'GET',
  body: init.body ? JSON.stringify(init.body) : undefined,
}).then(async (res) => ({
  status: res.status,
  body: await res.json().catch(() => null),
}))

const must = async (label, promise, expected = 201) => {
  const res = await promise
  if (res.status !== expected) throw new Error(`${label}: 예상 ${expected}, 실제 ${res.status} ${JSON.stringify(res.body)?.slice(0, 200)}`)
  return res.body
}

// 대시보드 API(PostgREST 형태)와 같은 쿼리 경로를 답습한다.
async function dashboardView(person) {
  const own = await via(person, {
    path: `/rest/v1/projects?select=id,title&user_id=eq.${person.id}&deleted_at=is.null`,
  })
  const memberships = await via(person, {
    path: `/rest/v1/project_members?select=project_id&user_id=eq.${person.id}&status=eq.active`,
  })
  const ownIds = (own.body ?? []).map((p) => p.id)
  const memberIds = (memberships.body ?? [])
    .map((m) => m.project_id)
    .filter((projectId) => !ownIds.includes(projectId))
  const projectIds = [...ownIds, ...memberIds]
  if (projectIds.length === 0) return { projectIds, tasksPerProject: new Map() }

  const tasks = await via(person, {
    path: `/rest/v1/project_tasks?select=project_id,status&project_id=in.(${projectIds.join(',')})&deleted_at=is.null`,
  })
  const tasksPerProject = new Map()
  for (const projectId of projectIds) tasksPerProject.set(projectId, { total: 0, done: 0, blocked: 0 })
  for (const task of tasks.body ?? []) {
    const slot = tasksPerProject.get(task.project_id)
    if (!slot) throw new Error('접근할 수 없는 프로젝트의 업무가 집계에 섞였다')
    slot.total += 1
    if (task.status === 'done') slot.done += 1
    if (task.status === 'blocked') slot.blocked += 1
  }
  return { projectIds, tasksPerProject }
}

let currentVersion = 1
async function moveTask(person, taskId, to, reason) {
  const res = await via(person, {
    path: `/rest/v1/project_tasks?id=eq.${taskId}`,
    method: 'PATCH',
    body: {
      status: to,
      version: currentVersion + 1,
      ...(reason ? { blocked_reason: reason } : {}),
    },
  })
  if (!Array.isArray(res.body) || res.body.length === 0) {
    throw new Error(`업무 전이 실패 ${JSON.stringify(res.body)?.slice(0, 200)}`)
  }
  currentVersion += 1
}

async function createTask(person, projectId, title, targetStatus) {
  const [task] = await must('업무 생성', via(person, {
    path: '/rest/v1/project_tasks',
    method: 'POST',
    body: { project_id: projectId, title, created_by: person.id },
  }))
  currentVersion = 1
  if (targetStatus === 'done') {
    await moveTask(person, task.id, 'in_progress')
    await moveTask(person, task.id, 'in_review')
    await moveTask(person, task.id, 'done')
  } else if (targetStatus === 'blocked') {
    await moveTask(person, task.id, 'blocked', `${title} 차단 사유`)
  } else if (targetStatus === 'in_progress') {
    await moveTask(person, task.id, 'in_progress')
  } else if (targetStatus !== 'todo') {
    throw new Error(`지원하지 않는 목표 상태 ${targetStatus}`)
  }
  return task.id
}

console.log('test_local_supabase_dashboard starting...')

// 소유자 프로젝트(projectOne) + 두 번째 프로젝트(projectTwo, 소유자는 otherOwner)
// 수용 fixture: A 업무 10 (done 4, blocked 2, todo 4), B 업무 2(done 2), C 업무 0
const owner = people.owner

for (let i = 1; i <= 4; i += 1) await createTask(owner, projectOne, `DASH-A${i}`, 'done')
for (let i = 5; i <= 6; i += 1) await createTask(owner, projectOne, `DASH-A${i}`, 'blocked')
for (let i = 7; i <= 10; i += 1) await createTask(owner, projectOne, `DASH-A${i}`, 'todo')
for (let i = 1; i <= 2; i += 1) await createTask(people.otherOwner, projectTwo, `DASH-B${i}`, 'done')

// owner: A (10건, done 4, blocked 2). owner는 projectTwo 소유·멤버가 아니므로 집계에서 완전히 제외된다.
const ownerView = await dashboardView(owner)
assert.strictEqual(ownerView.projectIds.length, 1)
assert.strictEqual(ownerView.projectIds[0], projectOne)
assert.deepStrictEqual(ownerView.tasksPerProject.get(projectOne), { total: 10, done: 4, blocked: 2 })
assert.deepStrictEqual(ownerView.tasksPerProject.get(projectTwo), undefined)
console.log('대시보드: owner에게 타인 프로젝트가 격리돼 확인')

// editor: 활성화된 초대 프로젝트(projectOne)만 보이고, projectTwo는 보이지 않는다.
const editorView = await dashboardView(people.editor)
assert.strictEqual(editorView.projectIds.length, 1)
assert.strictEqual(editorView.projectIds[0], projectOne)
assert.deepStrictEqual(editorView.tasksPerProject.get(projectOne), { total: 10, done: 4, blocked: 2 })
assert.strictEqual(editorView.projectIds.includes(projectTwo), false)
console.log('대시보드: 활성 멤버 프로젝트만 표시 확인')

// otherOwner: 소유 프로젝트 projectTwo만 보인다. 두 소유 프로젝트의 통합 합계 6/12는
// 단위 테스트(buildWorkSummaries + summarizeTotals)와 브라우저 E2E에서 검증한다.
const otherOwnerView = await dashboardView(people.otherOwner)
assert.strictEqual(otherOwnerView.projectIds.length, 1)
assert.deepStrictEqual(otherOwnerView.tasksPerProject.get(projectTwo), { total: 2, done: 2, blocked: 0 })
console.log('대시보드: 두 번째 소유자 프로젝트에서 B 2/2 집계 확인')

// outsider: 접근 가능한 프로젝트가 없어 집계가 비어 있어야 한다.
const outsiderView = await dashboardView(people.outsider)
assert.strictEqual(outsiderView.projectIds.length, 0)
assert.strictEqual(outsiderView.tasksPerProject.size, 0)
console.log('대시보드: outsider 비노출 확인')

// viewer는 공유 프로젝트(projectOne)를 볼 수 있고, 다른 프로젝트(projectTwo)는 보지 못한다.
const viewerView = await dashboardView(people.viewer)
assert.strictEqual(viewerView.projectIds.length, 1)
assert.strictEqual(viewerView.projectIds[0], projectOne)
console.log('대시보드: viewer 공유 프로젝트 표시 확인')

// 업무 없는 프로젝트를 소유하면 '업무 미등록' 근거가 된다 (전용 프로젝트 하나를 owner가 소유).
const [emptyProject] = await must('업무 없는 프로젝트 생성', via(owner, {
  path: '/rest/v1/projects',
  method: 'POST',
  body: { user_id: owner.id, title: 'DASH-C', description: 'dashboard fixture', service_type: 'SaaS', target_user: 'testers' },
}))
const refreshedOwnerView = await dashboardView(owner)
assert.strictEqual(refreshedOwnerView.projectIds.includes(emptyProject.id), true)
assert.deepStrictEqual(refreshedOwnerView.tasksPerProject.get(emptyProject.id), { total: 0, done: 0, blocked: 0 })
console.log('대시보드: 업무 없는 프로젝트가 0건으로 분류되 확인')

const plansVisible = await via(owner, { path: '/rest/v1/pm_plans?select=id&status=eq.pending_owner_approval' })
assert.strictEqual(plansVisible.status, 200)
console.log(`대시보드: 승인 대기 쿼리 동작 (현재 ${plansVisible.body?.length ?? 0}건 pending) 확인`)

// ------------------------------------------------------------------
// B-01: 서버 집계 RPC는 1,001건에서도 잘리지 않고 역할별로 격리된다.
const [bulkProject] = await must('대량 fixture 프로젝트 생성', via(owner, {
  path: '/rest/v1/projects',
  method: 'POST',
  body: { user_id: owner.id, title: 'DASH-BULK', description: 'bulk fixture', service_type: 'SaaS', target_user: 'testers' },
}))
const bulkSeeds = []
for (let i = 0; i < 1001; i += 1) {
  bulkSeeds.push({ project_id: bulkProject.id, title: `BULK-${i}`, created_by: owner.id })
}
for (let offset = 0; offset < bulkSeeds.length; offset += 200) {
  const chunk = bulkSeeds.slice(offset, offset + 200)
  await must('대량 업무 삽입', via(owner, {
    path: '/rest/v1/project_tasks',
    method: 'POST',
    body: chunk,
  }))
}
const { execFileSync } = await import('node:child_process')
const bulkSql = (sql) => execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], {
  env: {
    ...process.env, PGHOST: '127.0.0.1', PGPORT: process.env.PLANOS_LOCAL_DB_PORT ?? '55322',
    PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres', PGSSLMODE: 'disable',
  },
  encoding: 'utf8', timeout: 60000,
})
bulkSql(`update public.project_tasks set status='in_progress', version=2 where project_id='${bulkProject.id}' and title like 'BULK-%' and (substring(title from 6))::int < 550`)
bulkSql(`update public.project_tasks set status='in_review', version=3 where project_id='${bulkProject.id}' and status='in_progress' and (substring(title from 6))::int < 400`)
bulkSql(`update public.project_tasks set status='done', version=4 where project_id='${bulkProject.id}' and status='in_review' and (substring(title from 6))::int < 250`)
bulkSql(`update public.project_tasks set status='blocked', version=3, blocked_reason='bulk blocked' where project_id='${bulkProject.id}' and status='in_progress' and (substring(title from 6))::int between 400 and 499`)
// done 250, in_review 150, blocked 100, in_progress 50, todo 451 = 1001

async function rpcCounts(person, projectIds) {
  const res = await via(person, {
    path: '/rest/v1/rpc/get_dashboard_task_counts',
    method: 'POST',
    body: { p_project_ids: projectIds },
  })
  assert.strictEqual(res.status, 200, '집계 RPC 실패: ' + JSON.stringify(res.body))
  return new Map((res.body ?? []).map((row) => [row.project_id, row]))
}

const bulkCounts = await rpcCounts(owner, [bulkProject.id])
assert.deepStrictEqual(bulkCounts.get(bulkProject.id), {
  project_id: bulkProject.id, total: 1001, done: 250, in_progress: 50, in_review: 150, blocked: 100,
})
console.log('대시보드: 1,001건 서버 집계가 잘리지 않음')

const outsiderCounts = await rpcCounts(people.outsider, [bulkProject.id])
assert.strictEqual(Number(outsiderCounts.get(bulkProject.id)?.total ?? -1), 0, 'outsider에게 업무 수가 노출됨')
const editorCounts = await rpcCounts(people.editor, [bulkProject.id])
assert.strictEqual(Number(editorCounts.get(bulkProject.id)?.total ?? -1), 0, '미공유 editor에게 업무 수가 노출됨')
console.log('대시보드: 집계 RPC도 RLS로 격리됨')

const approvalCounts = await via(owner, {
  path: '/rest/v1/rpc/get_dashboard_pending_approvals',
  method: 'POST',
  body: { p_project_ids: [projectOne, projectTwo, bulkProject.id] },
})
assert.strictEqual(approvalCounts.status, 200)
assert(approvalCounts.body.every((row) => Number(row.pending_approvals) === 0))
console.log('대시보드: 승인 대기 RPC가 프로젝트별로 0건을 정확히 반환')

console.log('test_local_supabase_dashboard 통과')
