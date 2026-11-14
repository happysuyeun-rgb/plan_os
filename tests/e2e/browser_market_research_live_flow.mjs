/**
 * Browser UI: market research hire → S2 → contract → Liner enqueue → poll
 * → report visible → publish → accept → reload.
 * Disposable local Supabase only. Never process_mock_ai_run. Never Deep Research.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import {
  loginDev,
  readLoopbackEnv,
  saveS2Manifest,
  seedOwnerProjectDocs,
  SITE,
} from './disposableSpecialistContractFixture.mjs'

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
const ARTIFACT_DIR = 'artifacts/market-research-live-browser'
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
const email = `browser-mr-${stamp}@example.test`
const password = 'Synthetic-mr-browser-password-123!'
const projectId = randomUUID()
const docPrdId = randomUUID()
const docPolicyId = randomUUID()

await seedOwnerProjectDocs({
  email,
  password,
  fullName: 'Market Research Browser Owner',
  projectId,
  projectTitle: 'Market Research Browser Live',
  docPrdId,
  docPolicyId,
  prdContent: '가상: 반려동물 예약 서비스. 공개 정보만 조사.',
  policyContent: '외부 게시·메일 금지. 웹 검색과 보고서만 허용.',
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

  await page.goto(SITE + '/projects/' + projectId + '/specialists/market-research', {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('heading', { name: 'AI 시장조사·리서치 전문가' }).waitFor({
    state: 'visible',
    timeout: 30000,
  })
  await page.getByTestId('market-research-target').fill('반려동물 예약 서비스 경쟁시장 조사')
  await page.getByTestId('market-research-region').selectOption('KR')
  await page.getByTestId('market-research-depth').selectOption('standard')
  await page.getByTestId('market-research-consent').check()
  await page.getByTestId('market-research-save-draft').click()
  await page.getByTestId('market-research-contract').waitFor({ state: 'visible', timeout: 30000 })
  await page.getByTestId('market-research-accept').click()
  await page.getByTestId('market-research-contract-status').getByText('active', { exact: false }).waitFor({
    timeout: 30000,
  })
  console.log('PASS market research contract active')

  await page.getByTestId('market-research-enqueue').click()
  await page.getByTestId('market-research-run').waitFor({ state: 'visible', timeout: 30000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-enqueued.png`, fullPage: true })
  console.log('PASS enqueue')

  poller = startPoller()
  let succeeded = false
  for (let i = 0; i < 50; i += 1) {
    const statusText = await page.getByTestId('market-research-run-status').innerText()
    if (/succeeded/i.test(statusText)) {
      succeeded = true
      break
    }
    if (/failed/i.test(statusText)) {
      throw new Error('run failed: ' + statusText + '\n' + (poller?.output().slice(-1500) || ''))
    }
    if (poller.child.exitCode !== null && poller.child.exitCode !== undefined) {
      poller = startPoller()
    }
    await page.getByTestId('market-research-refresh').click()
    await page.waitForTimeout(6000)
  }
  if (!succeeded) {
    const late = startPoller()
    await late.wait()
    await page.getByTestId('market-research-refresh').click()
    await page.getByTestId('market-research-run-status').getByText('succeeded', { exact: false }).waitFor({
      timeout: 30000,
    })
  }

  await page.getByTestId('market-research-report').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('market-research-sources').waitFor({ state: 'visible', timeout: 10000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-succeeded.png`, fullPage: true })
  console.log('PASS report visible with sources')

  await page.getByTestId('market-research-publish').click()
  await page.getByTestId('market-research-artifact').waitFor({ state: 'visible', timeout: 30000 })
  await page.getByTestId('market-research-accept-artifact').click()
  await page.screenshot({ path: `${ARTIFACT_DIR}/03-accepted.png`, fullPage: true })
  console.log('PASS artifact accepted')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page
    .getByTestId('market-research-artifact')
    .getByTestId('market-research-report')
    .waitFor({ state: 'visible', timeout: 30000 })
  await page.screenshot({ path: `${ARTIFACT_DIR}/04-reload.png`, fullPage: true })
  console.log('PASS reload keeps report')

  console.log('SUCCESS browser_market_research_live_flow', { projectId, api })
} catch (err) {
  console.error(err)
  console.error('worker output tail:\n', poller?.output().slice(-2500) || '')
  process.exitCode = 1
} finally {
  try {
    poller?.child.kill()
  } catch {
    /* ignore */
  }
  if (browser) await browser.close()
}
