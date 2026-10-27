// F-A: agent_contracts draft/accept/revoke + RLS over genuine Auth/JWT/PostgREST.
// Disposable local Supabase only. No paid LLM.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  people, projectOne, projectTwo, anonKey, API_URL,
} from './test_local_supabase_auth.mjs'
import { createRestClient } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { assertUuid } from '../helpers/rest.mjs'

const { rest, rpc } = createRestClient({ apiUrl: API_URL, anonKey, roles: people })

runPsqlSeed([
  `insert into public.documents(project_id,type,content)
   select '${projectOne}','policy','One Project Policy for F-A contract'
   where not exists (
     select 1 from public.documents where project_id='${projectOne}' and type='policy'
   )`,
])

const existing = await rest('owner', 'GET', 'documents', null,
  '?project_id=eq.' + projectOne + '&select=id,type&order=type')
assert(existing.ok && existing.data.length >= 2, 'need two documents')
const docIds = existing.data.slice(0, 2).map((d) => d.id)
const manifestKey = randomUUID()
const manifest = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: docIds,
  p_request_key: manifestKey,
})
assert(manifest.ok && typeof manifest.data === 'string', 'manifest create: ' + JSON.stringify(manifest.data))
const manifestId = assertUuid(manifest.data, 'manifest')

const consent = 'Mock 실행만 승인하며 유료 LLM을 호출하지 않습니다.'
const requestId = randomUUID()
const draft = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: '요구사항 문서 두 건을 검수해 주세요.',
  p_acceptance_criteria: '누락과 근거를 표로 정리',
  p_audit_manifest_id: manifestId,
  p_budget_cap_minor: 0,
  p_client_request_id: requestId,
  p_expires_at: null,
})
assert(draft.ok && draft.data?.id && draft.data.status === 'draft',
  'draft create failed: ' + JSON.stringify(draft.data))
assert.equal(draft.data.agent_slug, 'requirements_auditor_v1')
assert.match(draft.data.terms_digest, /^sha256:[0-9a-f]{64}$/)
assert.equal(draft.data.scope_json.paidLlmAllowed, false)
assert.equal(draft.data.scope_json.mockOnly, true)
const contractId = assertUuid(draft.data.id, 'contract')
console.log('PASS owner creates server contract draft with terms digest')

const again = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: '요구사항 문서 두 건을 검수해 주세요.',
  p_acceptance_criteria: '누락과 근거를 표로 정리',
  p_audit_manifest_id: manifestId,
  p_budget_cap_minor: 0,
  p_client_request_id: requestId,
  p_expires_at: null,
})
assert(again.ok && again.data.id === contractId, 'idempotent draft must return same id')
console.log('PASS idempotent client_request_id returns same draft')

const editorDraft = await rpc('editor', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: '에디터가 만들려는 계약 초안입니다.',
  p_acceptance_criteria: '완료 기준 텍스트',
  p_audit_manifest_id: manifestId,
  p_budget_cap_minor: 0,
  p_client_request_id: randomUUID(),
  p_expires_at: null,
})
assert(!editorDraft.ok && editorDraft.data?.code === '42501',
  'editor draft must be denied: ' + JSON.stringify(editorDraft.data))
console.log('PASS editor cannot create contract draft')

const shortConsent = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: contractId,
  p_expected_version: draft.data.version,
  p_consent_statement: 'too-short',
})
assert(!shortConsent.ok, 'short consent must fail: ' + JSON.stringify(shortConsent.data))

const accepted = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: contractId,
  p_expected_version: draft.data.version,
  p_consent_statement: consent,
})
assert(accepted.ok && accepted.data.status === 'active',
  'accept failed: ' + JSON.stringify(accepted.data))
assert(accepted.data.accepted_by && accepted.data.accepted_at)
assert.equal(accepted.data.version, draft.data.version + 1)
console.log('PASS owner accept with explicit consent')

const events = await rest('owner', 'GET', 'agent_contract_events', null,
  '?contract_id=eq.' + contractId + '&order=created_at.asc')
assert(events.ok && events.data.length >= 2)
assert.equal(events.data[0].event_type, 'draft_created')
assert.equal(events.data[1].event_type, 'accepted')
assert.equal(events.data[1].comment, consent)
console.log('PASS consent event persisted separately from draft')

const editorAccept = await rpc('editor', 'accept_agent_contract', {
  p_contract_id: contractId,
  p_expected_version: accepted.data.version,
  p_consent_statement: consent,
})
assert(!editorAccept.ok, 'editor accept must fail on active: ' + JSON.stringify(editorAccept.data))

const duplicateAccept = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: contractId,
  p_expected_version: accepted.data.version,
  p_consent_statement: consent,
})
assert(!duplicateAccept.ok && (duplicateAccept.data?.code === 'P4001' ||
  String(duplicateAccept.data?.message ?? '').includes('INVALID_CONTRACT_TRANSITION')),
  're-accept must fail: ' + JSON.stringify(duplicateAccept.data))
console.log('PASS duplicate accept blocked')

const outsiderRead = await rest('outsider', 'GET', 'agent_contracts', null, '?id=eq.' + contractId)
assert.equal(outsiderRead.data.length, 0, 'outsider must not see contracts')
const otherOwnerRead = await rest('otherOwner', 'GET', 'agent_contracts', null, '?id=eq.' + contractId)
assert.equal(otherOwnerRead.data.length, 0, 'other project owner must not see contracts')
const editorRead = await rest('editor', 'GET', 'agent_contracts', null, '?id=eq.' + contractId)
assert.equal(editorRead.data.length, 1, 'editor member may read contracts')
const viewerRead = await rest('viewer', 'GET', 'agent_contracts', null, '?id=eq.' + contractId)
assert.equal(viewerRead.data.length, 1, 'viewer member may read contracts')
console.log('PASS cross-project blocked; members can read')

const directInsert = await rest('owner', 'POST', 'agent_contracts', {
  project_id: projectOne,
  agent_slug: 'requirements_auditor_v1',
  created_by: people.owner.id,
  client_request_id: randomUUID(),
  terms_version: 'forged',
  terms_digest: 'sha256:' + 'a'.repeat(64),
  scope_json: { forged: true },
  audit_manifest_id: manifestId,
  budget_cap_minor: 0,
  status: 'active',
})
assert(!directInsert.ok, 'direct insert must be denied: ' + JSON.stringify(directInsert.data))
console.log('PASS direct table writes denied (RPC-only)')

// Stale manifest blocks a new draft.
runPsqlSeed([
  `update public.documents set content = content || ' [fa stale]', updated_at = now() where id = '${assertUuid(docIds[0], 'doc0')}'`,
])
const staleDraft = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: 'stale 소스로는 초안을 만들 수 없습니다.',
  p_acceptance_criteria: '실패해야 함',
  p_audit_manifest_id: manifestId,
  p_budget_cap_minor: 0,
  p_client_request_id: randomUUID(),
  p_expires_at: null,
})
assert(!staleDraft.ok && staleDraft.data?.code === 'P4001',
  'stale manifest must block draft: ' + JSON.stringify(staleDraft.data))
console.log('PASS stale S2 manifest blocks new contract draft')

const revoked = await rpc('owner', 'revoke_agent_contract', {
  p_contract_id: contractId,
  p_expected_version: accepted.data.version,
  p_comment: 'test revoke',
})
assert(revoked.ok && revoked.data.status === 'revoked',
  'revoke failed: ' + JSON.stringify(revoked.data))
console.log('PASS owner revoke active contract')

// Cross-project manifest id rejected.
runPsqlSeed([
  `insert into public.documents(project_id,type,content)
   select '${projectTwo}','policy','Other project policy for F-A'
   where not exists (
     select 1 from public.documents where project_id='${projectTwo}' and type='policy'
   )`,
])
const foreignDocs = await rest('otherOwner', 'GET', 'documents', null,
  '?project_id=eq.' + projectTwo + '&select=id&order=type')
assert(foreignDocs.data.length >= 1)
// Ensure at least two docs on project two.
if (foreignDocs.data.length < 2) {
  runPsqlSeed([
    `insert into public.documents(project_id,type,content)
     values ('${projectTwo}','prd','Other project PRD for F-A cross check')`,
  ])
}
const foreignDocs2 = await rest('otherOwner', 'GET', 'documents', null,
  '?project_id=eq.' + projectTwo + '&select=id&order=type')
const foreignIds = foreignDocs2.data.slice(0, 2).map((d) => d.id)
const foreignManifest = await rpc('otherOwner', 'create_audit_source_manifest', {
  p_project_id: projectTwo,
  p_document_ids: foreignIds,
  p_request_key: randomUUID(),
})
assert(foreignManifest.ok)
const cross = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: '다른 프로젝트 manifest는 거부되어야 합니다.',
  p_acceptance_criteria: '거부 확인',
  p_audit_manifest_id: foreignManifest.data,
  p_budget_cap_minor: 0,
  p_client_request_id: randomUUID(),
  p_expires_at: null,
})
assert(!cross.ok, 'cross-project manifest must fail: ' + JSON.stringify(cross.data))
console.log('PASS other-project manifest blocked')

console.log('SUCCESS F-A agent contracts draft/accept/revoke/RLS over genuine Supabase Auth/JWT/PostgREST')
