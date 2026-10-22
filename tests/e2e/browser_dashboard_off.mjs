// C04 dashboard with the server-task mode OFF (Issue #39, B-04):
// the dashboard must stay usable and must not invent progress numbers.
// Run with a Vite server started WITHOUT VITE_S1_SERVER_TASKS.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'
import { createAdminClient } from '../helpers/rest.mjs'

const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(localDir, 'PLANOS_LOCAL_SUPABASE_DIR is required')
const raw = execFileSync('supabase', ['status', '-o', 'env'], {
  cwd: localDir, encoding: 'utf8', timeout: 30000,
})
const variables = Object.fromEntries(raw.split('\n').flatMap((line) => {
  const match = line.match(/^([A-Z_]+)=(.*)$/)
  return match ? [[match[1], match[2].replace(/^["']|["']$/g, '')]] : []
}))
const api = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
const site = 'http://127.0.0.1:5173'
const email = `browser-dashboard-off-${Date.now()}@example.test`
const password = 'Synthetic-dashboard-password-123!'

const admin = createAdminClient({ apiUrl: api, serviceKey: variables.SERVICE_ROLE_KEY })

const created = await admin('/auth/v1/admin/users', 'POST', {
  email, password, email_confirm: true, user_metadata: { full_name: 'Dashboard Off E2E' },
})
execFileSync('psql', [
  '-X', '-v', 'ON_ERROR_STOP=1',
  '-c', `update public.users set onboarding_completed = true where id = '${created.id}'`,
], {
  env: {
    ...process.env, PGHOST: '127.0.0.1', PGPORT: process.env.PLANOS_LOCAL_DB_PORT ?? '55322',
    PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres', PGSSLMODE: 'disable',
  },
  stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
})

let browser
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  await page.goto(site + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.getByRole('button', { name: '임시 로그인' }).click()
  await page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 30000 })
  const text = await page.locator('body').innerText()
  assert(text.includes('서버 업무가 연결되지 않아 업무 통계를 표시하지 않습니다'),
    '서버 모드 OFF 안내가 표시되지 않음')
  assert(!text.includes('등록 업무 완료율'), 'OFF인데 가짜 완료율 라벨이 표시됨')
  assert(!/(\d+) \/ (\d+) · (\d+)%/.test(text), 'OFF인데 완료율 수치가 표시됨')
  console.log('PASS server-mode OFF shows the disabled state without invented metrics')
} finally {
  if (browser) await browser.close().catch(() => {})
}
console.log('SUCCESS dashboard remains honest when the server task mode is off')
