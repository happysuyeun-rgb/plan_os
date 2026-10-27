// F-B: ai_runs enqueue/process/retry + mock usage ledger over Auth/JWT/PostgREST.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  people, projectOne, anonKey, API_URL,
} from './test_local_supabase_auth.mjs'
import { createRestClient } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'
import { assertUuid } from '../helpers/rest.mjs'

const { rest, rpc } = createRestClient({ apiUrl: API_URL, anonKey, roles: people })

runPsqlSeed([
  `insert into public.documents(project_id,type,content)
   select '${projectOne}','policy','One Project Policy for F-B runs'
   where not exists (
     select 1 from public.documents where project_id='${projectOne}' and type='policy'
   )`,
])
const docs = await rest('owner', 'GET', 'documents', null,
  '?project_id=eq.' + projectOne + '&select=id&order=type')
assert(docs.data.length >= 2)
const docIds = docs.data.slice(0, 2).map((d) => d.id)
const manifest = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: docIds,
  p_request_key: randomUUID(),
})
assert(manifest.ok)
const manifestId = assertUuid(manifest.data, 'manifest')

const draft = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: 'F-B용 요구사항 검수 업무를 수행하세요.',
  p_acceptance_criteria: 'Mock 결과 보고서',
  p_audit_manifest_id: manifestId,
  p_budget_cap_minor: 0,
  p_client_request_id: randomUUID(),
  p_expires_at: null,
})
assert(draft.ok)
const inactiveEnqueue = await rpc('owner', 'enqueue_ai_run', {
  p_contract_id: draft.data.id,
  p_idempotency_key: randomUUID(),
})
assert(!inactiveEnqueue.ok, 'draft contract must not enqueue: ' + JSON.stringify(inactiveEnqueue.data))
console.log('PASS inactive contract cannot enqueue')

const accepted = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: draft.data.id,
  p_expected_version: draft.data.version,
  p_consent_statement: 'Mock 실행만 승인하며 유료 LLM을 호출하지 않습니다.',
})
assert(accepted.ok && accepted.data.status === 'active')

const idem = randomUUID()
const queued = await rpc('owner', 'enqueue_ai_run', {
  p_contract_id: accepted.data.id,
  p_idempotency_key: idem,
})
assert(queued.ok && queued.data.status === 'queued', 'enqueue: ' + JSON.stringify(queued.data))
const runId = assertUuid(queued.data.id, 'run')
const again = await rpc('owner', 'enqueue_ai_run', {
  p_contract_id: accepted.data.id,
  p_idempotency_key: idem,
})
assert(again.ok && again.data.id === runId, 'idempotent enqueue')
console.log('PASS enqueue + idempotency')

const editorEnqueue = await rpc('editor', 'enqueue_ai_run', {
  p_contract_id: accepted.data.id,
  p_idempotency_key: randomUUID(),
})
assert(!editorEnqueue.ok && editorEnqueue.data?.code === '42501')
console.log('PASS editor cannot enqueue')

const processed = await rpc('owner', 'process_mock_ai_run', { p_run_id: runId })
assert(processed.ok && processed.data.status === 'succeeded',
  'process: ' + JSON.stringify(processed.data))
assert.equal(processed.data.result_json.paidLlmUsed, false)
assert.equal(processed.data.result_json.mock, true)
const events = await rest('owner', 'GET', 'ai_run_events', null,
  '?run_id=eq.' + runId + '&order=created_at.asc')
const types = events.data.map((e) => e.event_type)
assert.deepEqual(types, ['enqueued', 'started', 'validating', 'succeeded'])
const usage = await rest('owner', 'GET', 'ai_usage_ledger', null, '?run_id=eq.' + runId)
assert.equal(usage.data.length, 1)
assert.equal(usage.data[0].billing_kind, 'mock')
assert.equal(usage.data[0].amount_minor, 0)
console.log('PASS Mock worker succeeded with mock usage ledger')

const outsider = await rest('outsider', 'GET', 'ai_runs', null, '?id=eq.' + runId)
assert.equal(outsider.data.length, 0)
const editorRead = await rest('editor', 'GET', 'ai_runs', null, '?id=eq.' + runId)
assert.equal(editorRead.data.length, 1)
console.log('PASS RLS isolation for ai_runs')

// Stale failure path on a new run.
runPsqlSeed([
  `update public.documents set content = content || ' [fb stale]', updated_at = now() where id = '${assertUuid(docIds[0], 'd0')}'`,
])
const staleKey = randomUUID()
// Rebuild manifest for a second contract so enqueue can pass freshness, then stale before process.
const recoveredManifest = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: docIds,
  p_request_key: randomUUID(),
})
assert(recoveredManifest.ok)
const draft2 = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: '두 번째 검수 업무를 실행합니다.',
  p_acceptance_criteria: 'stale 검증',
  p_audit_manifest_id: recoveredManifest.data,
  p_budget_cap_minor: 0,
  p_client_request_id: randomUUID(),
  p_expires_at: null,
})
const accepted2 = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: draft2.data.id,
  p_expected_version: draft2.data.version,
  p_consent_statement: 'Mock 실행만 승인하며 유료 LLM을 호출하지 않습니다.',
})
const queued2 = await rpc('owner', 'enqueue_ai_run', {
  p_contract_id: accepted2.data.id,
  p_idempotency_key: staleKey,
})
assert(queued2.ok)
runPsqlSeed([
  `update public.documents set content = content || ' [fb mid-run]', updated_at = now() where id = '${assertUuid(docIds[0], 'd0b')}'`,
])
const failed = await rpc('owner', 'process_mock_ai_run', { p_run_id: queued2.data.id })
assert(failed.ok && failed.data.status === 'failed' && failed.data.error_code === 'STALE_SOURCE',
  'stale mid-run: ' + JSON.stringify(failed.data))
console.log('PASS mid-run stale → failed with consistent status')

// Retry blocked while stale; rebuild then retry.
const retryBlocked = await rpc('owner', 'retry_failed_ai_run', {
  p_run_id: queued2.data.id,
  p_expected_version: failed.data.version,
})
assert(!retryBlocked.ok && retryBlocked.data?.code === 'P4001')
const rebuilt = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: docIds,
  p_request_key: randomUUID(),
})
assert(rebuilt.ok)
// Contract still points at old stale manifest — retry checks run.manifest_id freshness.
// So retry should still fail until we can't change manifest on run; that's correct.
// Create a fresh contract+run for recovery success path instead.
const draft3 = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: '복구 후 세 번째 검수 업무입니다.',
  p_acceptance_criteria: '성공해야 함',
  p_audit_manifest_id: rebuilt.data,
  p_budget_cap_minor: 0,
  p_client_request_id: randomUUID(),
  p_expires_at: null,
})
const accepted3 = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: draft3.data.id,
  p_expected_version: draft3.data.version,
  p_consent_statement: 'Mock 실행만 승인하며 유료 LLM을 호출하지 않습니다.',
})
const queued3 = await rpc('owner', 'enqueue_ai_run', {
  p_contract_id: accepted3.data.id,
  p_idempotency_key: randomUUID(),
})
const ok3 = await rpc('owner', 'process_mock_ai_run', { p_run_id: queued3.data.id })
assert(ok3.ok && ok3.data.status === 'succeeded')
console.log('PASS recovery with fresh manifest succeeds')

const direct = await rest('owner', 'POST', 'ai_runs', {
  project_id: projectOne,
  contract_id: accepted.data.id,
  created_by: people.owner.id,
  idempotency_key: randomUUID(),
  status: 'succeeded',
  terms_version: 'x',
  terms_digest: 'sha256:' + 'b'.repeat(64),
  manifest_id: manifestId,
})
assert(!direct.ok, 'direct insert denied')
console.log('PASS direct ai_runs write denied')

console.log('SUCCESS F-B ai_runs Mock worker over genuine Supabase Auth/JWT/PostgREST')
