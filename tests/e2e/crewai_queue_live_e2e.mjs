/**
 * Live CrewAI queue E2E against disposable local Supabase only.
 * Requires:
 *   PLANOS_LOCAL_SUPABASE_DIR  — running local stack dir
 *   workers/crewai/.env        — LINER_API_KEY set
 *   034 local_only RPCs applied
 *
 * Flow: seed owner/project/docs → manifest → accept contract → enqueue_ai_run
 *       → Python poll (claim/complete) → assert mock:false + findings
 * Never calls process_mock_ai_run.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAdminClient, createRestClient, assertUuid } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))
const localDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(localDir, 'PLANOS_LOCAL_SUPABASE_DIR required')
const apiUrl = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(apiUrl), 'loopback API only')

const envFile = path.join(root, 'workers', 'crewai', '.env')
assert(existsSync(envFile), 'missing workers/crewai/.env with LINER_API_KEY')
const envText = readFileSync(envFile, 'utf8')
assert(/LINER_API_KEY=\S+/.test(envText), 'LINER_API_KEY empty in .env')
assert(!/PLANOS_CREWAI_DRY_RUN=\s*true/i.test(envText), 'DRY_RUN must be false for live E2E')

if (process.env.PLANOS_LOCAL_STATUS_FILE && existsSync(process.env.PLANOS_LOCAL_STATUS_FILE)) {
  process.env.PLANOS_LOCAL_STATUS_ENV = readFileSync(
    process.env.PLANOS_LOCAL_STATUS_FILE,
    'utf8',
  ).replace(/\r/g, '')
}
const variables = readLocalSupabaseEnv(localDir)
const dbPort = process.env.PLANOS_LOCAL_DB_PORT ?? '54322'
const admin = createAdminClient({ apiUrl, serviceKey: variables.SERVICE_ROLE_KEY })

const stamp = Date.now()
const email = `crewai-live-owner-${stamp}@example.test`
const password = 'Synthetic-crewai-live-password-123!'
const created = await admin('/auth/v1/admin/users', 'POST', {
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'CrewAI Live Owner' },
})
const ownerId = assertUuid(created.id, 'owner')
const projectId = randomUUID()

runPsqlSeed(
  [
    `update public.users set name='CrewAI Live Owner', onboarding_completed=true where id='${ownerId}'`,
    `insert into public.projects(id,user_id,title,description,memory_summary)
     values ('${projectId}','${ownerId}','CrewAI Live E2E','Synthetic','Synthetic')`,
    `insert into public.documents(project_id,type,content) values
      ('${projectId}','prd','사용자는 로그인 후 대시보드에 진입한다. 결제 흐름은 없다.'),
      ('${projectId}','policy','개인정보 보관 기간은 1년이다.')`,
  ].join(';\n') + ';\n',
  { dbPort },
)

const login = await fetch(new URL('/auth/v1/token?grant_type=password', apiUrl), {
  method: 'POST',
  headers: {
    apikey: variables.ANON_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
})
assert(login.ok, 'owner login failed')
const session = await login.json()
const { rest, rpc } = createRestClient({
  apiUrl,
  anonKey: variables.ANON_KEY,
  roles: { owner: { access_token: session.access_token } },
})

const docs = await rest(
  'owner',
  'GET',
  'documents',
  null,
  `?project_id=eq.${projectId}&select=id,type&order=type`,
)
assert(docs.ok && docs.data.length >= 2, 'docs: ' + JSON.stringify(docs.data))
const docIds = docs.data.slice(0, 2).map((d) => d.id)

const manifest = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectId,
  p_document_ids: docIds,
  p_request_key: randomUUID(),
})
assert(manifest.ok, 'manifest: ' + JSON.stringify(manifest.data))
const manifestId = assertUuid(manifest.data, 'manifest')

const draft = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectId,
  p_task: '로그인·대시보드 요구사항 누락·모순·개선안을 검수하세요.',
  p_acceptance_criteria: 'structured findings JSON',
  p_audit_manifest_id: manifestId,
  p_budget_cap_minor: 0,
  p_client_request_id: randomUUID(),
  p_expires_at: null,
})
assert(draft.ok, 'draft: ' + JSON.stringify(draft.data))

const accepted = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: draft.data.id,
  p_expected_version: draft.data.version,
  p_consent_statement: 'CrewAI live E2E — disposable local only.',
})
assert(accepted.ok && accepted.data.status === 'active', 'accept: ' + JSON.stringify(accepted.data))

const queued = await rpc('owner', 'enqueue_ai_run', {
  p_contract_id: accepted.data.id,
  p_idempotency_key: randomUUID(),
})
assert(queued.ok && queued.data.status === 'queued', 'enqueue: ' + JSON.stringify(queued.data))
const runId = assertUuid(queued.data.id, 'run')
console.log('PASS enqueue queued run', runId, 'project', projectId)

// Load workers/crewai/.env first, then force disposable stack overrides.
const workerEnv = { ...process.env }
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!match) continue
  const key = match[1]
  let value = match[2]
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  workerEnv[key] = value
}
workerEnv.PLANOS_LOCAL_API_URL = apiUrl
workerEnv.SUPABASE_SERVICE_ROLE_KEY = variables.SERVICE_ROLE_KEY
workerEnv.PLANOS_CREWAI_DRY_RUN = 'false'
assert(workerEnv.LINER_API_KEY, 'LINER_API_KEY missing after .env parse')

const uvBin =
  process.platform === 'win32'
    ? path.join(process.env.USERPROFILE || '', '.local', 'bin', 'uv.exe')
    : 'uv'
const uvPath = existsSync(uvBin) ? uvBin : 'uv'
let row = null
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const poll = spawnSync(
    uvPath,
    ['run', 'planos-crewai-worker', 'poll', '--limit', '3'],
    {
      cwd: path.join(root, 'workers', 'crewai'),
      encoding: 'utf8',
      env: workerEnv,
      timeout: 300000,
      windowsHide: true,
    },
  )
  if (poll.status !== 0) {
    console.error(poll.stdout)
    console.error(poll.stderr)
    process.exit(poll.status ?? 1)
  }
  console.log(`poll attempt ${attempt}:`, poll.stdout.slice(-1200))

  let runs = null
  for (let fetchTry = 1; fetchTry <= 5; fetchTry += 1) {
    try {
      runs = await rest(
        'owner',
        'GET',
        'ai_runs',
        null,
        `?id=eq.${runId}&select=id,status,result_json,error_code,error_message`,
      )
      break
    } catch (err) {
      if (fetchTry === 5) throw err
      await new Promise((r) => setTimeout(r, 1000 * fetchTry))
    }
  }
  assert(runs?.ok && runs.data?.[0], 'run fetch failed')
  row = runs.data[0]
  if (row.status === 'succeeded' || row.status === 'failed') break
}
assert(row, 'run row missing')
assert.equal(row.status, 'succeeded', 'run status: ' + JSON.stringify(row))
assert.equal(row.result_json?.mock, false)
assert.equal(row.result_json?.paidLlmUsed, true)
assert.equal(row.result_json?.agentSlug, 'requirements_auditor_v1')
assert.ok(Array.isArray(row.result_json?.findings) && row.result_json.findings.length > 0)
assert.ok(
  row.result_json?.engine === 'crewai' || row.result_json?.engineFamily === 'crewai' || row.result_json?.engine,
)

console.log('SUCCESS crewai_queue_live_e2e', {
  runId,
  projectId,
  findings: row.result_json.findings.length,
  engine: row.result_json.engine || row.result_json.engineFamily,
  modelUsage: row.result_json.usage || null,
})
