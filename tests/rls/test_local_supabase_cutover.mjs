// C-03 cutover rehearsal: applies supabase/drafts/020_cutover...DRAFT.sql to
// the disposable local stack and proves every server write path still works
// while direct client UPDATE is denied. NOT wired into CI on purpose: run
// manually against a throwaway stack only, and restore the policy (or drop
// the stack) afterwards. See the draft file for the rollback SQL.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  people, projectOne, anonKey, API_URL, call, db,
} from './test_local_supabase_auth.mjs'

db('supabase/drafts/021_cutover_deny_direct_document_update_DRAFT.sql')
console.log('PASS cutover draft applied: documents_update_editor dropped')

async function rpc(role, fn, params) {
  const response = await fetch(API_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + people[role].access_token,
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

const docs = await call(
  '/rest/v1/documents?select=id,content,content_revision&project_id=eq.' + projectOne,
  { bearer: people.owner.access_token },
)
assert.equal(docs.length, 1)
const docId = docs[0].id
let revision = docs[0].content_revision

// Direct client UPDATE is now denied (RLS yields zero updated rows).
const direct = await fetch(API_URL + '/rest/v1/documents?id=eq.' + docId, {
  method: 'PATCH',
  headers: {
    apikey: anonKey,
    Authorization: 'Bearer ' + people.editor.access_token,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ content: 'direct update after cutover' }),
  signal: AbortSignal.timeout(15000),
})
const directBody = await direct.text()
assert(direct.ok && directBody === '[]',
  'direct UPDATE must affect zero rows after cutover, got ' + direct.status + ' ' + directBody)
console.log('PASS editor direct UPDATE denied after cutover (0 rows)')

// CAS still works (SECURITY DEFINER bypasses the removed client policy).
const cas = await rpc('editor', 'save_document_content_cas', {
  p_document_id: docId, p_expected_revision: revision, p_content: 'cas after cutover',
})
assert(cas.ok, 'CAS after cutover failed: ' + JSON.stringify(cas.data))
revision += 1

// Restore and chat RPCs still work; first creation INSERT still works.
await call('/rest/v1/document_versions', {
  bearer: people.editor.access_token, method: 'POST',
  body: {
    document_id: docId, version_number: 900,
    version_name: 'cutover-fixture', content: 'body before cutover restore',
  },
})
const created = await call(
  '/rest/v1/document_versions?select=id&document_id=eq.' + docId + '&version_number=eq.900',
  { bearer: people.owner.access_token },
)
const restore = await rpc('owner', 'restore_document_version', {
  p_document_id: docId, p_version_id: created[0].id, p_operation_id: randomUUID(),
})
assert(restore.ok, 'restore after cutover failed: ' + JSON.stringify(restore.data))
revision += 1

const chat = await rpc('editor', 'commit_chat_document_edit', {
  p_project_id: projectOne, p_document_id: docId,
  p_content: 'chat after cutover', p_operation_id: randomUUID(),
})
assert(chat.ok, 'chat after cutover failed: ' + JSON.stringify(chat.data))
revision += 1

const insert = await fetch(API_URL + '/rest/v1/documents', {
  method: 'POST',
  headers: {
    apikey: anonKey,
    Authorization: 'Bearer ' + people.editor.access_token,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ project_id: projectOne, type: 'ia', content: 'created after cutover' }),
  signal: AbortSignal.timeout(15000),
})
assert(insert.ok, 'first-creation INSERT after cutover failed: HTTP ' + insert.status)
console.log('PASS CAS, restore, chat and first-creation INSERT all work after cutover')

const after = await call(
  '/rest/v1/documents?select=content_revision&id=eq.' + docId,
  { bearer: people.owner.access_token },
)
assert.equal(after[0].content_revision, revision)
console.log('SUCCESS cutover rehearsal: only RPC/CAS writes remain, revision ' + revision)
