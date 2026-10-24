// Guest transfer over the genuine Supabase path: mirrors the REST sequence
// src/lib/guestTransfer.ts performs after the UUID-id fix. Documents get
// database-issued UUIDs, a mid-transfer failure is resumable against the
// SAME project, already-landed documents answer 23505 and are skipped
// (DocumentAlreadyExistsError in the app), and no duplicates appear.
import assert from 'node:assert/strict'
import {
  people, anonKey, API_URL,
} from './test_local_supabase_auth.mjs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TYPES = ['prd', 'ia', 'screen_list', 'policy', 'wireframe', 'cursor_prompt']
const contentOf = (type) => 'guest transfer body for ' + type

async function rest(role, method, path, body, params = '') {
  const response = await fetch(API_URL + '/rest/v1/' + path + params, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + people[role].access_token,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  const raw = await response.text()
  let data = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  return { status: response.status, ok: response.ok, data }
}

// 1) the project a first transfer attempt would create.
const projectCreated = await rest('owner', 'POST', 'projects', {
  user_id: people.owner.id,
  title: '게스트 이전 테스트 프로젝트',
  description: 'guest idea',
  service_type: '웹',
  target_user: '일반 사용자',
  interview_answers: {},
  memory_summary: 'guest | 게스트 체험 이관',
})
assert(projectCreated.ok, 'project create failed: ' + JSON.stringify(projectCreated.data))
const projectId = projectCreated.data[0].id
assert.match(projectId, UUID_RE)
console.log('PASS transfer project created id=' + projectId)

// 2) partial transfer: the first three documents land, then a failure
// (invalid type rejected by the CHECK constraint) stops the loop. In the
// app the guest data and the recorded project id survive for a retry.
for (const type of TYPES.slice(0, 3)) {
  const inserted = await rest('owner', 'POST', 'documents', {
    project_id: projectId, type, content: contentOf(type),
  })
  assert(inserted.ok, 'document insert failed for ' + type + ': ' + JSON.stringify(inserted.data))
  assert.match(inserted.data[0].id, UUID_RE, 'documents.id must be a database UUID')
}
const failed = await rest('owner', 'POST', 'documents', {
  project_id: projectId, type: 'bogus_type', content: 'never stored',
})
assert(!failed.ok, 'invalid document type must be rejected')
console.log('PASS partial transfer landed 3/6 documents with database UUIDs, then stopped on failure')

// 3) retry against the SAME project: landed documents answer 23505 and
// are skipped, missing documents insert, nothing is overwritten.
let skipped = 0
let insertedCount = 0
for (const type of TYPES) {
  const attempt = await rest('owner', 'POST', 'documents', {
    project_id: projectId, type, content: contentOf(type),
  })
  if (attempt.ok) {
    insertedCount += 1
    continue
  }
  assert.equal(attempt.status, 409, 'landed document must conflict, got ' + attempt.status)
  assert.equal(attempt.data?.code, '23505', 'landed document must surface 23505, got ' + JSON.stringify(attempt.data))
  skipped += 1
}
assert.equal(skipped, 3, 'exactly the 3 landed documents must be skipped')
assert.equal(insertedCount, 3, 'exactly the 3 missing documents must be inserted')
console.log('PASS retry skipped 3 landed documents (23505) and inserted the remaining 3')

// 4) final state: one project, six documents, original bodies intact.
const finalDocs = await rest('owner', 'GET', 'documents', null,
  '?project_id=eq.' + projectId + '&select=id,type,content&order=type')
assert(finalDocs.ok && finalDocs.data.length === 6,
  'expected exactly 6 transferred documents, got ' + JSON.stringify(finalDocs.data))
for (const row of finalDocs.data) {
  assert.match(row.id, UUID_RE)
  assert.equal(row.content, contentOf(row.type), 'document body must survive the retry: ' + row.type)
}
const projectDocs = await rest('owner', 'GET', 'projects', null, '?id=eq.' + projectId + '&select=id')
assert(projectDocs.data.length === 1)
console.log('PASS retry produced no duplicates: 6 documents with original bodies under one project')

console.log('SUCCESS guest transfer resume semantics over genuine Supabase Auth/JWT/PostgREST')
