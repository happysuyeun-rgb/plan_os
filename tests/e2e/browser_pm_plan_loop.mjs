// Disposable browser E2E for the PM review loop (Issue #32, F-401/F-402):
// a human owner writes a plan in the UI, it persists to the real server,
// the owner approves it after a reload, and one approved step becomes an
// S1 task on the server-backed board. Nothing invokes AI or billing.
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
const email = 'browser-pm-plan@example.test'
const password = 'Synthetic-pm-plan-password-123!'
const OBJECTIVE = 'PM loop browser E2E objective text'
const STEP_ONE = 'Survey current users'
const STEP_TWO = 'Ship onboarding fix'

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
  email, password, email_confirm: true, user_metadata: { full_name: 'PM Plan E2E' },
})
const projectId = '99999999-9999-4999-8999-999999999999'
execFileSync('psql', [
  '-X', '-v', 'ON_ERROR_STOP=1',
  '-c', `delete from public.projects where id = '${projectId}'`,
  '-c', `insert into public.projects(id,user_id,title) values ('${projectId}','${created.id}','PM loop E2E project')`,
], {
  env: {
    ...process.env, PGHOST: '127.0.0.1', PGPORT: process.env.PLANOS_LOCAL_DB_PORT ?? '55322',
    PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres', PGSSLMODE: 'disable',
  },
  stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
})
console.log('PASS PM loop account and project seeded')

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

  // Enter through the S1 board, following the N03 -> N08 link.
  await page.goto(site + '/projects/' + projectId + '/tasks', { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: 'PM 계획 →' }).click()
  await page.waitForURL((u) => u.pathname === '/projects/' + projectId + '/plans', { timeout: 30000 })
  await page.getByRole('button', { name: '새 계획 작성' }).click()
  await page.waitForURL((u) => u.pathname === '/projects/' + projectId + '/plans/new', { timeout: 30000 })

  await page.getByLabel('업무 목표').fill(OBJECTIVE)
  await page.getByLabel('단계 제목').first().fill(STEP_ONE)
  await page.getByLabel('완료 기준').first().fill('Survey findings documented')
  await page.getByRole('button', { name: '+ 단계 추가' }).click()
  await page.getByLabel('단계 제목').nth(1).fill(STEP_TWO)
  await page.getByLabel('완료 기준').nth(1).fill('Onboarding funnel patched')
  await page.getByLabel('선행 단계').nth(1).selectOption({ index: 1 })
  await page.getByRole('button', { name: '서버에 초안 저장' }).click()
  await page.waitForURL((u) => /\/plans\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 30000 })
  const planId = page.url().split('/').pop()
  console.log('PASS human plan draft saved through the UI: ' + planId)

  // The draft survives a full reload with the human source badge.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText('사람이 작성한 계획', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  await page.getByText('상태: 초안', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  console.log('PASS saved plan survives a browser reload with source and status')

  await page.getByRole('button', { name: '승인 요청' }).click()
  await page.getByText('상태: 소유자 승인 대기', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('button', { name: '반려' }).click()
  await page.getByText('상태: 반려됨', { exact: false }).first()
  .waitFor({ state: 'visible', timeout: 25000 })
  console.log('PASS owner decision flow (request -> reject) renders correctly')

  // Preparing a revision reopens the draft and saves again.
  await page.getByLabel('업무 목표').fill(OBJECTIVE + ' revised')
  await page.getByRole('button', { name: '초안 저장' }).click()
  await page.getByText('초안이 서버에 저장되었습니다.', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('button', { name: '승인 요청' }).click()
  await page.getByText('상태: 소유자 승인 대기', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('button', { name: '승인', exact: true }).click()
  await page.getByText('상태: 승인됨', { exact: false }).first()
  .waitFor({ state: 'visible', timeout: 25000 })
  console.log('PASS revision reopened the draft and owner approval landed in the UI')

  // Approve the step into the S1 board and see it there after navigation.
  await page.getByRole('button', { name: '이 단계를 업무로 생성' }).first().click()
  await page.getByText('업무 보드에 연결됨', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('link', { name: STEP_ONE, exact: false }).first().click()
  await page.waitForURL((u) => u.pathname === '/projects/' + projectId + '/tasks', { timeout: 30000 })
  await page.getByText(STEP_ONE, { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText(STEP_ONE, { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  console.log('PASS linked task is visible on the S1 board and survives reload')

  // Server-side cross-check: exactly one linked task, audit trail complete.
  const token = await ownerToken()
  const tasksResponse = await fetch(
    api + '/rest/v1/project_tasks?select=id,title,source_plan_step_id&project_id=eq.' + projectId,
    { headers: { apikey: variables.ANON_KEY, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) },
  )
  const tasks = await tasksResponse.json()
  assert.equal(tasks.length, 1, 'expected exactly one linked task: ' + JSON.stringify(tasks))
  const eventsResponse = await fetch(
    api + '/rest/v1/pm_plan_approval_events?select=event_type&plan_id=eq.' + planId + '&order=created_at',
    { headers: { apikey: variables.ANON_KEY, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) },
  )
  const events = await eventsResponse.json()
  const kinds = events.map((e) => e.event_type)
  for (const expected of ['draft_saved', 'approval_requested', 'rejected', 'approval_requested', 'approved', 'step_task_linked']) {
    assert(kinds.includes(expected), 'missing audit event ' + expected)
  }
  console.log('PASS server state: one linked task and a complete audit trail')

  console.log('SUCCESS PM plan review loop browser E2E (write, reload, review, link)')
} finally {
  await browser?.close()
}
