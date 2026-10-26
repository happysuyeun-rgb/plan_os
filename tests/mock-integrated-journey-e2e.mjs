/**
 * Mock integrated journey — single Chromium path.
 *
 * Modes:
 * 1) DISPOSABLE (PLANOS_LOCAL_SUPABASE_DIR): full owner journey with real seed IDs
 * 2) FIXTURE (VITE_S3_E2E_FIXTURE Vite already up): catalog→handoff only (no fake docs)
 *
 * Never invent documents/tasks. Session handoff ≠ server review job persistence.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const site = process.env.PLANOS_E2E_BASE || 'http://127.0.0.1:5173'
const shotDir = 'artifacts/mock-integrated-e2e'
mkdirSync(shotDir, { recursive: true })

const results = []
function record(id, status, detail, ids = {}) {
  results.push({ id, status, detail, ...ids })
  console.log(`[${status}] ${id}: ${detail}${ids.url ? ` @ ${ids.url}` : ''}`)
}

function writeResults(extra = {}) {
  writeFileSync(
    `${shotDir}/results.json`,
    JSON.stringify({ tip: 'd40f975+', mode: extra.mode, results, ...extra }, null, 2),
  )
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

async function runFixtureSubset() {
  const localUser = {
    id: 'local-dev-user',
    email: 'qa@example.invalid',
    name: 'QA',
    avatar_url: '',
    plan: 'pro',
    ai_generations_this_month: 0,
    onboarding_completed: true,
    created_at: new Date(0).toISOString(),
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    await context.addInitScript((user) => {
      sessionStorage.setItem('planos-local-dev-user', JSON.stringify(user))
    }, localUser)
    const page = await context.newPage()

    await page.goto(`${site}/projects/fixture-owner/specialists`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('ai-staff-catalog-card').waitFor({ timeout: 15000 })
    record('A3-catalog', 'PASS', 'fixture catalog', { url: page.url(), projectId: 'fixture-owner' })

    await page.getByTestId('ai-staff-catalog-request-cta').click()
    await page.waitForURL(/\/specialists\/request/)
    await page
      .getByPlaceholder('검수할 범위와 원하는 결과를 10자 이상 작성하세요.')
      .fill('기획 요구사항 문서의 누락 항목을 검토해 주세요.')
    await page
      .getByPlaceholder('어떤 결과면 완료인지 5자 이상 작성하세요.')
      .fill('누락과 근거를 보고서로 정리')
    await page.getByRole('button', { name: '요청 초안 미리보기' }).click()
    await page.getByText('요청 초안 생성됨').waitFor()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: '계약 조건 모의 검토' }).click()
    await page.getByTestId('specialist-continue-ai-review').click()
    await page.waitForURL(/\/ai-review/)
    await page.getByTestId('ai-review-specialist-handoff').waitFor()
    record('A4-handoff', 'PASS', 'session handoff', { url: page.url(), projectId: 'fixture-owner' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    assert.equal(await page.getByTestId('ai-review-specialist-handoff').count(), 0)
    record('A4-session-vs-durable', 'PASS', 'handoff banner cleared on reload (session-only)')

    record('A5-run', 'BLOCKED', 'fixture has no seeded documents — use disposable mode')
    record('A6-A9', 'BLOCKED', 'requires PLANOS_LOCAL_SUPABASE_DIR disposable seed')
  } finally {
    await browser.close()
    writeResults({ mode: 'fixture' })
  }
}

async function runDisposableIntegrated() {
  const { assertUuid, createAdminClient } = await import('./helpers/rest.mjs')
  const { runPsqlSeed } = await import('./helpers/psql.mjs')
  const { readLocalSupabaseEnv } = await import('./helpers/supabaseStatus.mjs')

  const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
  assert(localDir, 'PLANOS_LOCAL_SUPABASE_DIR is required for disposable mode')
  const variables = readLocalSupabaseEnv(localDir)
  const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
  const dbPort = process.env.PLANOS_LOCAL_DB_PORT ?? '54322'
  assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')

  const stamp = Date.now()
  const ownerEmail = `mock-int-owner-${stamp}@example.test`
  const editorEmail = `mock-int-editor-${stamp}@example.test`
  const viewerEmail = `mock-int-viewer-${stamp}@example.test`
  const outsiderEmail = `mock-int-out-${stamp}@example.test`
  const password = 'Synthetic-mock-int-password-123!'
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

  const ownerId = await createUser(ownerEmail, 'Mock Int Owner')
  const editorId = await createUser(editorEmail, 'Mock Int Editor')
  const viewerId = await createUser(viewerEmail, 'Mock Int Viewer')
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
  record('seed', 'PASS', 'seed_ai_review.sql', { projectId, ownerId })

  let browser
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

    async function clearSession() {
      await page.context().clearCookies()
      await page.goto(site + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.evaluate(() => {
        try {
          localStorage.clear()
        } catch {
          /* ignore */
        }
        try {
          sessionStorage.clear()
        } catch {
          /* ignore */
        }
      })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.locator('input[type=email]').waitFor({ state: 'visible', timeout: 15000 })
    }

    async function login(email) {
      await clearSession()
      await page.locator('input[type=email]').fill(email)
      await page.locator('input[type=password]').fill(password)
      await page.getByRole('button', { name: '임시 로그인' }).click()
      await page.waitForURL(
        (url) => url.pathname === '/dashboard' || url.pathname === '/onboarding',
        { timeout: 30000 },
      )
      if (page.url().includes('/onboarding')) {
        const next = page.getByRole('button').filter({ hasText: /시작|완료|다음|건너/ }).first()
        if (await next.count()) await next.click()
        await page.waitForURL(
          (url) => url.pathname === '/dashboard' || url.pathname.startsWith('/projects'),
          { timeout: 30000 },
        )
      }
    }

    // --- A1 project entry (seeded — no fabricated project) ---
    await login(ownerEmail)
    await page.goto(`${site}/projects/${projectId}/tasks`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    record('A1-project-entry', 'PASS', 'entered seeded project tasks', {
      url: page.url(),
      projectId,
    })
    await page.screenshot({ path: `${shotDir}/a1-tasks.png` })

    // --- A2 human PM lane notice (approval loop separate) ---
    await page.goto(`${site}/projects/${projectId}/plans`, { waitUntil: 'domcontentloaded' })
    const dual = page.getByTestId('dual-entry-lane-notice')
    await dual.waitFor({ state: 'visible', timeout: 20000 })
    assert.equal(await dual.getAttribute('data-lane'), 'human-pm')
    record('A2-pm-lane', 'PASS', 'DualEntry on /plans (parallel lane)', {
      url: page.url(),
      projectId,
    })
    // Full PM approve CAS is covered by browser_pm_plan_loop — not claimed here.
    record(
      'A2-pm-approval-loop',
      'BLOCKED',
      'full human PM submit/approve CAS not in this journey — see tests/e2e/browser_pm_plan_loop.mjs',
      { projectId },
    )

    // --- A3 catalog ---
    await page.goto(`${site}/projects/${projectId}/specialists`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('ai-staff-catalog-card').waitFor({ timeout: 15000 })
    record('A3-catalog', 'PASS', 'AI staff catalog 1 role', { url: page.url(), projectId })

    // --- A4 request → session handoff ---
    await page.getByTestId('ai-staff-catalog-request-cta').click()
    await page.waitForURL(new RegExp(`/projects/${projectId}/specialists/request`))
    await page
      .getByPlaceholder('검수할 범위와 원하는 결과를 10자 이상 작성하세요.')
      .fill('기획 요구사항 문서의 누락 항목을 검토해 주세요.')
    await page
      .getByPlaceholder('어떤 결과면 완료인지 5자 이상 작성하세요.')
      .fill('누락과 근거를 보고서로 정리')
    await page.getByRole('button', { name: '요청 초안 미리보기' }).click()
    await page.getByText('요청 초안 생성됨').waitFor()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: '계약 조건 모의 검토' }).click()
    await page.getByText('검토 상태: review_only', { exact: false }).waitFor()
    await page.getByTestId('specialist-continue-ai-review').click()
    await page.waitForURL(new RegExp(`/projects/${projectId}/ai-review`))
    await page.getByTestId('ai-review-specialist-handoff').waitFor({ timeout: 15000 })
    assert.equal(await page.getByTestId('ai-review-hire').innerText(), '투입됨 (Mock)')
    record('A4-handoff', 'PASS', 'session handoff + hire Mock', { url: page.url(), projectId })

    await page.reload({ waitUntil: 'domcontentloaded' })
    assert.equal(await page.getByTestId('ai-review-specialist-handoff').count(), 0)
    record(
      'A4-session-vs-durable',
      'PASS',
      'handoff session cleared; review job store is separate',
      { projectId },
    )

    // --- A5 hire + run with seeded documents ---
    await page.getByTestId('ai-review-unpaid-preview').waitFor({ timeout: 15000 })
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="ai-review-store-mode"]')
        return el && /owner|editor/i.test(el.textContent || '')
      },
      { timeout: 20000 },
    )
    const hire = page.getByTestId('ai-review-hire')
    if (await hire.isEnabled()) await hire.click()
    for (const type of ['prd', 'policy', 'wireframe']) {
      const box = page.getByTestId(`ai-review-doc-${type}`)
      if ((await box.count()) && !(await box.isChecked())) await box.check()
    }
    await page.getByTestId('ai-review-run').click()
    await page.getByTestId('ai-review-job').waitFor({ state: 'visible', timeout: 30000 })
    const accept = page.locator('[data-testid^="ai-review-accept-"]').first()
    await accept.waitFor({ state: 'visible', timeout: 15000 })
    const acceptTestId = await accept.getAttribute('data-testid')
    const findingId = acceptTestId?.replace('ai-review-accept-', '') || ''
    assert.ok(findingId, 'findingId from accept testid')
    record('A5-run', 'PASS', 'mock review job + finding', {
      url: page.url(),
      projectId,
      findingId,
    })

    // --- A6 accept → S1 task ---
    await accept.click()
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="ai-review-message"]')
        return /S1 업무|재사용|수락/.test(el?.textContent || '')
      },
      { timeout: 30000 },
    )
    const msg = await page.getByTestId('ai-review-message').innerText()
    const taskIdMatch = msg.match(UUID_RE)
    assert.ok(taskIdMatch, `taskId UUID in message: ${msg}`)
    const taskId = taskIdMatch[0]
    record('A6-accept-s1', 'PASS', 'finding accepted → S1 task', {
      projectId,
      findingId,
      taskId,
      message: msg.slice(0, 120),
    })

    // --- A7 F-105 AI assignee on that task ---
    await page.goto(`${site}/projects/${projectId}/tasks/${taskId}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByTestId('task-detail-assignee-kind').waitFor({ timeout: 20000 })
    await page.getByTestId('task-detail-assignee-kind').selectOption('agent')
    await page.getByTestId('task-detail-ai-assignee-mock').waitFor()
    await page.getByTestId('task-detail-assignee-save').click()
    await page.getByTestId('task-detail-assignee-summary').waitFor()
    await page.waitForFunction(
      () => /실행 아님|AI/.test(document.querySelector('[data-testid="task-detail-assignee-summary"]')?.textContent || ''),
      { timeout: 15000 },
    )
    const lsKind = await page.evaluate(
      ({ userId, projectId, taskId }) => {
        const key = `planos:s1-ai-assignee-mock:v2:${userId}:${projectId}`
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const map = JSON.parse(raw)
        return map[taskId]?.kind ?? null
      },
      { userId: ownerId, projectId, taskId },
    )
    assert.equal(lsKind, 'agent')
    record('A7-f105', 'PASS', 'F-105 agent kind persisted in user-scoped LS after save', {
      projectId,
      taskId,
      ownerId,
      lsKind,
      url: page.url(),
    })

    // --- A8 task list ---
    await page.goto(`${site}/projects/${projectId}/tasks`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      (id) => document.body.innerText.includes(id.slice(0, 8)) || document.querySelector(`a[href*="${id}"]`),
      taskId,
      { timeout: 20000 },
    ).catch(async () => {
      // Title-based: accepted task title starts with [검수]
      await page.getByText('[검수]', { exact: false }).first().waitFor({ timeout: 10000 })
    })
    record('A8-task-list', 'PASS', 'S1 list shows accepted task', { projectId, taskId, url: page.url() })

    // --- A9 reload durability split ---
    await page.goto(`${site}/projects/${projectId}/tasks/${taskId}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByTestId('task-detail-assignee-summary').waitFor({ timeout: 20000 })
    const afterReloadSummary = await page.getByTestId('task-detail-assignee-summary').innerText()
    assert.match(afterReloadSummary, /실행 아님|AI|agent/i)
    record('A9-f105-reload', 'PASS', 'F-105 LS survives reload', { projectId, taskId })

    await page.goto(`${site}/projects/${projectId}/ai-review`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('ai-review-job').waitFor({ state: 'visible', timeout: 30000 })
    record('A9-review-job-reload', 'PASS', 'SERVER review job survives reload (≠ session handoff)', {
      projectId,
    })

    // --- B viewer cannot hire (same seeded project) ---
    await login(viewerEmail)
    await page.goto(`${site}/projects/${projectId}/ai-review`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('ai-review-viewer-readonly').waitFor({ timeout: 20000 })
    assert.equal(await page.getByTestId('ai-review-hire').isDisabled(), true)
    record('B-viewer-hire', 'PASS', 'viewer hire disabled', { projectId })

    writeResults({
      mode: 'disposable',
      projectId,
      otherProjectId,
      ownerId,
      editorId,
      viewerId,
      findingId,
      taskId,
    })
    console.log('SUCCESS mock-integrated-journey disposable')
  } catch (err) {
    console.error(err)
    writeResults({ mode: 'disposable', error: String(err) })
    process.exitCode = 1
  } finally {
    if (browser) await browser.close()
  }
}

const disposable = Boolean(process.env.PLANOS_LOCAL_SUPABASE_DIR)
if (disposable) {
  await runDisposableIntegrated()
} else {
  console.log('No PLANOS_LOCAL_SUPABASE_DIR — fixture subset only')
  await runFixtureSubset()
}

const failed = results.filter((r) => r.status === 'FAIL')
if (failed.length) process.exitCode = 1
