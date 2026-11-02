// Shared disposable bootstrap for F-A/F-B/F-C specialist contract browser E2E.
import assert from 'node:assert/strict'
import { createAdminClient, assertUuid } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

export const SITE = 'http://127.0.0.1:5173'

export function readLoopbackEnv() {
  const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
  const variables = readLocalSupabaseEnv(localDir)
  const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
  assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')
  return { localDir, variables, api }
}

async function findUserByEmail(admin, targetEmail) {
  for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
    const listedPage = await admin(`/auth/v1/admin/users?page=${pageNumber}&per_page=100`, 'GET')
    const users = listedPage.users ?? []
    const found = users.find((u) => u.email === targetEmail)
    if (found) return found
    if (users.length < 100) return null
  }
  return null
}

export async function seedOwnerProjectDocs({
  email,
  password,
  fullName,
  projectId,
  projectTitle,
  docPrdId,
  docPolicyId,
  prdContent,
  policyContent,
}) {
  const { variables, api } = readLoopbackEnv()
  const admin = createAdminClient({ apiUrl: api, serviceKey: variables.SERVICE_ROLE_KEY })
  const leftover = await findUserByEmail(admin, email)
  if (leftover) await admin('/auth/v1/admin/users/' + leftover.id, 'DELETE')
  const created = await admin('/auth/v1/admin/users', 'POST', {
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  assertUuid(created.id, 'user id')
  runPsqlSeed([
    `delete from public.projects where id = '${assertUuid(projectId, 'project')}'`,
    `insert into public.projects(id,user_id,title) values ('${projectId}','${created.id}','${projectTitle.replace(/'/g, "''")}')`,
    `insert into public.documents(id,project_id,type,content) values
      ('${assertUuid(docPrdId, 'prd')}','${projectId}','prd','${prdContent.replace(/'/g, "''")}'),
      ('${assertUuid(docPolicyId, 'policy')}','${projectId}','policy','${policyContent.replace(/'/g, "''")}')`,
  ])
  return { admin, api, variables, userId: created.id }
}

export async function loginDev(page, { email, password, site = SITE }) {
  await page.goto(site + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.getByRole('button', { name: '임시 로그인' }).click()
  await page.waitForURL((u) => u.pathname === '/onboarding' || u.pathname === '/projects/new', {
    timeout: 30000,
  })
  if (page.url().includes('/onboarding')) {
    await page.getByRole('button', { name: '첫 프로젝트 시작하기' }).click()
    await page.waitForURL((u) => u.pathname === '/projects/new', { timeout: 30000 })
  }
}

export async function saveS2Manifest(page, { projectId, site = SITE }) {
  await page.goto(site + '/projects/' + projectId + '/audits/new', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: '기획 검수 — 문서 선택' }).waitFor({
    state: 'visible',
    timeout: 30000,
  })
  const boxes = page.getByRole('checkbox')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  await page.getByRole('button', { name: '선택한 문서 사전 검증' }).click()
  await page.getByText('사전 검증 통과', { exact: false }).waitFor({ state: 'visible', timeout: 25000 })
  await page.getByRole('button', { name: '서버 manifest 저장' }).click()
  await page.getByText('서버 manifest가 저장되었습니다', { exact: false }).waitFor({
    state: 'visible',
    timeout: 25000,
  })
}

export async function acceptSpecialistContract(page, { projectId, task, criteria, site = SITE }) {
  await page.goto(site + '/projects/' + projectId + '/specialists/request', {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('heading', { name: '전문가에게 업무 요청하기' }).waitFor({
    state: 'visible',
    timeout: 30000,
  })
  await page.locator('textarea').nth(0).fill(task)
  await page.locator('textarea').nth(1).fill(criteria)
  await page.getByRole('button', { name: '요청 초안 미리보기' }).click()
  await page.locator('label').filter({ hasText: /유료 LLM/ }).locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: '계약 조건 모의 검토' }).click()
  await page.getByTestId('contract-save-draft').click()
  await page.getByTestId('contract-consent-check').check()
  await page.getByTestId('contract-accept').click()
  await page
    .getByTestId('server-contract-status')
    .getByText('active', { exact: false })
    .waitFor({ state: 'visible', timeout: 25000 })
}
