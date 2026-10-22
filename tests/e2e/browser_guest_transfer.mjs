// Disposable browser E2E for the guest-plan transfer (A-01): a guest
// session seeded in sessionStorage is transferred after login, with one
// document POST forced to fail mid-transfer. The transfer must keep the
// guest data, stay resumable on the SAME project, and finish without
// duplicating the project or any of the six documents.
// Runs only against the disposable local Supabase + local Vite dev server.
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
const email = 'browser-guest-transfer@example.test'
const password = 'Synthetic-guest-transfer-password-123!'

const TYPES = ['prd', 'ia', 'screen_list', 'policy', 'wireframe', 'cursor_prompt']
const bodyOf = (type) => '# Guest ' + type + '\n\nGUEST-TRANSFER-BODY-' + type

async function admin(path, method, body) {
  const r = await fetch(api + path, {
    method,
    headers: {
      apikey: variables.SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + variables.SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  const result = await r.json()
  assert(r.ok, 'admin auth operation failed HTTP ' + r.status + ': ' + JSON.stringify(result))
  return result
}

// Remove a leftover account from an aborted earlier run (seed idempotency).
const listed = await admin('/auth/v1/admin/users?per_page=100', 'GET')
const leftover = (listed.users ?? []).find((u) => u.email === email)
if (leftover) await admin('/auth/v1/admin/users/' + leftover.id, 'DELETE')
const created = await admin('/auth/v1/admin/users', 'POST', {
  email, password, email_confirm: true, user_metadata: { full_name: 'Guest Transfer E2E' },
})
console.log('PASS fresh account for guest transfer E2E: ' + created.id)

const session = await fetch(api + '/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: variables.ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
  signal: AbortSignal.timeout(15000),
})
const sessionBody = await session.json()
assert(sessionBody.access_token, 'password login for REST checks failed')
const ownerToken = sessionBody.access_token

async function restGet(path) {
  const r = await fetch(api + '/rest/v1/' + path, {
    headers: { apikey: variables.ANON_KEY, Authorization: 'Bearer ' + ownerToken },
    signal: AbortSignal.timeout(15000),
  })
  assert(r.ok, 'REST check failed HTTP ' + r.status)
  return r.json()
}

let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

  await page.goto(site + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  // Seed the guest session exactly as the guest flow leaves it.
  await page.evaluate(({ types }) => {
    const results = {}
    for (const type of types) {
      results[type] = '# Guest ' + type + '\n\nGUEST-TRANSFER-BODY-' + type
    }
    sessionStorage.setItem('planos_guest_idea', '게스트 이전 E2E 아이디어')
    sessionStorage.setItem('planos_guest_interview', JSON.stringify({ q2: '일반 사용자', q3: '웹' }))
    sessionStorage.setItem('planos_guest_result', JSON.stringify(results))
  }, { types: TYPES })

  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)

  // Inject exactly one mid-transfer failure: abort the policy insert once.
  let policyAborted = false
  await page.route('**/rest/v1/documents*', async (route) => {
    const request = route.request()
    if (request.method() === 'POST' && !policyAborted) {
      const payload = JSON.parse(request.postData() ?? '{}')
      if (payload.type === 'policy') {
        policyAborted = true
        await route.abort()
        return
      }
    }
    await route.continue()
  })

  await page.getByRole('button', { name: '임시 로그인' }).click()
  await page.waitForURL((url) => url.pathname === '/onboarding', { timeout: 30000 })
  await page.getByRole('button', { name: '기획서 저장하고 시작하기' }).click()

  // The failed attempt must stay on onboarding, keep the guest data, and
  // tell the user the plan can be retried.
  await page.getByText('기획서 저장에 실패했습니다', { exact: false })
    .waitFor({ state: 'visible', timeout: 20000 })
  assert.equal(page.url().includes('/onboarding'), true, 'failed transfer must stay on onboarding')
  const guestSurvived = await page.evaluate(() => ({
    idea: sessionStorage.getItem('planos_guest_idea'),
    result: sessionStorage.getItem('planos_guest_result'),
    transferKey: Object.keys(sessionStorage).find((k) => k.startsWith('planos_guest_transfer_project_')),
  }))
  assert(guestSurvived.idea && guestSurvived.result, 'guest data must survive a failed transfer')
  assert(guestSurvived.transferKey, 'recorded project id must survive for the retry')
  console.log('PASS mid-transfer failure keeps guest data, recorded project, and retry path')

  // Retry with the network healthy: resumes on the same project.
  await page.unroute('**/rest/v1/documents*')
  await page.getByRole('button', { name: '기획서 저장하고 시작하기' }).click()
  await page.waitForURL((url) => /\/projects\/[0-9a-f-]{36}\/prd$/.test(url.pathname), { timeout: 30000 })
  const projectId = page.url().match(/\/projects\/([0-9a-f-]{36})\//)[1]
  await page.getByText('GUEST-TRANSFER-BODY-prd', { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 30000 })
  console.log('PASS retry transferred the plan and opened the PRD: ' + projectId)

  const transferKeyGone = await page.evaluate(
    () => !Object.keys(sessionStorage).some((k) => k.startsWith('planos_guest_')),
  )
  assert(transferKeyGone, 'guest session keys must be cleared after a completed transfer')

  const rows = await restGet('documents?select=type,content&project_id=eq.' + projectId)
  assert.equal(rows.length, 6, 'expected 6 transferred documents, got ' + rows.length)
  for (const row of rows) {
    assert.equal(row.content, bodyOf(row.type), 'document body mismatch for ' + row.type)
  }
  const projects = await restGet('projects?select=id&user_id=eq.' + created.id)
  assert.equal(projects.length, 1, 'retry must not duplicate the project')
  console.log('PASS retry created no duplicates: 6 documents under the single transfer project')

  console.log('SUCCESS guest transfer browser E2E (seeded guest session, forced failure, resume)')
} finally {
  await browser?.close()
}
