// Disposable Chromium E2E for S2 F-201/F-202: select docs → server manifest →
// pre-run assert → stale after edit → rebuild → PASS. Mock AI review only.
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
const email = `browser-s2-${Date.now()}@example.test`
const password = 'Synthetic-s2-manifest-password-123!'
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ARTIFACT_DIR = 'artifacts/s2-manifest-e2e'
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
  email, password, email_confirm: true, user_metadata: { full_name: 'S2 Manifest E2E' },
})
assertUuid(created.id, 'user id')

const docPrd = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const docPolicy = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
runPsqlSeed([
  `delete from public.projects where id = '${assertUuid(projectId, 'project')}'`,
  `insert into public.projects(id,user_id,title) values ('${projectId}','${created.id}','S2 manifest E2E')`,
  `insert into public.documents(id,project_id,type,content) values
    ('${assertUuid(docPrd, 'prd')}','${projectId}','prd','S2 E2E PRD content long enough'),
    ('${assertUuid(docPolicy, 'policy')}','${projectId}','policy','S2 E2E Policy content long enough')`,
])
console.log('PASS S2 account, project, and two documents seeded')

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

async function rpcAssert(token, manifestId) {
  const response = await fetch(loopbackUrl(api, '/rest/v1/rpc/assert_audit_source_manifest_current'), {
    method: 'POST',
    headers: {
      apikey: variables.ANON_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_id: manifestId }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

  await page.goto(site + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.getByRole('button', { name: '임시 로그인' }).click()
  await page.waitForURL((u) => u.pathname === '/onboarding' || u.pathname === '/projects/new', { timeout: 30000 })
  if (page.url().includes('/onboarding')) {
    await page.getByRole('button', { name: '첫 프로젝트 시작하기' }).click()
    await page.waitForURL((u) => u.pathname === '/projects/new', { timeout: 30000 })
  }

  await page.goto(site + '/projects/' + projectId + '/audits/new', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: '기획 검수 — 문서 선택' }).waitFor({ state: 'visible', timeout: 30000 })
  const boxes = page.getByRole('checkbox')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await page.getByRole('button', { name: '선택한 문서 사전 검증' }).click()
  await page.getByText('사전 검증 통과', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('button', { name: '서버 manifest 저장' }).click()
  await page.getByText('서버 manifest가 저장되었습니다', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  const manifestText = await page.getByText('스냅샷 ID:', { exact: false }).innerText()
  const manifestId = manifestText.match(/[0-9a-f-]{36}/i)?.[0]
  assert(manifestId, 'manifest id missing in UI: ' + manifestText)
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-manifest-saved.png`, fullPage: true })
  console.log('PASS UI created server manifest: ' + manifestId)

  const token = await ownerToken()
  const fresh = await rpcAssert(token, manifestId)
  assert(fresh.ok, 'fresh assert must PASS: ' + JSON.stringify(fresh.data))
  console.log('PASS same docs/version execution gate')

  // Reload persistence of stored manifest id.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByText(manifestId.slice(0, 8), { exact: false }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  console.log('PASS refresh restores saved manifest session')

  // Stale after document edit.
  runPsqlSeed([
    `update public.documents set content = content || ' [browser stale]', updated_at = now() where id = '${docPrd}'`,
  ])
  const stale = await rpcAssert(token, manifestId)
  assert(!stale.ok && (stale.data?.code === 'P4001' || String(stale.data?.message ?? '').includes('STALE')),
    'stale must 409/P4001: ' + JSON.stringify(stale.data))
  console.log('PASS post-edit assert blocked (stale)')

  await page.getByRole('button', { name: '실행 직전 재검증 후 Mock 검수' }).click()
  await page.getByRole('alert').filter({ hasText: /변경|찾을 수 없|재선택|갱신/ }).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-stale-blocked.png`, fullPage: true })
  console.log('PASS UI surfaces stale recovery guidance')

  // Recovery: reselect + new manifest + gate + navigate to AI review.
  await page.getByRole('button', { name: '문서 다시 선택' }).click()
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await page.getByRole('button', { name: '선택한 문서 사전 검증' }).click()
  await page.getByText('사전 검증 통과', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('button', { name: '서버 manifest 저장' }).click()
  await page.getByText('서버 manifest가 저장되었습니다', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('button', { name: '실행 직전 재검증 후 Mock 검수' }).click()
  await page.waitForURL((u) => u.pathname.includes('/ai-review') && u.search.includes('manifest='), { timeout: 30000 })
  await page.getByText('S2 digest', { exact: false }).or(page.getByText('S2 manifest', { exact: false })).first()
    .waitFor({ state: 'visible', timeout: 25000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/03-recovered-ai-review.png`, fullPage: true })
  console.log('PASS recovery remanifest + gated handoff to Mock AI review')

  console.log('SUCCESS S2 manifest browser E2E (create, stale 409, recover, refresh)')
} finally {
  await browser?.close()
}
