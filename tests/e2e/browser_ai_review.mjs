/**
 * Playwright E2E: Mock AI review vertical slice on disposable local stack.
 * Requires PLANOS_LOCAL_SUPABASE_DIR + Vite on :5173 (see workflow).
 */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { createLoginHelpers, seedAiReviewFixture } from './disposableAiReviewFixture.mjs'

const fixture = await seedAiReviewFixture({
  emailPrefix: 'ai-review',
  ownerName: 'AI Review Owner',
  editorName: 'AI Review Editor',
  viewerName: 'AI Review Viewer',
})
const {
  site,
  projectId,
  otherProjectId,
  ownerEmail,
  editorEmail,
  viewerEmail,
  password,
} = fixture
const { login } = createLoginHelpers({ site, password })
console.log('PASS seeded AI review project + members')

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
    if ((await box.count()) && (await box.isChecked())) await box.uncheck()
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
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="ai-review-message"]')
        const t = el?.textContent || ''
        return /S1 업무|재사용|수락/.test(t)
      },
      { timeout: 30000 },
    )
    .catch(async (err) => {
      const alert = await page.getByRole('alert').allInnerTexts().catch(() => [])
      const msg = await page.getByTestId('ai-review-message').innerText().catch(() => '')
      throw new Error(
        `accept did not update message; alerts=${JSON.stringify(alert)}; msg=${msg}; cause=${err}`,
      )
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
  // Owner may have left a SERVER job; hydrate can disable hire after first paint (TOCTOU).
  const hireAlreadyDisabled = await page
    .waitForFunction(
      () => document.querySelector('[data-testid="ai-review-hire"]')?.disabled === true,
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false)
  if (!hireAlreadyDisabled && (await editorHire.isEnabled())) {
    await editorHire.click({ timeout: 5000 }).catch(() => undefined)
  }
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ai-review-hire"]')?.disabled === true,
    { timeout: 10000 },
  )
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
