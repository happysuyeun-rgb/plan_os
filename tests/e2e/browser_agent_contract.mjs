// Disposable Chromium E2E for F-A: S2 manifest → server contract draft →
// owner consent accept → refresh persistence. No paid LLM / Mock worker yet.
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { loopbackUrl } from '../helpers/rest.mjs'
import {
  SITE,
  seedOwnerProjectDocs,
  loginDev,
  saveS2Manifest,
  readLoopbackEnv,
} from './disposableSpecialistContractFixture.mjs'

const { api, variables } = readLoopbackEnv()
const email = `browser-fa-${Date.now()}@example.test`
const password = 'Synthetic-fa-contract-password-123!'
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'
const ARTIFACT_DIR = 'artifacts/fa-contract-e2e'
mkdirSync(ARTIFACT_DIR, { recursive: true })

await seedOwnerProjectDocs({
  email,
  password,
  fullName: 'F-A Contract E2E',
  projectId,
  projectTitle: 'F-A contract E2E',
  docPrdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01',
  docPolicyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
  prdContent: 'F-A E2E PRD content long enough',
  policyContent: 'F-A E2E Policy content long enough',
})
console.log('PASS F-A account, project, and two documents seeded')

let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

  await loginDev(page, { email, password })
  await saveS2Manifest(page, { projectId })
  console.log('PASS S2 manifest saved for contract')

  await page.goto(SITE + '/projects/' + projectId + '/specialists/request', {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('heading', { name: '전문가에게 업무 요청하기' }).waitFor({
    state: 'visible',
    timeout: 30000,
  })
  await page.getByTestId('contract-manifest-id').waitFor({ state: 'visible', timeout: 15000 })
  await page.locator('textarea').nth(0).fill('요구사항 문서 두 건의 누락과 불일치를 검수해 주세요.')
  await page.locator('textarea').nth(1).fill('누락 항목과 근거를 표로 정리')
  await page.getByRole('button', { name: '요청 초안 미리보기' }).click()
  await page.getByText('요청 초안 생성됨').waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('label').filter({ hasText: /유료 LLM/ }).locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: '계약 조건 모의 검토' }).click()
  await page.getByTestId('contract-save-draft').click()
  await page.getByTestId('server-contract-panel').waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-contract-status').getByText('draft', { exact: false }).waitFor({
    state: 'visible',
  })
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-draft-saved.png`, fullPage: true })
  console.log('PASS server contract draft created')

  await page.getByTestId('contract-consent-check').check()
  await page.getByTestId('contract-accept').click()
  await page.getByTestId('server-contract-status').getByText('active', { exact: false }).waitFor({
    state: 'visible',
    timeout: 25000,
  })
  await page.getByTestId('server-contract-events').getByText('accepted', { exact: false }).waitFor({
    state: 'visible',
  })
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-accepted.png`, fullPage: true })
  console.log('PASS owner accepted with explicit consent')

  const contractIdText = await page.getByTestId('server-contract-id').innerText()
  const contractId = contractIdText.match(/[0-9a-f-]{36}/i)?.[0]
  assert(contractId, 'contract id missing')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('server-contract-panel').waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-contract-status').getByText('active', { exact: false }).waitFor({
    state: 'visible',
  })
  await page.getByText(contractId.slice(0, 8), { exact: false }).first().waitFor({
    state: 'visible',
    timeout: 15000,
  })
  await page.screenshot({ path: `${ARTIFACT_DIR}/03-refresh.png`, fullPage: true })
  console.log('PASS refresh restores active server contract')

  const tokenRes = await fetch(loopbackUrl(api, '/auth/v1/token?grant_type=password'), {
    method: 'POST',
    headers: { apikey: variables.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  })
  const session = await tokenRes.json()
  assert(session.access_token, 'password grant failed')
  const eventsRes = await fetch(
    loopbackUrl(
      api,
      '/rest/v1/agent_contract_events?contract_id=eq.' +
        contractId +
        '&event_type=eq.accepted&select=comment',
    ),
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
