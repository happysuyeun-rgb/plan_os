// F-B E2E: S2 manifest → contract accept → Mock worker → persisted run/usage.
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { loopbackUrl } from '../helpers/rest.mjs'
import {
  SITE,
  seedOwnerProjectDocs,
  loginDev,
  saveS2Manifest,
  acceptSpecialistContract,
  readLoopbackEnv,
} from './disposableSpecialistContractFixture.mjs'

const { api, variables } = readLoopbackEnv()
const email = `browser-fb-${Date.now()}@example.test`
const password = 'Synthetic-fb-run-password-123!'
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'
const ARTIFACT_DIR = 'artifacts/fb-run-e2e'
mkdirSync(ARTIFACT_DIR, { recursive: true })

await seedOwnerProjectDocs({
  email,
  password,
  fullName: 'F-B Run E2E',
  projectId,
  projectTitle: 'F-B run E2E',
  docPrdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02',
  docPolicyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
  prdContent: 'F-B E2E PRD content long enough',
  policyContent: 'F-B E2E Policy content long enough',
})

let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

  await loginDev(page, { email, password })
  await saveS2Manifest(page, { projectId })
  await acceptSpecialistContract(page, {
    projectId,
    task: '요구사항 문서 두 건을 Mock worker로 검수해 주세요.',
    criteria: '서버에 결과와 이력이 남아야 함',
  })

  await page.getByTestId('mock-worker-run').click()
  await page.getByTestId('server-run-panel').waitFor({ state: 'visible', timeout: 30000 })
  await page.getByTestId('server-run-status').getByText('succeeded', { exact: false }).waitFor({
    state: 'visible',
    timeout: 30000,
  })
  await page.getByTestId('server-run-usage').getByText('mock/', { exact: false }).waitFor({
    state: 'visible',
  })
  await page.getByTestId('server-run-result').getByText('paidLlmUsed', { exact: false }).waitFor({
    state: 'visible',
  })
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-succeeded.png`, fullPage: true })
  console.log('PASS Mock worker succeeded with usage')

  const runIdText = await page.getByTestId('server-run-id').innerText()
  const runId = runIdText.match(/[0-9a-f-]{36}/i)?.[0]
  assert(runId)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('server-run-panel').waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-run-status').getByText('succeeded', { exact: false }).waitFor({
    state: 'visible',
  })
  await page.getByText(runId.slice(0, 8), { exact: false }).first().waitFor({
    state: 'visible',
    timeout: 15000,
  })
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-refresh.png`, fullPage: true })
  console.log('PASS refresh restores succeeded run')

  const tokenRes = await fetch(loopbackUrl(api, '/auth/v1/token?grant_type=password'), {
    method: 'POST',
    headers: { apikey: variables.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  })
  const session = await tokenRes.json()
  const usageRes = await fetch(
    loopbackUrl(api, '/rest/v1/ai_usage_ledger?run_id=eq.' + runId + '&select=billing_kind,amount_minor'),
    {
      headers: { apikey: variables.ANON_KEY, Authorization: 'Bearer ' + session.access_token },
      signal: AbortSignal.timeout(15000),
    },
  )
  const usage = await usageRes.json()
  assert.equal(usage[0].billing_kind, 'mock')
  assert.equal(usage[0].amount_minor, 0)
  console.log('SUCCESS F-B Mock worker browser E2E at ' + SITE)
} finally {
  if (browser) await browser.close()
}
