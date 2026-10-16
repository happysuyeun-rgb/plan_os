// Genuine LOCAL Supabase Auth -> JWT -> PostgREST RLS integration tests.
// Talks ONLY to localhost. Never provide production tokens or credentials.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const API_URL = 'http://127.0.0.1:54321'
const DB_PORT = '54322'
const TEST_PASSWORD = 'Test-only-password-123!'
const repository = process.cwd()
const localStackDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(localStackDir, 'PLANOS_LOCAL_SUPABASE_DIR required')
for (const name of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'SUPABASE_DB_URL']) {
  assert(!process.env[name], 'Hosted Supabase environment variables must be absent: ' + name)
}

const output = execFileSync('supabase', ['status', '-o', 'env'], {
  cwd: localStackDir, encoding: 'utf8', timeout: 30000,
})
const variables = Object.fromEntries(
  output.split('\n').flatMap(line => {
    const parsed = line.match(/^([A-Z_]+)=(.*)$/)
    return parsed ? [[parsed[1], parsed[2].replace(/^["']|["']$/g, '')]] : []
  }),
)
const anonKey = variables.ANON_KEY
const serviceKey = variables.SERVICE_ROLE_KEY
assert(anonKey && serviceKey, 'Local Supabase API keys were not returned')
assert(!variables.API_URL || /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(variables.API_URL), 'Unexpected nonlocal API URL')

function db(sqlFile, vars = []) {
  return execFileSync('psql', [
    '-X', '-v', 'ON_ERROR_STOP=1',
    ...vars.flatMap(([key, value]) => ['-v', key + '=' + value]),
    '-f', repository + '/' + sqlFile,
  ], {
    env: {
      ...process.env, PGHOST: '127.0.0.1', PGPORT: DB_PORT,
      PGUSER: 'postgres', PGPASSWORD: 'postgres',
      PGDATABASE: 'postgres', PGSSLMODE: 'disable',
    },
    encoding: 'utf8', timeout: 40000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function call(path, { key = anonKey, bearer = key, method = 'GET', body } = {}) {
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + bearer,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  })
  const raw = await response.text()
  let data = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  if (!response.ok) {
    throw new Error('Local ' + method + ' ' + path.split('?')[0] + ' HTTP ' +
      response.status + ': ' + (data?.code ?? data?.error_code ?? 'unknown'))
  }
  return data
}

async function account(role) {
  const email = 'planos-' + role + '-' + randomUUID().slice(0,8) + '@example.test'
  const created = await call('/auth/v1/admin/users', {
    key: serviceKey, method: 'POST',
    body: { email, password: TEST_PASSWORD, email_confirm: true },
  })
  assert.match(created.id, /^[0-9a-f-]{36}$/)
  const session = await call('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password: TEST_PASSWORD },
  })
  assert(session.access_token, 'Local Auth did not issue token for ' + role)
  assert.equal(session.user.id, created.id)
  return { id: created.id, access_token: session.access_token }
}

const people = {}
for (const name of ['owner','editor','viewer','pending','otherOwner','otherEditor','outsider']) {
  people[name] = await account(name)
}
const ids = Object.fromEntries(Object.entries(people).map(([name, person]) => [name, person.id]))
db('tests/rls/seed_auth_rest.sql', [
  ['owner_id', ids.owner],
  ['editor_id', ids.editor],
  ['viewer_id', ids.viewer],
  ['pending_id', ids.pending],
  ['other_owner_id', ids.otherOwner],
  ['other_editor_id', ids.otherEditor],
])
console.log('PASS local Supabase Auth users, real JWTs and public.users trigger')

const projectOne = '11111111-1111-1111-1111-111111111111'
const projectTwo = '22222222-2222-2222-2222-222222222222'
async function queryRows(role, resource, projectId) {
  const bearer = role === 'anon' ? anonKey : people[role].access_token
  const path = '/rest/v1/' + resource + '?select=*&project_id=eq.' + projectId
  const data = await call(path, { bearer })
  assert(Array.isArray(data), role + ' ' + resource + ' response must be an array')
  return data
}
for (const role of ['owner','editor','viewer']) {
  assert.equal((await queryRows(role, 'project_members', projectOne)).length, 3)
  assert.equal((await queryRows(role, 'project_members', projectTwo)).length, 0)
  assert.equal((await queryRows(role, 'documents', projectOne)).length, 1)
  assert.equal((await queryRows(role, 'documents', projectTwo)).length, 0)
  console.log('PASS ' + role + ': JWT team and document isolation')
}

const ownPending = await queryRows('pending', 'project_members', projectOne)
assert.equal(ownPending.length, 1)
assert.equal(ownPending[0].user_id, ids.pending)
assert.equal((await queryRows('pending', 'documents', projectOne)).length, 0)
assert.equal((await queryRows('pending', 'project_members', projectTwo)).length, 0)
console.log('PASS pending: own invitation only, no project document access')

for (const [role, ownCount] of [['otherOwner',2],['otherEditor',2]]) {
  assert.equal((await queryRows(role,'project_members',projectOne)).length, 0)
  assert.equal((await queryRows(role,'project_members',projectTwo)).length, ownCount)
}
for (const role of ['outsider','anon']) {
  assert.equal((await queryRows(role,'project_members',projectOne)).length, 0)
  assert.equal((await queryRows(role,'project_members',projectTwo)).length, 0)
  assert.equal((await queryRows(role,'documents',projectOne)).length, 0)
}
console.log('PASS other-project user, outsider and anon access denied')

const viewerWrite = await fetch(API_URL + '/rest/v1/documents?project_id=eq.' + projectOne + '&type=eq.prd', {
  method: 'PATCH',
  headers: {
    apikey: anonKey,
    Authorization: 'Bearer ' + people.viewer.access_token,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ content: 'UNAUTHORIZED-VIEWER-WRITE' }),
  signal: AbortSignal.timeout(12000),
})
const text = await viewerWrite.text()
assert(!viewerWrite.ok || text === '[]', 'Viewer unexpectedly updated document')
const ownerDocs = await queryRows('owner','documents',projectOne)
assert.equal(ownerDocs[0].content, 'One Project PRD')
console.log('PASS viewer document UPDATE denied, original content preserved')
console.log('SUCCESS: isolated Supabase Auth -> JWT -> PostgREST member policy integration')
