// Disposable browser E2E for the PM review loop (Issue #32, F-401/F-402):
// human owner writes a plan in the UI, persists to the real server, runs
// request → needs_revision → revise → resubmit → approve, links a step to
// S1, and verifies stale/duplicate decisions are rejected. No AI/billing.
// Disposable local Supabase + local Vite only.
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { createAdminClient, loopbackUrl, assertUuid } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
const variables = readLocalSupabaseEnv(localDir)
const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')
const site = 'http://127.0.0.1:5173'
const email = `browser-pm-plan-${Date.now()}@example.test`
const password = 'Synthetic-pm-plan-password-123!'
const OBJECTIVE = 'PM loop browser E2E objective text'
const STEP_ONE = 'Survey current users'
const STEP_TWO = 'Ship onboarding fix'
const ARTIFACT_DIR = 'artifacts/pm-plan-e2e'

mkdirSync(ARTIFACT_DIR, { recursive: true })

const admin = createAdminClient({ apiUrl: api, serviceKey: variables.SERVICE_ROLE_KEY })

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
  email, password, email_confirm: true, user_metadata: { full_name: 'PM Plan E2E' },
})
const projectId = '99999999-9999-4999-8999-999999999999'
assertUuid(created.id, 'created user id')
runPsqlSeed([
  `delete from public.projects where id = '${assertUuid(projectId, 'project id')}'`,
  `insert into public.projects(id,user_id,title) values ('${projectId}','${created.id}','PM loop E2E project')`,
])
console.log('PASS PM loop account and project seeded')

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

async function rpcTransition(token, planId, expectedVersion, action, comment = null) {
  const response = await fetch(loopbackUrl(api, '/rest/v1/rpc/transition_pm_plan'), {
    method: 'POST',
    headers: {
      apikey: variables.ANON_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      p_plan_id: planId,
      p_expected_version: expectedVersion,
      p_action: action,
      p_comment: comment,
    }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

async function shot(page, name) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/${name}.png`, fullPage: true })
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
  await shot(page, '01-draft-saved')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText('사람이 작성한 계획', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  await page.getByText('상태: 초안', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  console.log('PASS saved plan survives a browser reload with source and status')

  await page.getByRole('button', { name: '승인 요청' }).click()
  await page.getByText('상태: 소유자 승인 대기', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await shot(page, '02-pending-approval')
  console.log('PASS approval request submitted')

  // Stale version must fail before a real decision lands.
  const token = await ownerToken()
  const stale = await rpcTransition(token, planId, 1, 'approve', 'stale attempt')
  assert(!stale.ok, 'stale approve must fail: ' + JSON.stringify(stale.data))
  const staleCode = stale.data?.code ?? stale.data?.error ?? ''
  assert(String(staleCode).includes('P4001') || stale.status === 400 || stale.status === 409,
    'stale approve must surface conflict: ' + JSON.stringify(stale.data))
  console.log('PASS stale plan version approve is rejected (CAS)')

  await page.getByPlaceholder('승인/반려/수정 요청 사유').fill('tighten step two criteria')
  await page.getByRole('button', { name: '수정 요청' }).click()
  await page.getByText('상태: 수정 요청', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await page.getByText('수정 요청', { exact: true }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await shot(page, '03-needs-revision')
  console.log('PASS owner needs_revision decision renders with history')

  await page.getByLabel('업무 목표').fill(OBJECTIVE + ' revised')
  await page.getByRole('button', { name: '초안 저장' }).click()
  await page.getByText('초안이 서버에 저장되었습니다.', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await page.getByText('상태: 초안', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  console.log('PASS revision reopened the draft after needs_revision')

  await page.getByRole('button', { name: '승인 요청' }).click()
  await page.getByText('상태: 소유자 승인 대기', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('button', { name: '승인', exact: true }).click()
  await page.getByText('상태: 승인됨', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await shot(page, '04-approved')
  console.log('PASS resubmit and owner approval landed in the UI')

  // Duplicate approve after terminal approved must fail.
  const planRows = await fetch(
    loopbackUrl(api, '/rest/v1/pm_plans?select=id,version,status&id=eq.' + planId),
    {
      headers: { apikey: variables.ANON_KEY, Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(15000),
    },
  )
  const [approvedPlan] = await planRows.json()
  assert.equal(approvedPlan.status, 'approved')
  const dup = await rpcTransition(token, planId, approvedPlan.version, 'approve', 'duplicate')
  assert(!dup.ok, 'duplicate approve must fail: ' + JSON.stringify(dup.data))
  console.log('PASS duplicate approve on approved plan is rejected')

  // Decision buttons disappear after approval (UI sync).
  assert.equal(await page.getByRole('button', { name: '승인', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '수정 요청' }).count(), 0)

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
  await shot(page, '05-s1-linked-after-reload')
  console.log('PASS linked task is visible on the S1 board and survives reload')

  const tasksResponse = await fetch(
    loopbackUrl(api, '/rest/v1/project_tasks?select=id,title,source_plan_step_id&project_id=eq.' + projectId),
    { headers: { apikey: variables.ANON_KEY, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) },
  )
  const tasks = await tasksResponse.json()
  assert.equal(tasks.length, 1, 'expected exactly one linked task: ' + JSON.stringify(tasks))
  const eventsResponse = await fetch(
    loopbackUrl(api, '/rest/v1/pm_plan_approval_events?select=event_type&plan_id=eq.' + planId + '&order=created_at'),
    { headers: { apikey: variables.ANON_KEY, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) },
  )
  const events = await eventsResponse.json()
  const kinds = events.map((e) => e.event_type)
  for (const expected of [
    'draft_saved',
    'approval_requested',
    'needs_revision',
    'approval_requested',
    'approved',
    'step_task_linked',
  ]) {
    assert(kinds.includes(expected), 'missing audit event ' + expected + ' in ' + kinds.join(','))
  }
  console.log('PASS server state: one linked task and a complete audit trail')

  console.log('SUCCESS PM plan review loop browser E2E (write, revision, approve, CAS, link)')
} finally {
  await browser?.close()
}
