// S2 F-201/F-202: audit source manifest create + execution-time digest gate
// over genuine Auth/JWT/PostgREST. Disposable local Supabase only.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  people, projectOne, projectTwo, anonKey, API_URL,
} from './test_local_supabase_auth.mjs'
import { createRestClient } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { assertUuid } from '../helpers/rest.mjs'

const { rest, rpc } = createRestClient({ apiUrl: API_URL, anonKey, roles: people })

// Ensure two project-one documents exist (seed has PRD only).
runPsqlSeed([
  `insert into public.documents(project_id,type,content)
   select '${projectOne}','policy','One Project Policy for S2 manifest'
   where not exists (
     select 1 from public.documents where project_id='${projectOne}' and type='policy'
   )`,
])
const existing = await rest('owner', 'GET', 'documents', null,
  '?project_id=eq.' + projectOne + '&select=id,type,content,updated_at&order=type')
assert(existing.ok && existing.data.length >= 2, 'need at least two documents: ' + JSON.stringify(existing.data))
const docs = existing.data
const docIds = docs.slice(0, 2).map((d) => d.id)
const requestKey = randomUUID()

// 1) Owner creates server digest snapshot (client digests are not accepted).
const created = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: docIds,
  p_request_key: requestKey,
})
assert(created.ok && typeof created.data === 'string',
  'create failed: ' + JSON.stringify(created.data))
const manifestId = assertUuid(created.data, 'manifest id')
const row = await rest('owner', 'GET', 'audit_source_manifests', null, '?id=eq.' + manifestId)
assert.equal(row.data.length, 1)
assert.equal(row.data[0].sources.length, 2)
assert(row.data[0].sources.every((s) => String(s.digest).startsWith('sha256:')),
  'server must store sha256 digests')
console.log('PASS owner creates audit manifest with server digests')

// Idempotent same payload.
const again = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: docIds,
  p_request_key: requestKey,
})
assert(again.ok && again.data === manifestId, 'idempotent create must return same id')

// 2) Freshness PASS + assert gate PASS.
const current = await rpc('owner', 'is_audit_source_manifest_current', { p_id: manifestId })
assert(current.ok && current.data === true, 'fresh manifest must be current')
const asserted = await rpc('owner', 'assert_audit_source_manifest_current', { p_id: manifestId })
assert(asserted.ok && asserted.data === true, 'assert must pass on fresh sources')
console.log('PASS identical version/digest gate allows execution')

// 3) Editor/viewer cannot create or assert; outsider cannot read.
const editorCreate = await rpc('editor', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: docIds,
  p_request_key: randomUUID(),
})
assert(!editorCreate.ok && editorCreate.data?.code === '42501',
  'editor create must be owner-only: ' + JSON.stringify(editorCreate.data))
const viewerAssert = await rpc('viewer', 'assert_audit_source_manifest_current', { p_id: manifestId })
assert(!viewerAssert.ok && viewerAssert.data?.code === '42501',
  'viewer assert must be denied')
const outsiderRead = await rest('outsider', 'GET', 'audit_source_manifests', null, '?id=eq.' + manifestId)
assert.equal(outsiderRead.data.length, 0, 'outsider must not see manifests')
console.log('PASS owner-only create/assert; outsider read blocked')

// 4) Cross-project document ids rejected at create.
const foreign = await rest('otherOwner', 'GET', 'documents', null,
  '?project_id=eq.' + projectTwo + '&select=id')
assert(foreign.data[0]?.id, 'project two document missing')
const cross = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: [docIds[0], foreign.data[0].id],
  p_request_key: randomUUID(),
})
assert(!cross.ok, 'cross-project sources must fail: ' + JSON.stringify(cross.data))
console.log('PASS other-project documents blocked at create')

// 5) Mutate document content → stale boolean + assert P4001 (409).
runPsqlSeed([
  `update public.documents set content = content || ' [edited for S2 stale]', updated_at = now() where id = '${assertUuid(docIds[0], 'doc0')}'`,
])
const staleFlag = await rpc('owner', 'is_audit_source_manifest_current', { p_id: manifestId })
assert(staleFlag.ok && staleFlag.data === false, 'edited document must make manifest stale')
const staleAssert = await rpc('owner', 'assert_audit_source_manifest_current', { p_id: manifestId })
assert(!staleAssert.ok && staleAssert.data?.code === 'P4001',
  'stale assert must raise P4001: ' + JSON.stringify(staleAssert.data))
console.log('PASS document edit → stale 409/P4001 blocks execution')

// 6) Recovery: new request_key + create → assert PASS again.
const recoveryKey = randomUUID()
const recovered = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: docIds,
  p_request_key: recoveryKey,
})
assert(recovered.ok && typeof recovered.data === 'string')
const recoveredAssert = await rpc('owner', 'assert_audit_source_manifest_current', { p_id: recovered.data })
assert(recoveredAssert.ok && recoveredAssert.data === true, 'rebuilt manifest must pass assert')
console.log('PASS reselect/rebuild manifest recovers to PASS')

// 7) Deleted document → stale.
runPsqlSeed([
  `delete from public.documents where id = '${assertUuid(docIds[1], 'doc1')}'`,
])
const deletedAssert = await rpc('owner', 'assert_audit_source_manifest_current', { p_id: recovered.data })
assert(!deletedAssert.ok && deletedAssert.data?.code === 'P4001',
  'deleted source must block: ' + JSON.stringify(deletedAssert.data))
console.log('PASS deleted document blocks execution')

console.log('SUCCESS S2 audit manifest create/stale/recovery over genuine Supabase Auth/JWT/PostgREST')
