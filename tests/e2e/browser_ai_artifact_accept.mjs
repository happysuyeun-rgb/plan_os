// F-C E2E: contract → Mock run → publish → accept → S1 task link persists.
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import {
  SITE,
  seedOwnerProjectDocs,
  loginDev,
  saveS2Manifest,
  acceptSpecialistContract,
} from './disposableSpecialistContractFixture.mjs'

const email = `browser-fc-${Date.now()}@example.test`
const password = 'Synthetic-fc-artifact-password-123!'
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'
const ARTIFACT_DIR = 'artifacts/fc-artifact-e2e'
mkdirSync(ARTIFACT_DIR, { recursive: true })

await seedOwnerProjectDocs({
  email,
  password,
  fullName: 'F-C Artifact E2E',
  projectId,
  projectTitle: 'F-C artifact E2E',
  docPrdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03',
  docPolicyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc03',
  prdContent: 'F-C E2E PRD content long enough',
  policyContent: 'F-C E2E Policy content long enough',
})

let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

  await loginDev(page, { email, password })
  await saveS2Manifest(page, { projectId })
  await acceptSpecialistContract(page, {
    projectId,
    task: '요구사항 검수 결과를 수락해 S1 업무로 연결합니다.',
    criteria: '수락 후 업무 링크가 보여야 함',
  })

  await page.getByTestId('mock-worker-run').click()
  await page.getByTestId('server-run-status').getByText('succeeded', { exact: false }).waitFor({
    state: 'visible',
    timeout: 30000,
  })
  await page.getByTestId('server-artifact-panel').waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-artifact-status').getByText('published', { exact: false }).waitFor({
    state: 'visible',
  })
  await page.getByTestId('server-artifact-events').getByText('published', { exact: false }).waitFor({
    state: 'visible',
  })
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-published.png`, fullPage: true })
  console.log('PASS report published as separate event')

  await page.getByTestId('artifact-accept').click()
  await page.getByTestId('server-artifact-status').getByText('accepted', { exact: false }).waitFor({
    state: 'visible',
    timeout: 25000,
  })
  await page.getByTestId('server-artifact-task').waitFor({ state: 'visible', timeout: 15000 })
  await page.getByTestId('server-artifact-events').getByText('accepted', { exact: false }).waitFor({
    state: 'visible',
  })
  const taskHref = await page.getByTestId('server-artifact-task').locator('a').getAttribute('href')
  assert(taskHref && taskHref.includes('/tasks/'), 'S1 task link missing: ' + taskHref)
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-accepted.png`, fullPage: true })
  console.log('PASS accept linked S1 task')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('server-artifact-status').getByText('accepted', { exact: false }).waitFor({
    state: 'visible',
    timeout: 25000,
  })
  await page.getByTestId('server-artifact-task').waitFor({ state: 'visible', timeout: 15000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/03-refresh.png`, fullPage: true })
  console.log('PASS refresh keeps accepted artifact + S1 link')

  await page.getByTestId('server-artifact-task').locator('a').click()
  await page.waitForURL((u) => u.pathname.includes('/tasks/'), { timeout: 30000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/04-s1-task.png`, fullPage: true })
  console.log('SUCCESS F-C artifact accept → S1 browser E2E at ' + SITE)
} finally {
  if (browser) await browser.close()
}
