// Genuine LOCAL Supabase Auth -> JWT -> PostgREST RLS integration tests.
// Talks ONLY to localhost. Never provide production tokens or credentials.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { assertUuid, createAdminClient } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

// Defaults match CI. Local runs may override both when port 54321/54322 are
// already taken by another disposable stack; the values must stay loopback.
const API_URL = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
const DB_PORT = process.env.PLANOS_LOCAL_DB_PORT ?? '54322'
const TEST_PASSWORD = 'Test-only-password-123!'
const localStackDir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(localStackDir, 'PLANOS_LOCAL_SUPABASE_DIR required')

const variables = readLocalSupabaseEnv(localStackDir)
const anonKey = variables.ANON_KEY
const serviceKey = variables.SERVICE_ROLE_KEY
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(API_URL), 'API URL must be loopback: ' + API_URL)
assert(!variables.API_URL || variables.API_URL === API_URL, 'Unexpected nonlocal API URL')

function expandPsqlVars(sql, vars) {
  let out = sql
  for (const [key, value] of Object.entries(vars)) {
    assertUuid(value, key)
    out = out.replaceAll(`:'${key}'`, `'${value}'`)
  }
  return out
}

function db(sqlFile, vars = {}) {
  // Callers historically passed [[key, value], ...]; object form is also accepted.
  const map = Array.isArray(vars)
    ? Object.fromEntries(vars)
    : vars
  return runPsqlSeed(
    expandPsqlVars(readFileSync(sqlFile, 'utf8'), map),
    { dbPort: DB_PORT },
  )
}

const admin = createAdminClient({ apiUrl: API_URL, serviceKey })

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
  const email = 'planos-' + role + '-' + randomUUID().slice(0, 8) + '@example.test'
  const created = await admin('/auth/v1/admin/users', 'POST', {
    email, password: TEST_PASSWORD, email_confirm: true,
  })
  assertUuid(created.id, role + ' user id')
  const session = await call('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password: TEST_PASSWORD },
  })
  assert(session.access_token, 'Local Auth did not issue token for ' + role)
  assert.equal(session.user.id, created.id)
  return { id: created.id, access_token: session.access_token }
}

const people = {}
for (const name of ['owner', 'editor', 'viewer', 'pending', 'otherOwner', 'otherEditor', 'outsider']) {
  people[name] = await account(name)
}
const ids = Object.fromEntries(Object.entries(people).map(([name, person]) => [name, person.id]))
db('tests/rls/seed_auth_rest.sql', {
  owner_id: ids.owner,
  editor_id: ids.editor,
  viewer_id: ids.viewer,
  pending_id: ids.pending,
  other_owner_id: ids.otherOwner,
  other_editor_id: ids.otherEditor,
})
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
for (const role of ['owner', 'editor', 'viewer']) {
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

// Project owners live in projects.user_id; only invited members occupy project_members.
for (const [role, ownCount] of [['otherOwner', 1], ['otherEditor', 1]]) {
  assert.equal((await queryRows(role, 'project_members', projectOne)).length, 0)
  assert.equal((await queryRows(role, 'project_members', projectTwo)).length, ownCount)
}
for (const role of ['outsider', 'anon']) {
  assert.equal((await queryRows(role, 'project_members', projectOne)).length, 0)
  assert.equal((await queryRows(role, 'project_members', projectTwo)).length, 0)
  assert.equal((await queryRows(role, 'documents', projectOne)).length, 0)
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
const ownerDocs = await queryRows('owner', 'documents', projectOne)
assert.equal(ownerDocs[0].content, 'One Project PRD')
console.log('PASS viewer document UPDATE denied, original content preserved')
console.log('SUCCESS: isolated Supabase Auth -> JWT -> PostgREST member policy integration')

// Reuse the same authenticated, disposable test identities in the next RLS suite.
export { people, projectOne, projectTwo, call, anonKey, API_URL, db }
