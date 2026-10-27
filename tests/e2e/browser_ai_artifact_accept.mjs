// F-C E2E: contract → Mock run → publish → accept → S1 task link persists.
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { createAdminClient, assertUuid } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
const variables = readLocalSupabaseEnv(localDir)
const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')
const site = 'http://127.0.0.1:5173'
const email = `browser-fc-${Date.now()}@example.test`
const password = 'Synthetic-fc-artifact-password-123!'
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'
const ARTIFACT_DIR = 'artifacts/fc-artifact-e2e'
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
  email, password, email_confirm: true, user_metadata: { full_name: 'F-C Artifact E2E' },
})
assertUuid(created.id, 'user id')

const docPrd = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03'
const docPolicy = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03'
runPsqlSeed([
  `delete from public.projects where id = '${assertUuid(projectId, 'project')}'`,
  `insert into public.projects(id,user_id,title) values ('${projectId}','${created.id}','F-C artifact E2E')`,
  `insert into public.documents(id,project_id,type,content) values
    ('${assertUuid(docPrd, 'prd')}','${projectId}','prd','F-C E2E PRD content long enough'),
    ('${assertUuid(docPolicy, 'policy')}','${projectId}','policy','F-C E2E Policy content long enough')`,
])

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

  await page.goto(site + '/projects/' + projectId + '/specialists/request', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: '전문가에게 업무 요청하기' }).waitFor({ state: 'visible', timeout: 30000 })
  await page.locator('textarea').nth(0).fill('요구사항 검수 결과를 수락해 S1 업무로 연결합니다.')
  await page.locator('textarea').nth(1).fill('수락 후 업무 링크가 보여야 함')
  await page.getByRole('button', { name: '요청 초안 미리보기' }).click()
  await page.locator('label').filter({ hasText: /유료 LLM/ }).locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: '계약 조건 모의 검토' }).click()
  await page.getByTestId('contract-save-draft').click()
  await page.getByTestId('contract-consent-check').check()
  await page.getByTestId('contract-accept').click()
  await page.getByTestId('server-contract-status').getByText('active', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })

  await page.getByTestId('mock-worker-run').click()
  await page.getByTestId('server-run-status').getByText('succeeded', { exact: false }).waitFor({ state: 'visible', timeout: 30000 })
  await page.getByTestId('server-artifact-panel').waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-artifact-status').getByText('published', { exact: false }).waitFor({ state: 'visible' })
  await page.getByTestId('server-artifact-events').getByText('published', { exact: false }).waitFor({ state: 'visible' })
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-published.png`, fullPage: true })
  console.log('PASS report published as separate event')

  await page.getByTestId('artifact-accept').click()
  await page.getByTestId('server-artifact-status').getByText('accepted', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-artifact-task').waitFor({ state: 'visible', timeout: 15000 })
  await page.getByTestId('server-artifact-events').getByText('accepted', { exact: false }).waitFor({ state: 'visible' })
  const taskHref = await page.getByTestId('server-artifact-task').locator('a').getAttribute('href')
  assert(taskHref && taskHref.includes('/tasks/'), 'S1 task link missing: ' + taskHref)
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-accepted.png`, fullPage: true })
  console.log('PASS accept linked S1 task')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('server-artifact-status').getByText('accepted', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-artifact-task').waitFor({ state: 'visible', timeout: 15000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/03-refresh.png`, fullPage: true })
  console.log('PASS refresh keeps accepted artifact + S1 link')

  await page.getByTestId('server-artifact-task').locator('a').click()
  await page.waitForURL((u) => u.pathname.includes('/tasks/'), { timeout: 30000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/04-s1-task.png`, fullPage: true })
  console.log('SUCCESS F-C artifact accept → S1 browser E2E')
} finally {
  if (browser) await browser.close()
}
