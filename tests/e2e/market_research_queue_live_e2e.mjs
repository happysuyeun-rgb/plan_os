/**
 * Live market research queue E2E against disposable local Supabase only.
 * Requires:
 *   PLANOS_LOCAL_SUPABASE_DIR — running local stack
 *   workers/crewai/.env — LINER_API_KEY
 *   034 + 035 local_only RPCs applied
 *
 * Flow: seed → manifest → create_market_research_contract_draft → accept
 *       → enqueue → Python poll → assert market_research_report_v1 + sources
 * Never calls process_mock_ai_run. Never uses Deep Research (cost).
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
const email = `mr-live-owner-${stamp}@example.test`
const password = 'Synthetic-mr-live-password-123!'
const created = await admin('/auth/v1/admin/users', 'POST', {
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'Market Research Live Owner' },
})
const ownerId = assertUuid(created.id, 'owner')
const projectId = randomUUID()

runPsqlSeed(
  [
    `update public.users set name='MR Live Owner', onboarding_completed=true where id='${ownerId}'`,
    `insert into public.projects(id,user_id,title,description,memory_summary)
     values ('${projectId}','${ownerId}','MR Live E2E','Synthetic pet booking','Synthetic')`,
    `insert into public.documents(project_id,type,content) values
      ('${projectId}','prd','가상 프로젝트: 반려동물 예약 서비스. 공개 정보만 조사.'),
      ('${projectId}','policy','외부 게시·메일 발송 금지. 웹 검색과 보고서만 허용.')`,
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

const draft = await rpc('owner', 'create_market_research_contract_draft', {
  p_project_id: projectId,
  p_task: '공개 정보로 반려동물 예약 경쟁사·가격·기능을 조사하세요.',
  p_acceptance_criteria: '출처 URL이 있는 구조화 시장조사 보고서',
  p_audit_manifest_id: manifestId,
  p_budget_cap_minor: 500,
  p_client_request_id: randomUUID(),
  p_research_target: '반려동물 예약 서비스 경쟁시장 조사',
  p_region: 'KR',
  p_research_depth: 'standard',
  p_lang: 'ko',
  p_expires_at: null,
})
assert(draft.ok, 'draft: ' + JSON.stringify(draft.data))
assert.equal(draft.data.agent_slug, 'ai_market_researcher_v1')

const accepted = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: draft.data.id,
  p_expected_version: draft.data.version,
  p_consent_statement:
    'Liner 검색·웹조사·보고서 작성만 승인하며 외부 게시·메일·임의 파일 수정은 금지합니다.',
})
assert(accepted.ok && accepted.data.status === 'active', 'accept: ' + JSON.stringify(accepted.data))

const queued = await rpc('owner', 'enqueue_ai_run', {
  p_contract_id: accepted.data.id,
  p_idempotency_key: randomUUID(),
})
assert(queued.ok && queued.data.status === 'queued', 'enqueue: ' + JSON.stringify(queued.data))

const workerEnv = {
  ...process.env,
  PLANOS_LOCAL_API_URL: apiUrl,
  SUPABASE_SERVICE_ROLE_KEY: variables.SERVICE_ROLE_KEY,
}
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && m[1] !== 'PLANOS_LOCAL_API_URL' && m[1] !== 'SUPABASE_SERVICE_ROLE_KEY') {
    workerEnv[m[1]] = m[2]
  }
}

const py = spawnSync(
  process.platform === 'win32'
    ? path.join(root, 'workers', 'crewai', '.venv', 'Scripts', 'python.exe')
    : path.join(root, 'workers', 'crewai', '.venv', 'bin', 'python'),
  ['-m', 'planos_crewai.cli', 'poll', '--limit', '1'],
  {
    cwd: path.join(root, 'workers', 'crewai'),
    env: workerEnv,
    encoding: 'utf8',
    timeout: 360000,
  },
)
assert.equal(py.status, 0, 'poll failed: ' + (py.stderr || py.stdout || ''))

const runGet = await rest(
  'owner',
  'GET',
  'ai_runs',
  null,
  `?id=eq.${queued.data.id}&select=*`,
)
assert(runGet.ok && runGet.data[0], 'run fetch failed')
const row = runGet.data[0]
assert.equal(row.status, 'succeeded', JSON.stringify(row))
assert.equal(row.result_json?.mock, false)
assert.equal(row.result_json?.agentSlug, 'ai_market_researcher_v1')
assert.equal(row.result_json?.kind, 'market_research_report_v1')
assert.ok(
  row.result_json?.rawLinerAnswer || row.result_json?.marketOverview,
  'missing liner answer',
)
assert.ok(Array.isArray(row.result_json?.sources) && row.result_json.sources.length > 0, 'no sources')
assert.ok(row.result_json.sources.some((s) => s.urlValid !== false && s.url), 'no valid source url')

console.log(
  JSON.stringify(
    {
      pass: true,
      runId: row.id,
      agentSlug: row.result_json.agentSlug,
      sourceCount: row.result_json.sources.length,
      engine: row.result_json.engine,
      usage: row.result_json.usage?.budget || row.result_json.usage,
    },
    null,
    2,
  ),
)
