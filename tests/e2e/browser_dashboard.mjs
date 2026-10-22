// Disposable browser E2E for the C04 integrated dashboard (Issue #39):
// seeded task states on real server rows are aggregated by RLS and shown
// as 등록 업무 완료율 / 차단 / 승인 대기; clicking a project row navigates to
// the existing S1 board. Nothing invokes AI or billing.
// Disposable local Supabase + local Vite dev server only.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createAdminClient, loopbackUrl } from '../helpers/rest.mjs'
import { runPsqlStatements } from '../helpers/psql.mjs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(localDir, 'PLANOS_LOCAL_SUPABASE_DIR is required')
const variables = readLocalSupabaseEnv(localDir)
assert(variables.SERVICE_ROLE_KEY && variables.ANON_KEY)
const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')
const site = 'http://127.0.0.1:5173'
const email = `browser-dashboard-${Date.now()}@example.test`
const password = 'Synthetic-dashboard-password-123!'

const admin = createAdminClient({ apiUrl: api, serviceKey: variables.SERVICE_ROLE_KEY })

// Test accounts can outnumber one admin page after repeated local runs.
async function findUserByEmail(targetEmail) {
  for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
    const listedPage = await admin(`/auth/v1/admin/users?page=${pageNumber}&per_page=100`, 'GET')
    const users = listedPage.users ?? []
    const found = users.find((u) => u.email === targetEmail)
    if (found) return found
    if (users.length < 100) return null
  }
  return null
}

const leftover = await findUserByEmail(email)
if (leftover) await admin('/auth/v1/admin/users/' + leftover.id, 'DELETE')
const created = await admin('/auth/v1/admin/users', 'POST', {
  email, password, email_confirm: true, user_metadata: { full_name: 'Dashboard E2E' },
})

const projectWithTasks = 'aaaaaaaa-0000-4000-8000-000000000001'
const projectEmpty = 'aaaaaaaa-0000-4000-8000-000000000002'
runPsqlStatements([
  `delete from public.projects where id in ('${projectWithTasks}','${projectEmpty}')`,
  `insert into public.projects(id,user_id,title,service_type) values ('${projectWithTasks}','${created.id}','Dashboard Tasks Project','SaaS')`,
  `insert into public.projects(id,user_id,title,service_type) values ('${projectEmpty}','${created.id}','Dashboard Empty Project','SaaS')`,
])
console.log('PASS dashboard account and two projects seeded')

async function ownerToken() {
  const r = await fetch(loopbackUrl(api, '/auth/v1/token?grant_type=password'), {
    method: 'POST',
    headers: { apikey: variables.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  })
  const body = await r.json()
  assert(body.access_token, 'password grant failed')
  return body.access_token
}

// Second account that only receives the first project as a shared member.
const sharedEmail = `browser-dashboard-shared-${Date.now()}@example.test`
const leftoverShared = await findUserByEmail(sharedEmail)
if (leftoverShared) await admin('/auth/v1/admin/users/' + leftoverShared.id, 'DELETE')
const sharedUser = await admin('/auth/v1/admin/users', 'POST', {
  email: sharedEmail, password, email_confirm: true,
  user_metadata: { full_name: 'Dashboard Shared E2E' },
})
runPsqlStatements([
  `update public.users set onboarding_completed = true where id = '${sharedUser.id}'`,
  `delete from public.project_members where project_id = '${projectWithTasks}' and user_id = '${sharedUser.id}'`,
  `insert into public.project_members(project_id,user_id,email,role,status) values ('${projectWithTasks}','${sharedUser.id}','${sharedEmail}','editor','active')`,
])

// Seed 10 tasks (done 4, blocked 2, todo 4) through the same versioned PATCH
// discipline the S1 board uses, then one pending-owner-approval PM plan.
const token = await ownerToken()
const authHeaders = { apikey: variables.ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' }

async function createTask(title, target) {
  const r = await fetch(loopbackUrl(api, '/rest/v1/project_tasks'), {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ project_id: projectWithTasks, title, created_by: created.id }),
    signal: AbortSignal.timeout(15000),
  })
  const [task] = await r.json()
  assert(task?.id, 'task create failed for ' + title)
  let version = 1
  const move = async (to, reason) => {
    const response = await fetch(loopbackUrl(api, '/rest/v1/project_tasks?id=eq.' + task.id), {
      method: 'PATCH', headers: authHeaders,
      body: JSON.stringify({ status: to, version: version + 1, ...(reason ? { blocked_reason: reason } : {}) }),
      signal: AbortSignal.timeout(15000),
    })
    const rows = await response.json()
    assert(response.ok && Array.isArray(rows) && rows.length === 1, 'task move failed: ' + to)
    version += 1
  }
  if (target === 'done') { await move('in_progress'); await move('in_review'); await move('done') }
  else if (target === 'blocked') { await move('blocked', title + '의 차단 사유') }
}

for (let i = 1; i <= 4; i += 1) await createTask(`E2E task done ${i}`, 'done')
for (let i = 5; i <= 6; i += 1) await createTask(`E2E task blocked ${i}`, 'blocked')
for (let i = 7; i <= 10; i += 1) await createTask(`E2E task todo ${i}`, 'todo')

const planResponse = await fetch(loopbackUrl(api, '/rest/v1/rpc/create_pm_plan'), {
  method: 'POST', headers: authHeaders,
  body: JSON.stringify({
    p_project_id: projectWithTasks,
    p_objective: 'Dashboard approval aggregation fixture plan',
    p_steps: [{ title: 'Aggregation fixture step', acceptance_criteria: 'Dashboard shows the pending approval', depends_on_position: null, position: 0 }],
    p_client_request_id: crypto.randomUUID(),
  }),
  signal: AbortSignal.timeout(15000),
})
const plan = await planResponse.json()
assert(plan?.id, 'pm plan creation failed: ' + JSON.stringify(plan))
const submit = await fetch(loopbackUrl(api, '/rest/v1/rpc/transition_pm_plan'), {
  method: 'POST', headers: authHeaders,
  body: JSON.stringify({ p_plan_id: plan.id, p_expected_version: plan.version, p_action: 'request_approval' }),
  signal: AbortSignal.timeout(15000),
})
assert(submit.ok, 'plan submission failed: ' + await submit.text())
console.log('PASS 10 seeded tasks (done 4 / blocked 2 / todo 4) and one pending plan')

let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

  await page.goto(site + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.getByRole('button', { name: '임시 로그인' }).click()
  await page.waitForURL((u) => u.pathname === '/onboarding', { timeout: 30000 })
  await page.getByRole('button', { name: '첫 프로젝트 시작하기' }).click()
  await page.waitForURL((u) => u.pathname === '/projects/new', { timeout: 30000 })

  await page.goto(site + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.getByText('접근 가능한 프로젝트', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  console.log('PASS dashboard KPI section renders')

  // 프로젝트별 완료율: 4 / 10, 빈 프로젝트는 '업무 미등록'
  await page.getByText('4 / 10 · 40%', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  await page.getByText('업무 미등록', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  console.log('PASS per-project completion 4/10 40% and empty-project label render')

  // 상태별 건수 + 승인 대기
  await page.getByText('차단 2', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  await page.getByText('승인 대기 1건', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  await page.getByText('마지막 업데이트', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  console.log('PASS blocked count, pending approval and sync timestamp render')

  // 새로고침 버튼이 동작한다.
  await page.getByRole('button', { name: '새로고침' }).click()
  await page.getByText('4 / 10 · 40%', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  console.log('PASS manual refresh re-renders the same server aggregates')

  // 프로젝트 행 클릭 → 실제 업무 보드 이동
  await page.getByRole('button', { name: /Dashboard Tasks Project/ }).click()
  await page.waitForURL((u) => u.pathname === '/projects/' + projectWithTasks + '/tasks', { timeout: 30000 })
  await page.getByText('E2E task done 1', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  console.log('PASS project row navigates to the real S1 board')

  // 모드가 없는 사용자는 대시보드 자체는 그대로 쓸 수 있다 (빈 상태 확인은 서버 모드 ON 경로에서만).
  await page.goto(site + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.getByText('접근 가능한 프로젝트', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  console.log('PASS returning visit renders the dashboard again')

  // B-04: delay the owner's summary RPC, switch accounts mid-flight, and
  // prove the late owner response never lands on the shared user's screen.
  await page.route('**/rest/v1/rpc/get_dashboard_task_counts', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    await route.continue()
  })
  await page.goto(site + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(800)
  await page.goto(site + '/settings', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.getByRole('button', { name: '로그아웃' }).click()
  await page.waitForURL((u) => u.pathname === '/login', { timeout: 30000 })
  await page.unroute('**/rest/v1/rpc/get_dashboard_task_counts')
  await page.locator('input[type=email]').fill(sharedEmail)
  await page.locator('input[type=password]').fill(password)
  await page.getByRole('button', { name: '임시 로그인' }).click()
  // A brand-new account lands on onboarding first; shared members skip
  // project creation and go straight to the dashboard.
  await page.waitForURL((u) => ['/onboarding', '/dashboard'].includes(u.pathname), { timeout: 30000 })
  if (page.url().includes('/onboarding')) {
    await page.goto(site + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
  }
  await page.getByText('4 / 10 · 40%', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  const dashboardText = await page.locator('body').innerText()
  assert(!dashboardText.includes('Dashboard Empty Project'), '이전 계정의 프로젝트가 새 계정 화면에 노출됨')
  assert(dashboardText.includes('본인이 소유한 프로젝트는 없습니다'), '공유 전용 계정 안내가 표시되지 않음')
  assert(dashboardText.includes('공유받은 프로젝트'), '공유 프로젝트 카드가 표시되지 않음')
  console.log('PASS account switch mid-load keeps accounts isolated; shared-only layout is consistent')

  // 오류 후 재시도: RPC를 한 번 실패시킨 뒤 '다시 시도'로 복구한다.
  let failOnce = true
  await page.route('**/rest/v1/rpc/get_dashboard_task_counts', async (route) => {
    if (failOnce) {
      failOnce = false
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"fixture failure"}' })
      return
    }
    await route.continue()
  })
  await page.goto(site + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.getByRole('button', { name: '다시 시도' }).click()
  await page.getByText('4 / 10 · 40%', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  await page.unroute('**/rest/v1/rpc/get_dashboard_task_counts')
  console.log('PASS failed summary load recovers through the retry button')
} finally {
  if (browser) await browser.close().catch(() => {})
}
console.log('SUCCESS: C04 dashboard renders real server aggregates over the browser')
