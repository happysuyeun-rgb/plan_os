// Disposable Chromium E2E for F-A: S2 manifest → server contract draft →
// owner consent accept → refresh persistence. No paid LLM / Mock worker yet.
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
const email = `browser-fa-${Date.now()}@example.test`
const password = 'Synthetic-fa-contract-password-123!'
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'
const ARTIFACT_DIR = 'artifacts/fa-contract-e2e'
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
  email, password, email_confirm: true, user_metadata: { full_name: 'F-A Contract E2E' },
})
assertUuid(created.id, 'user id')

const docPrd = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'
const docPolicy = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01'
runPsqlSeed([
  `delete from public.projects where id = '${assertUuid(projectId, 'project')}'`,
  `insert into public.projects(id,user_id,title) values ('${projectId}','${created.id}','F-A contract E2E')`,
  `insert into public.documents(id,project_id,type,content) values
    ('${assertUuid(docPrd, 'prd')}','${projectId}','prd','F-A E2E PRD content long enough'),
    ('${assertUuid(docPolicy, 'policy')}','${projectId}','policy','F-A E2E Policy content long enough')`,
])
console.log('PASS F-A account, project, and two documents seeded')

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

  // 1) Create S2 manifest (required for contract).
  await page.goto(site + '/projects/' + projectId + '/audits/new', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: '기획 검수 — 문서 선택' }).waitFor({ state: 'visible', timeout: 30000 })
  const boxes = page.getByRole('checkbox')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await page.getByRole('button', { name: '선택한 문서 사전 검증' }).click()
  await page.getByText('사전 검증 통과', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('button', { name: '서버 manifest 저장' }).click()
  await page.getByText('서버 manifest가 저장되었습니다', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  console.log('PASS S2 manifest saved for contract')

  // 2) Specialist request → local draft → server draft → accept.
  await page.goto(site + '/projects/' + projectId + '/specialists/request', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: '전문가에게 업무 요청하기' }).waitFor({ state: 'visible', timeout: 30000 })
  await page.getByTestId('contract-manifest-id').waitFor({ state: 'visible', timeout: 15000 })
  await page.locator('textarea').nth(0).fill('요구사항 문서 두 건의 누락과 불일치를 검수해 주세요.')
  await page.locator('textarea').nth(1).fill('누락 항목과 근거를 표로 정리')
  await page.getByRole('button', { name: '요청 초안 미리보기' }).click()
  await page.getByText('요청 초안 · 로컬 미리보기').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('label').filter({ hasText: /유료 LLM/ }).locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: '계약 조건 검토 후 서버 저장 준비' }).click()
  await page.getByTestId('contract-save-draft').click()
  await page.getByTestId('server-contract-panel').waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-contract-status').getByText('draft', { exact: false }).waitFor({ state: 'visible' })
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-draft-saved.png`, fullPage: true })
  console.log('PASS server contract draft created')

  await page.getByTestId('contract-consent-check').check()
  await page.getByTestId('contract-accept').click()
  await page.getByTestId('server-contract-status').getByText('active', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-contract-events').getByText('accepted', { exact: false }).waitFor({ state: 'visible' })
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-accepted.png`, fullPage: true })
  console.log('PASS owner accepted with explicit consent')

  const contractIdText = await page.getByTestId('server-contract-id').innerText()
  const contractId = contractIdText.match(/[0-9a-f-]{36}/i)?.[0]
  assert(contractId, 'contract id missing')

  // 3) Refresh persistence.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('server-contract-panel').waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-contract-status').getByText('active', { exact: false }).waitFor({ state: 'visible' })
  await page.getByText(contractId.slice(0, 8), { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/03-refresh.png`, fullPage: true })
  console.log('PASS refresh restores active server contract')

  // 4) REST confirms consent event (loopback only).
  const tokenRes = await fetch(loopbackUrl(api, '/auth/v1/token?grant_type=password'), {
    method: 'POST',
    headers: { apikey: variables.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  })
  const session = await tokenRes.json()
  assert(session.access_token, 'password grant failed')
  const eventsRes = await fetch(
    loopbackUrl(api, '/rest/v1/agent_contract_events?contract_id=eq.' + contractId + '&event_type=eq.accepted&select=comment'),
    {
      headers: {
        apikey: variables.ANON_KEY,
        Authorization: 'Bearer ' + session.access_token,
      },
      signal: AbortSignal.timeout(15000),
    },
  )
  const events = await eventsRes.json()
  assert(Array.isArray(events) && events.length === 1)
  assert.match(String(events[0].comment), /Mock 실행만 승인/)
  console.log('PASS consent event readable after refresh')

  console.log('SUCCESS F-A agent contract browser E2E (draft, accept, refresh)')
} finally {
  if (browser) await browser.close()
}
