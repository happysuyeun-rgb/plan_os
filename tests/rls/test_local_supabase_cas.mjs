// C-03: Revision CAS RPC verified through the genuine local Supabase path
// (GoTrue login JWT -> Kong -> PostgREST -> PostgreSQL), not psql emulation.
// Runs ONLY against the disposable local stack started by CI. Reuses the
// authenticated fixture identities from the Auth suite; seed_auth_rest.sql
// is re-applied idempotently there so every suite can run in one stack.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  people, projectOne, anonKey, API_URL, call,
} from './test_local_supabase_auth.mjs'

async function rpc(role, fn, params) {
  const bearer = role === 'anon' ? anonKey : people[role].access_token
  const response = await fetch(API_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + bearer,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(30000),
  })
  const raw = await response.text()
  let data = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
  return { status: response.status, ok: response.ok, data }
}

async function readDocument(role, docId) {
  const rows = await call(
    '/rest/v1/documents?select=id,content,content_revision&id=eq.' + docId,
    { bearer: people[role].access_token },
  )
  assert.equal(rows.length, 1, role + ' must read exactly one document')
  return rows[0]
}

const initialDocs = await call(
  '/rest/v1/documents?select=id,content,content_revision&project_id=eq.' + projectOne,
  { bearer: people.owner.access_token },
)
assert.equal(initialDocs.length, 1)
const doc = initialDocs[0]
const docId = doc.id
assert.equal(typeof doc.content_revision, 'number', 'migration 018 content_revision must be exposed')
let revision = doc.content_revision
console.log('PASS fixture document exposes content_revision=' + revision)

// 1) owner and editor save successfully through CAS; revision advances once each.
const ownerSave = await rpc('owner', 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: revision, p_content: 'owner cas edit',
})
assert(ownerSave.ok, 'owner CAS failed: ' + JSON.stringify(ownerSave.data))
assert.equal(ownerSave.data.content, 'owner cas edit')
assert.equal(ownerSave.data.content_revision, revision + 1)
revision += 1

const editorSave = await rpc('editor', 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: revision, p_content: 'editor cas edit',
})
assert(editorSave.ok, 'editor CAS failed: ' + JSON.stringify(editorSave.data))
assert.equal(editorSave.data.content_revision, revision + 1)
revision += 1
console.log('PASS owner/editor CAS saves over JWT+PostgREST, revision now ' + revision)

// 2) viewer, other-project editor, outsider and anon are rejected by the server.
for (const role of ['viewer', 'otherEditor', 'outsider']) {
  const denied = await rpc(role, 'save_document_content_cas', {
    p_document_id: docId, p_expected_revision: revision, p_content: 'unauthorized cas',
  })
  assert(!denied.ok, role + ' CAS unexpectedly succeeded')
  assert.equal(denied.data?.code, '42501', role + ' CAS must fail with 42501, got ' + JSON.stringify(denied.data))
}
const anonSave = await rpc('anon', 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: revision, p_content: 'anon cas',
})
assert(!anonSave.ok, 'anon CAS unexpectedly succeeded')
assert.equal((await readDocument('owner', docId)).content, 'editor cas edit')
console.log('PASS viewer/other-project/outsider/anon CAS denied with server-side 42501')

// 3) a stale revision is rejected and the stored document is untouched.
const stale = await rpc('editor', 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: revision - 1, p_content: 'stale overwrite',
})
assert(!stale.ok, 'stale CAS unexpectedly succeeded')
assert.equal(stale.data?.code, 'P4001', 'stale CAS must conflict, got ' + JSON.stringify(stale.data))
const afterStale = await readDocument('owner', docId)
assert.equal(afterStale.content, 'editor cas edit')
assert.equal(afterStale.content_revision, revision)
console.log('PASS stale revision rejected (P4001), original content preserved')

// 4) two concurrent saves on the same revision: exactly one commits.
const raceResults = await Promise.all([
  rpc('editor', 'save_document_content_cas', {
    p_document_id: docId, p_expected_revision: revision, p_content: 'race editor',
  }),
  rpc('owner', 'save_document_content_cas', {
    p_document_id: docId, p_expected_revision: revision, p_content: 'race owner',
  }),
])
const winners = raceResults.filter((r) => r.ok)
const losers = raceResults.filter((r) => !r.ok)
assert.equal(winners.length, 1, 'exactly one concurrent CAS may win: ' + JSON.stringify(raceResults))
assert.equal(losers.length, 1)
assert.equal(losers[0].data?.code, 'P4001')
revision += 1
const afterRace = await readDocument('owner', docId)
assert.equal(afterRace.content_revision, revision)
assert.equal(afterRace.content, winners[0].data.content)
console.log('PASS concurrent same-revision CAS: one winner, loser P4001, revision ' + revision)

// 5) retrying the winning request after a lost response does not double-apply.
const winningRequest = winners[0].data.content === 'race editor'
  ? { role: 'editor', content: 'race editor' }
  : { role: 'owner', content: 'race owner' }
const retry = await rpc(winningRequest.role, 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: revision - 1, p_content: winningRequest.content,
})
assert(retry.ok, 'idempotent retry failed: ' + JSON.stringify(retry.data))
assert.equal(retry.data.content_revision, revision)
const sameContent = await rpc('editor', 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: revision, p_content: winningRequest.content,
})
assert(sameContent.ok)
assert.equal(sameContent.data.content_revision, revision)
console.log('PASS lost-response retry and identical-content save are no-op successes')

// 6) a long document body saves intact through the same RPC.
const longContent = ('긴 문서 본문 단락입니다. '.repeat(12000)) + 'END-OF-LONG-DOCUMENT'
assert(longContent.length > 150000)
const longSave = await rpc('editor', 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: revision, p_content: longContent,
})
assert(longSave.ok, 'long document CAS failed: ' + JSON.stringify(longSave.data).slice(0, 300))
revision += 1
const longRead = await readDocument('owner', docId)
assert.equal(longRead.content.length, longContent.length)
assert(longRead.content.endsWith('END-OF-LONG-DOCUMENT'))
console.log('PASS long document (' + longContent.length + ' chars) saved intact, revision ' + revision)

// 7) restore and chat writes advance the same revision; pre-write baselines conflict.
const versions = await call(
  '/rest/v1/document_versions?select=version_number&document_id=eq.' + docId +
    '&order=version_number.desc&limit=1',
  { bearer: people.owner.access_token },
)
const nextNumber = (versions[0]?.version_number ?? 0) + 1
await call('/rest/v1/document_versions', {
  bearer: people.editor.access_token, method: 'POST',
  body: {
    document_id: docId, version_number: nextNumber,
    version_name: 'c03-fixture', content: 'historical body for cas restore',
  },
})
const createdVersions = await call(
  '/rest/v1/document_versions?select=id&document_id=eq.' + docId +
    '&version_number=eq.' + nextNumber,
  { bearer: people.owner.access_token },
)
assert.equal(createdVersions.length, 1, 'fixture version insert failed')
const fixtureVersion = createdVersions[0]

const viewerRestore = await rpc('viewer', 'restore_document_version', {
  p_document_id: docId, p_version_id: fixtureVersion.id, p_operation_id: randomUUID(),
})
assert(!viewerRestore.ok && viewerRestore.data?.code === '42501',
  'viewer restore must be denied, got ' + JSON.stringify(viewerRestore.data))
const outsiderChat = await rpc('outsider', 'commit_chat_document_edit', {
  p_project_id: projectOne, p_document_id: docId,
  p_content: 'outsider injection', p_operation_id: randomUUID(),
})
assert(!outsiderChat.ok && outsiderChat.data?.code === '42501',
  'outsider chat edit must be denied, got ' + JSON.stringify(outsiderChat.data))

const restore = await rpc('owner', 'restore_document_version', {
  p_document_id: docId, p_version_id: fixtureVersion.id, p_operation_id: randomUUID(),
})
assert(restore.ok, 'owner restore failed: ' + JSON.stringify(restore.data))
assert.equal(restore.data.content, 'historical body for cas restore')
assert.equal(restore.data.content_revision, revision + 1)
const preRestoreBaseline = revision
revision += 1

const chat = await rpc('editor', 'commit_chat_document_edit', {
  p_project_id: projectOne, p_document_id: docId,
  p_content: 'chat note for cas', p_operation_id: randomUUID(),
})
assert(chat.ok, 'editor chat edit failed: ' + JSON.stringify(chat.data))
assert(chat.data.updated_content.includes('chat note for cas'))
revision += 1
const afterChat = await readDocument('owner', docId)
assert.equal(afterChat.content_revision, revision, 'chat edit must advance revision via the 018 trigger')

const staleAfterRestore = await rpc('editor', 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: preRestoreBaseline, p_content: 'autosave from before restore',
})
assert(!staleAfterRestore.ok && staleAfterRestore.data?.code === 'P4001',
  'pre-restore baseline CAS must conflict, got ' + JSON.stringify(staleAfterRestore.data))
console.log('PASS restore/chat advance revision; restore/chat permission denials hold; stale autosave conflicts')

// 8) a direct REST UPDATE still lands for editors, but the trigger advances
// the revision so the next CAS detects it instead of silently overwriting.
const direct = await fetch(API_URL + '/rest/v1/documents?id=eq.' + docId, {
  method: 'PATCH',
  headers: {
    apikey: anonKey,
    Authorization: 'Bearer ' + people.editor.access_token,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ content: 'direct rest update' }),
  signal: AbortSignal.timeout(15000),
})
assert(direct.ok, 'editor direct UPDATE regression: HTTP ' + direct.status)
revision += 1
const afterDirect = await readDocument('owner', docId)
assert.equal(afterDirect.content_revision, revision, 'direct UPDATE must advance revision via trigger')
const staleAfterDirect = await rpc('editor', 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: revision - 1, p_content: 'stale after direct',
})
assert(!staleAfterDirect.ok && staleAfterDirect.data?.code === 'P4001')
console.log('PASS direct UPDATE detected by revision advance (bypass measured, not silent)')

console.log('SUCCESS C-03 Revision CAS over genuine Supabase Auth/JWT/PostgREST')
