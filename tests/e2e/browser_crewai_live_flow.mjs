/**
 * Browser UI live flow: S2 → contract accept → CrewAI enqueue → worker poll
 * → refresh → publish artifact → accept → reload persistence.
 * Disposable local Supabase only. Never process_mock_ai_run.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import {
  acceptSpecialistContract,
  loginDev,
  readLoopbackEnv,
  saveS2Manifest,
  seedOwnerProjectDocs,
  SITE,
} from './disposableSpecialistContractFixture.mjs'

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
const ARTIFACT_DIR = 'artifacts/crewai-live-browser'
mkdirSync(ARTIFACT_DIR, { recursive: true })

if (process.env.PLANOS_LOCAL_STATUS_FILE && existsSync(process.env.PLANOS_LOCAL_STATUS_FILE)) {
  process.env.PLANOS_LOCAL_STATUS_ENV = readFileSync(
    process.env.PLANOS_LOCAL_STATUS_FILE,
    'utf8',
  ).replace(/\r/g, '')
}

const { api, variables } = readLoopbackEnv()
const envFile = path.join(root, 'workers', 'crewai', '.env')
assert(existsSync(envFile), 'workers/crewai/.env required')
const envText = readFileSync(envFile, 'utf8')
assert(/LINER_API_KEY=\S+/.test(envText), 'LINER_API_KEY required')

const stamp = Date.now()
const email = `browser-crewai-${stamp}@example.test`
const password = 'Synthetic-crewai-browser-password-123!'
const projectId = randomUUID()
const docPrdId = randomUUID()
const docPolicyId = randomUUID()

await seedOwnerProjectDocs({
  email,
  password,
  fullName: 'CrewAI Browser Owner',
  projectId,
  projectTitle: 'CrewAI Browser Live',
  docPrdId,
  docPolicyId,
  prdContent: '사용자는 로그인 후 대시보드에 진입한다. 결제 흐름은 없다.',
  policyContent: '개인정보 보관 기간은 1년이다.',
})

function loadWorkerEnv() {
  const workerEnv = { ...process.env }
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    workerEnv[match[1]] = value
  }
  workerEnv.PLANOS_LOCAL_API_URL = api
  workerEnv.SUPABASE_SERVICE_ROLE_KEY = variables.SERVICE_ROLE_KEY
  workerEnv.PLANOS_CREWAI_DRY_RUN = 'false'
  return workerEnv
}

function startPoller() {
  const uvBin = path.join(process.env.USERPROFILE || '', '.local', 'bin', 'uv.exe')
  const bin = existsSync(uvBin) ? uvBin : 'uv'
  const child = spawn(bin, ['run', 'planos-crewai-worker', 'poll', '--limit', '5'], {
    cwd: path.join(root, 'workers', 'crewai'),
    env: loadWorkerEnv(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', (d) => {
    out += d.toString()
  })
  child.stderr.on('data', (d) => {
    out += d.toString()
  })
  return {
    child,
    output: () => out,
    wait: () =>
      new Promise((resolve) => {
        child.on('close', (code) => resolve({ code, out }))
      }),
  }
}

let browser
let poller = null
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

  await loginDev(page, { email, password, site: SITE })
  await saveS2Manifest(page, { projectId, site: SITE })
  await acceptSpecialistContract(page, {
    projectId,
    task: '브라우저 E2E: 로그인·대시보드 요구사항 누락·모순을 검수하세요.',
    criteria: '실모델 findings JSON과 사람 수락까지',
    site: SITE,
  })
  console.log('PASS contract active')

  await page.getByTestId('crewai-worker-enqueue').click()
  await page.getByTestId('server-run-panel').waitFor({ state: 'visible', timeout: 30000 })
  await page.getByTestId('server-run-status').getByText(/queued|running|succeeded/, { exact: false }).waitFor({
    timeout: 30000,
  })
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-enqueued.png`, fullPage: true })
  console.log('PASS CrewAI enqueue')

  // Start worker AFTER enqueue so the queue is non-empty.
  poller = startPoller()

  // Poll worker + UI refresh until succeeded (max ~5 min).
  let succeeded = false
  for (let i = 0; i < 50; i += 1) {
    const statusText = await page.getByTestId('server-run-status').innerText()
    if (/succeeded/i.test(statusText)) {
      succeeded = true
      break
    }
    if (/failed/i.test(statusText)) {
      throw new Error(
        'run failed in UI: ' +
          statusText +
          '\nworker: ' +
          (poller ? poller.output().slice(-1500) : '(poller not started)'),
      )
    }
    // Restart poller if it exited early with empty work.
    if (poller.child.exitCode !== null && poller.child.exitCode !== undefined) {
      poller = startPoller()
    }
    await page.getByTestId('execution-refresh').click()
    await page.waitForTimeout(6000)
  }
  if (!succeeded) {
    const late = startPoller()
    await late.wait()
    await page.getByTestId('execution-refresh').click()
    await page.getByTestId('server-run-status').getByText('succeeded', { exact: false }).waitFor({
      timeout: 30000,
    })
  }
  await page.getByTestId('server-run-result').getByText('paidLlmUsed', { exact: false }).waitFor({
    timeout: 15000,
  })
  const resultText = await page.getByTestId('server-run-result').innerText()
  assert.match(resultText, /"mock"\s*:\s*false/)
  assert.match(resultText, /requirements_auditor_v1/)
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-succeeded.png`, fullPage: true })
  console.log('PASS CrewAI run succeeded in UI')

  await page.getByTestId('artifact-publish-from-run').click()
  await page.getByTestId('server-artifact-panel').waitFor({ state: 'visible', timeout: 30000 })
  await page.getByTestId('server-artifact-status').getByText('published', { exact: false }).waitFor({
    timeout: 20000,
  })
  console.log('PASS artifact published')

  await page.getByTestId('artifact-accept').click()
  await page.getByTestId('server-artifact-status').getByText('accepted', { exact: false }).waitFor({
    timeout: 30000,
  })
  await page.getByTestId('server-artifact-task').waitFor({ state: 'visible', timeout: 20000 })
  const taskHref = await page.getByTestId('server-artifact-task').locator('a').getAttribute('href')
  assert(taskHref && /\/tasks\/[0-9a-f-]{36}/i.test(taskHref), 'S1 task link missing')
  await page.screenshot({ path: `${ARTIFACT_DIR}/03-accepted.png`, fullPage: true })
  console.log('PASS artifact accepted → S1')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('server-run-panel').waitFor({ state: 'visible', timeout: 30000 })
  await page.getByTestId('server-run-status').getByText('succeeded', { exact: false }).waitFor({
    timeout: 25000,
  })
  await page.getByTestId('server-artifact-panel').waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('server-artifact-status').getByText('accepted', { exact: false }).waitFor({
    timeout: 25000,
  })
  await page.getByTestId('server-artifact-task').waitFor({ state: 'visible', timeout: 15000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/04-reload.png`, fullPage: true })
  console.log('PASS reload restores run + accepted artifact')

  console.log('SUCCESS browser_crewai_live_flow', { projectId, api, taskHref })
} catch (err) {
  console.error(err)
  console.error('worker output tail:\n', poller.output().slice(-2500))
  process.exitCode = 1
} finally {
  try {
    poller?.child.kill()
  } catch {
    /* ignore */
  }
  if (browser) await browser.close()
}
