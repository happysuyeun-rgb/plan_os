// Disposable browser E2E for the first-create race (A-02): while the
// generation pipeline writes the first document for a brand-new project,
// a rival session creates that document first, so the pipeline's INSERT
// hits 23505. The client must surface the failure (not silently overwrite
// the winner, not claim success), keep the user's form input for an
// explicit retry, and complete through CAS on the retry.
// Runs only against the disposable local Supabase + local Vite dev server.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createAdminClient } from '../helpers/rest.mjs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(localDir, 'PLANOS_LOCAL_SUPABASE_DIR is required')
const variables = readLocalSupabaseEnv(localDir)
const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')
const site = 'http://127.0.0.1:5173'
const email = `browser-create-conflict-${Date.now()}@example.test`
const password = 'Synthetic-create-conflict-password-123!'
const TITLE = 'First create A02 ' + Date.now()

const admin = createAdminClient({ apiUrl: api, serviceKey: variables.SERVICE_ROLE_KEY })

const listed = await admin('/auth/v1/admin/users?per_page=100', 'GET')
const leftover = (listed.users ?? []).find((u) => u.email === email)
if (leftover) await admin('/auth/v1/admin/users/' + leftover.id, 'DELETE')
const created = await admin('/auth/v1/admin/users', 'POST', {
  email, password, email_confirm: true, user_metadata: { full_name: 'Create Conflict E2E' },
})

const grant = await fetch(api + '/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: variables.ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
  signal: AbortSignal.timeout(15000),
})
const grantBody = await grant.json()
assert(grantBody.access_token, 'password grant failed')
const ownerToken = grantBody.access_token

async function restJson(path, init = {}) {
  const { headers: extraHeaders, ...restInit } = init
  const r = await fetch(api + path, {
    ...restInit,
    headers: {
      apikey: variables.ANON_KEY,
      Authorization: 'Bearer ' + ownerToken,
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  })
  const rawText = await r.text()
  let data = null
  try { data = rawText ? JSON.parse(rawText) : null } catch { data = rawText }
  return { status: r.status, ok: r.ok, data }
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
  console.log('PASS fresh account signed in and onboarding completed')

  // Step 1: project form (inputs must survive the later failed attempt).
  await page.getByLabel('프로젝트명').fill(TITLE)
  await page.getByLabel('서비스 설명').fill('최초 생성 충돌을 재현하는 A-02 검증용 서비스 설명입니다')
  await page.getByLabel('서비스 유형').selectOption('웹')
  await page.getByLabel('목표 사용자').fill('일반 사용자')
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByRole('button', { name: '바로 생성하기' }).waitFor({ state: 'visible', timeout: 20000 })
  console.log('PASS project wizard reached the interview step')

  // Hold the pipeline's first INSERT so a rival create lands first.
  let held = false
  await page.route('**/rest/v1/documents*', async (route) => {
    const request = route.request()
    if (request.method() === 'POST' && !held) {
      held = true
      await new Promise((resolve) => setTimeout(resolve, 4500))
    }
    await route.continue()
  })
  const WINNER_PREFIX = 'RACE-WINNER-A02-'

  await page.getByRole('button', { name: '바로 생성하기' }).click()
  await page.waitForTimeout(1500) // pipeline reached the delayed INSERT

  // The project now exists (the wizard created it before the pipeline).
  const projects = await restJson('/rest/v1/projects?select=id,title&title=eq.' + encodeURIComponent(TITLE))
  assert.equal(projects.data?.length, 1, 'wizard project must exist: ' + JSON.stringify(projects.data))
  const projectId = projects.data[0].id
  const winner = await restJson('/rest/v1/documents', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ project_id: projectId, type: 'prd', content: WINNER_PREFIX + projectId }),
  })
  assert(winner.ok, 'rival create failed: ' + JSON.stringify(winner.data))
  console.log('PASS rival session created the PRD first: ' + projectId)

  // The held INSERT now lands, hits 23505, and the failure is surfaced:
  // back on the interview step with an error toast, not a fake success.
  await page.getByText('생성에 실패했습니다', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  await page.getByRole('button', { name: '바로 생성하기' })
    .waitFor({ state: 'visible', timeout: 20000 })
  const surviving = await restJson('/rest/v1/documents?select=content&project_id=eq.' + projectId + '&type=eq.prd')
  assert.equal(surviving.data?.[0]?.content, WINNER_PREFIX + projectId, 'winner document must not be overwritten')
  console.log('PASS conflict surfaced to the user; winner document preserved; form is reusable')

  // The user's input survived: back on step 1 the title is still there.
  await page.getByRole('button', { name: '이전' }).click()
  assert.equal(await page.getByLabel('프로젝트명').inputValue(), TITLE, 'form input must survive the failed generation')
  await page.getByRole('button', { name: '다음' }).click()
  console.log('PASS user input preserved across the failed first create')

  // Explicit retry: existing documents now go through CAS and finish.
  await page.unroute('**/rest/v1/documents*')
  await page.getByRole('button', { name: '바로 생성하기' }).click()
  await page.waitForURL((u) => u.pathname === '/projects/' + projectId + '/prd', { timeout: 60000 })
  const finalDocs = await restJson('/rest/v1/documents?select=type,content,content_revision&project_id=eq.' + projectId)
  assert.equal(finalDocs.data?.length, 6, 'retry must generate all six documents: ' + JSON.stringify(finalDocs.data))
  const prd = finalDocs.data.find((d) => d.type === 'prd')
  assert.notEqual(prd.content, WINNER_PREFIX + projectId, 'retry must replace the winner through CAS')
  assert(prd.content_revision >= 1, 'retry must advance the revision through CAS')
  console.log('PASS explicit retry generated all six documents through CAS')

  console.log('SUCCESS first-create conflict browser E2E (signalled, input preserved, explicit retry)')
} finally {
  await browser?.close()
}
