/**
 * Playwright E2E: Mock AI review vertical slice on disposable local stack.
 * Requires PLANOS_LOCAL_SUPABASE_DIR + Vite on :5173 (see workflow).
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { assertUuid, createAdminClient } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(localDir, 'PLANOS_LOCAL_SUPABASE_DIR is required')
const variables = readLocalSupabaseEnv(localDir)
const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
const dbPort = process.env.PLANOS_LOCAL_DB_PORT ?? '54322'
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')
const site = 'http://127.0.0.1:5173'

const stamp = Date.now()
const ownerEmail = `ai-review-owner-${stamp}@example.test`
const editorEmail = `ai-review-editor-${stamp}@example.test`
const viewerEmail = `ai-review-viewer-${stamp}@example.test`
const outsiderEmail = `ai-review-out-${stamp}@example.test`
const password = 'Synthetic-ai-review-password-123!'
const projectId = randomUUID()
const otherProjectId = randomUUID()

function expand(sql, vars) {
  let out = sql
  for (const [key, value] of Object.entries(vars)) {
    if (key.endsWith('_email')) {
      out = out.replaceAll(`:'${key}'`, `'${String(value).replace(/'/g, "''")}'`)
    } else {
      assertUuid(value, key)
      out = out.replaceAll(`:'${key}'`, `'${value}'`)
    }
  }
  return out
}

const admin = createAdminClient({ apiUrl: api, serviceKey: variables.SERVICE_ROLE_KEY })
async function createUser(email, name) {
  const created = await admin('/auth/v1/admin/users', 'POST', {
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  assertUuid(created.id, email)
  return created.id
}

const ownerId = await createUser(ownerEmail, 'AI Review Owner')
const editorId = await createUser(editorEmail, 'AI Review Editor')
const viewerId = await createUser(viewerEmail, 'AI Review Viewer')
const outsiderId = await createUser(outsiderEmail, 'Outsider')

runPsqlSeed(
  expand(readFileSync('tests/e2e/seed_ai_review.sql', 'utf8'), {
    owner_id: ownerId,
    editor_id: editorId,
    viewer_id: viewerId,
    outsider_id: outsiderId,
    project_id: projectId,
    other_project_id: otherProjectId,
    editor_email: editorEmail,
    viewer_email: viewerEmail,
  }),
  { dbPort },
)
console.log('PASS seeded AI review project + members')

async function clearSession(page) {
  await page.context().clearCookies()
  await page.goto(site + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.evaluate(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    try { sessionStorage.clear() } catch { /* ignore */ }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('input[type=email]').waitFor({ state: 'visible', timeout: 15000 })
}

async function login(page, email) {
  await clearSession(page)
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.getByRole('button', { name: '임시 로그인' }).click()
  try {
    await page.waitForURL(
      (url) => url.pathname === '/dashboard' || url.pathname === '/onboarding',
      { timeout: 30000 },
    )
  } catch (err) {
    const body = await page.locator('body').innerText().catch(() => '')
    throw new Error(
      `login failed for ${email}; url=${page.url()}; body=${body.slice(0, 400)}; cause=${err}`,
    )
  }
  if (page.url().includes('/onboarding')) {
    // Seed should mark onboarding complete; if not, advance past the gate.
    const next = page.getByRole('button').filter({ hasText: /시작|완료|다음|건너/ }).first()
    if (await next.count()) await next.click()
    await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.startsWith('/projects'), {
      timeout: 30000,
    })
  }
}

let browser
const shotDir = 'artifacts/browser-qa'
mkdirSync(shotDir, { recursive: true })
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

  // --- Owner path: hire → run → accept → S1 → reload → re-review link ---
  await login(page, ownerEmail)
  await page.goto(site + `/projects/${projectId}/ai-review`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('ai-review-unpaid-preview').waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="ai-review-store-mode"]')
      return el && /owner|editor/i.test(el.textContent || '')
    },
    { timeout: 20000 },
  )
  const storeMode = await page.getByTestId('ai-review-store-mode').innerText()
  assert.match(storeMode, /SERVER_027|BROWSER_LOCAL|MEMORY/i)
  console.log('PASS unpaid preview banner; store mode visible:', storeMode.trim())

  await page.getByTestId('ai-review-hire').click()
  // AC-03 UX: fewer than 2 doc types blocks run
  for (const type of ['prd', 'policy', 'wireframe', 'ia', 'screen_list']) {
    const box = page.getByTestId(`ai-review-doc-${type}`)
    if (await box.count() && await box.isChecked()) await box.uncheck()
  }
  await page.getByTestId('ai-review-doc-prd').check()
  await page.getByTestId('ai-review-insufficient-block').waitFor({ state: 'visible', timeout: 5000 })
  assert.equal(await page.getByTestId('ai-review-run').isDisabled(), true)
  console.log('PASS AC-03 insufficient selection blocks run')

  await page.getByTestId('ai-review-doc-policy').check()
  await page.getByTestId('ai-review-doc-wireframe').check()
  assert.equal(await page.getByTestId('ai-review-run').isDisabled(), false)

  await page.getByTestId('ai-review-run').click()
  try {
    await page.getByTestId('ai-review-job').waitFor({ state: 'visible', timeout: 30000 })
  } catch (err) {
    const alert = await page.getByRole('alert').allInnerTexts().catch(() => [])
    const body = await page.locator('main').innerText().catch(() => '')
    throw new Error(
      `run did not produce ai-review-job; alerts=${JSON.stringify(alert)}; main=${body.slice(0, 600)}; cause=${err}`,
    )
  }
  await page.getByTestId('ai-review-source-manifest').waitFor({ state: 'visible', timeout: 10000 })
  const accept = page.locator('[data-testid^="ai-review-accept-"]').first()
  await accept.waitFor({ state: 'visible', timeout: 15000 })
  await accept.click()
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="ai-review-message"]')
      const t = el?.textContent || ''
      return /S1 업무|재사용|수락/.test(t)
    },
    { timeout: 30000 },
  ).catch(async (err) => {
    const alert = await page.getByRole('alert').allInnerTexts().catch(() => [])
    const msg = await page.getByTestId('ai-review-message').innerText().catch(() => '')
    throw new Error(`accept did not update message; alerts=${JSON.stringify(alert)}; msg=${msg}; cause=${err}`)
  })
  const msg = await page.getByTestId('ai-review-message').innerText()
  assert.match(msg, /S1 업무|재사용|수락/)
  console.log('PASS owner mock review accept → S1')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('ai-review-job').waitFor({ state: 'visible', timeout: 30000 })
  const afterReload = await page.getByTestId('ai-review-message').innerText().catch(() => '')
  assert.match(
    (await page.getByTestId('ai-review-job').innerText()) + afterReload,
    /accepted|재접속|job/i,
  )
  console.log('PASS review job survives browser reload')

  const rereview = page.getByTestId('ai-review-rereview')
  if (await rereview.count()) {
    await rereview.click()
    await page.getByTestId('ai-review-job').waitFor({ state: 'visible', timeout: 30000 })
    console.log('PASS re-review run after accept')
  }

  // --- Viewer: readonly ---
  await login(page, viewerEmail)
  await page.goto(site + `/projects/${projectId}/ai-review`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('ai-review-viewer-readonly').waitFor({ state: 'visible', timeout: 20000 })
  assert.equal(await page.getByTestId('ai-review-hire').isDisabled(), true)
  console.log('PASS viewer cannot hire/run')

  // --- Editor: can run (hire may already be disabled if owner left a stored job) ---
  await login(page, editorEmail)
  await page.goto(site + `/projects/${projectId}/ai-review`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="ai-review-store-mode"]')
      return el && /editor/i.test(el.textContent || '')
    },
    { timeout: 20000 },
  )
  const editorHire = page.getByTestId('ai-review-hire')
  await editorHire.waitFor({ state: 'visible', timeout: 15000 })
  if (await editorHire.isEnabled()) {
    await editorHire.click()
  }
  assert.equal(await editorHire.isDisabled(), true)
  assert.equal(await page.getByTestId('ai-review-run').isDisabled(), false)
  console.log('PASS editor can hire/run')

  // --- Cross-project: owner of A cannot open B as member ---
  await login(page, ownerEmail)
  await page.goto(site + `/projects/${otherProjectId}/ai-review`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const blocked = await page.getByRole('alert').count()
  const noJob = (await page.getByTestId('ai-review-job').count()) === 0
  assert.ok(blocked > 0 || noJob, 'cross-project AI review must not expose foreign jobs')
  console.log('PASS cross-project AI review access blocked')

  // --- Preview-compatible API contract on Vite BFF ---
  const apiRes = await page.request.post(site + '/api/ai/generate', {
    data: { documentType: 'prd', vars: { title: 'T', targetUser: 'U' }, allowPaidCalls: true },
  })
  assert.equal(apiRes.status(), 200)
  const body = await apiRes.json()
  assert.equal(body.mode, 'placeholder')
  assert.equal(body.runtime, 'vite-dev')
  assert.ok(body.providerId)
  console.log('PASS /api/ai/generate forces placeholder (paid flag ignored)')

  const bad = await page.request.post(site + '/api/ai/generate', { data: {} })
  assert.equal(bad.status(), 400)
  console.log('PASS /api/ai/generate 400 on missing body')

  console.log('SUCCESS browser_ai_review E2E')
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
}
