/**
 * Shared disposable-local setup for AI-review Playwright suites.
 * Loopback Supabase only — never hosted credentials.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { assertUuid, createAdminClient } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

export const DEFAULT_SITE = 'http://127.0.0.1:5173'
export const DEFAULT_AI_REVIEW_PASSWORD = 'Synthetic-ai-review-password-123!'

export function resolveDisposableEnv() {
  const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
  assert(localDir, 'PLANOS_LOCAL_SUPABASE_DIR is required')
  const variables = readLocalSupabaseEnv(localDir)
  const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
  const dbPort = process.env.PLANOS_LOCAL_DB_PORT ?? '54322'
  assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')
  const site = process.env.PLANOS_E2E_BASE || DEFAULT_SITE
  return { localDir, variables, api, dbPort, site }
}

export function expandSeedSql(sql, vars) {
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

/**
 * Create four Auth users + seed_ai_review.sql project/docs/members.
 * emailPrefix keeps suites isolated on the same disposable stack.
 */
export async function seedAiReviewFixture(options = {}) {
  const {
    emailPrefix = 'ai-review',
    password = DEFAULT_AI_REVIEW_PASSWORD,
    ownerName = 'AI Review Owner',
    editorName = 'AI Review Editor',
    viewerName = 'AI Review Viewer',
    outsiderName = 'Outsider',
  } = options

  const { variables, api, dbPort, site } = resolveDisposableEnv()
  const stamp = Date.now()
  const ownerEmail = `${emailPrefix}-owner-${stamp}@example.test`
  const editorEmail = `${emailPrefix}-editor-${stamp}@example.test`
  const viewerEmail = `${emailPrefix}-viewer-${stamp}@example.test`
  const outsiderEmail = `${emailPrefix}-out-${stamp}@example.test`
  const projectId = randomUUID()
  const otherProjectId = randomUUID()

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

  const ownerId = await createUser(ownerEmail, ownerName)
  const editorId = await createUser(editorEmail, editorName)
  const viewerId = await createUser(viewerEmail, viewerName)
  const outsiderId = await createUser(outsiderEmail, outsiderName)

  runPsqlSeed(
    expandSeedSql(readFileSync('tests/e2e/seed_ai_review.sql', 'utf8'), {
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

  return {
    site,
    api,
    dbPort,
    password,
    projectId,
    otherProjectId,
    ownerId,
    editorId,
    viewerId,
    outsiderId,
    ownerEmail,
    editorEmail,
    viewerEmail,
    outsiderEmail,
  }
}

/** Browser session helpers bound to fixture password + site. */
export function createLoginHelpers({ site, password }) {
  async function clearSession(page) {
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
      const next = page.getByRole('button').filter({ hasText: /시작|완료|다음|건너/ }).first()
      if (await next.count()) await next.click()
      await page.waitForURL(
        (url) => url.pathname === '/dashboard' || url.pathname.startsWith('/projects'),
        { timeout: 30000 },
      )
    }
  }

  return { clearSession, login }
}
