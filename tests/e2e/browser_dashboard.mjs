// Disposable browser E2E for the C04 integrated dashboard (Issue #39):
// seeded task states on real server rows are aggregated by RLS and shown
// as 등록 업무 완료율 / 차단 / 승인 대기; clicking a project row navigates to
// the existing S1 board. Nothing invokes AI or billing.
// Disposable local Supabase + local Vite dev server only.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(localDir, 'PLANOS_LOCAL_SUPABASE_DIR is required')
for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_URL', 'SUPABASE_DB_PASSWORD']) {
  assert(!process.env[key], 'Hosted Supabase credentials are not allowed')
}
const raw = execFileSync('supabase', ['status', '-o', 'env'], {
  cwd: localDir, encoding: 'utf8', timeout: 30000,
})
const variables = Object.fromEntries(raw.split('\n').flatMap((line) => {
  const match = line.match(/^([A-Z_]+)=(.*)$/)
  return match ? [[match[1], match[2].replace(/^["']|["']$/g, '')]] : []
}))
assert(variables.SERVICE_ROLE_KEY && variables.ANON_KEY)
const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')
const site = 'http://127.0.0.1:5173'
const email = 'browser-dashboard@example.test'
const password = 'Synthetic-dashboard-password-123!'

async function admin(path, method, body) {
  const r = await fetch(api + path, {
    method,
    headers: {
      apikey: variables.SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + variables.SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  const result = await r.json()
  assert(r.ok, 'admin auth operation failed HTTP ' + r.status)
  return result
}

const listed = await admin('/auth/v1/admin/users?per_page=100', 'GET')
const leftover = (listed.users ?? []).find((u) => u.email === email)
if (leftover) await admin('/auth/v1/admin/users/' + leftover.id, 'DELETE')
const created = await admin('/auth/v1/admin/users', 'POST', {
  email, password, email_confirm: true, user_metadata: { full_name: 'Dashboard E2E' },
})

const projectWithTasks = 'aaaaaaaa-0000-4000-8000-000000000001'
const projectEmpty = 'aaaaaaaa-0000-4000-8000-000000000002'
execFileSync('psql', [
  '-X', '-v', 'ON_ERROR_STOP=1',
  '-c', `delete from public.projects where id in ('${projectWithTasks}','${projectEmpty}')`,
  '-c', `insert into public.projects(id,user_id,title,service_type) values ('${projectWithTasks}','${created.id}','Dashboard Tasks Project','SaaS')`,
  '-c', `insert into public.projects(id,user_id,title,service_type) values ('${projectEmpty}','${created.id}','Dashboard Empty Project','SaaS')`,
], {
  env: {
    ...process.env, PGHOST: '127.0.0.1', PGPORT: process.env.PLANOS_LOCAL_DB_PORT ?? '55322',
    PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres', PGSSLMODE: 'disable',
  },
  stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
})
console.log('PASS dashboard account and two projects seeded')

async function ownerToken() {
  const r = await fetch(api + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: variables.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  })
  const body = await r.json()
  assert(body.access_token, 'password grant failed')
  return body.access_token
}

// Seed 10 tasks (done 4, blocked 2, todo 4) through the same versioned PATCH
// discipline the S1 board uses, then one pending-owner-approval PM plan.
const token = await ownerToken()
const authHeaders = { apikey: variables.ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' }

async function createTask(title, target) {
  const r = await fetch(api + '/rest/v1/project_tasks', {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ project_id: projectWithTasks, title, created_by: created.id }),
    signal: AbortSignal.timeout(15000),
  })
  const [task] = await r.json()
  assert(task?.id, 'task create failed for ' + title)
  let version = 1
  const move = async (to, reason) => {
    const response = await fetch(api + '/rest/v1/project_tasks?id=eq.' + task.id, {
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

const planResponse = await fetch(api + '/rest/v1/rpc/create_pm_plan', {
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
const submit = await fetch(api + '/rest/v1/rpc/transition_pm_plan', {
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
} finally {
  if (browser) await browser.close().catch(() => {})
}
console.log('SUCCESS: C04 dashboard renders real server aggregates over the browser')
