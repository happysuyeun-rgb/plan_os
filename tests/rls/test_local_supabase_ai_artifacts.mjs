// F-C: publish artifact + human accept → S1 task link over Auth/JWT/PostgREST.
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
   select '${projectOne}','policy','One Project Policy for F-C artifacts'
   where not exists (
     select 1 from public.documents where project_id='${projectOne}' and type='policy'
   )`,
])
const docs = await rest('owner', 'GET', 'documents', null,
  '?project_id=eq.' + projectOne + '&select=id&order=type')
const docIds = docs.data.slice(0, 2).map((d) => d.id)
const manifest = await rpc('owner', 'create_audit_source_manifest', {
  p_project_id: projectOne,
  p_document_ids: docIds,
  p_request_key: randomUUID(),
})
const draft = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: 'F-C 보고서 수락 후 S1 연결 검증입니다.',
  p_acceptance_criteria: '수락 시 업무 생성',
  p_audit_manifest_id: manifest.data,
  p_budget_cap_minor: 0,
  p_client_request_id: randomUUID(),
  p_expires_at: null,
})
const accepted = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: draft.data.id,
  p_expected_version: draft.data.version,
  p_consent_statement: 'Mock 실행만 승인하며 유료 LLM을 호출하지 않습니다.',
})
const queued = await rpc('owner', 'enqueue_ai_run', {
  p_contract_id: accepted.data.id,
  p_idempotency_key: randomUUID(),
})
const run = await rpc('owner', 'process_mock_ai_run', { p_run_id: queued.data.id })
assert(run.ok && run.data.status === 'succeeded')

const published = await rpc('owner', 'publish_ai_artifact_from_run', { p_run_id: run.data.id })
assert(published.ok && published.data.status === 'published',
  'publish: ' + JSON.stringify(published.data))
assert.match(published.data.content_digest, /^sha256:[0-9a-f]{64}$/)
const again = await rpc('owner', 'publish_ai_artifact_from_run', { p_run_id: run.data.id })
assert(again.ok && again.data.id === published.data.id, 'idempotent publish')
console.log('PASS publish artifact separate from run succeed')

const events = await rest('owner', 'GET', 'ai_artifact_events', null,
  '?artifact_id=eq.' + published.data.id + '&order=created_at.asc')
assert.equal(events.data[0].event_type, 'published')

const editorDecide = await rpc('editor', 'decide_ai_artifact', {
  p_artifact_id: published.data.id,
  p_expected_version: published.data.version,
  p_decision: 'accepted',
  p_comment: 'nope',
})
assert(!editorDecide.ok && editorDecide.data?.code === '42501')
console.log('PASS editor cannot accept')

const acceptedArt = await rpc('owner', 'decide_ai_artifact', {
  p_artifact_id: published.data.id,
  p_expected_version: published.data.version,
  p_decision: 'accepted',
  p_comment: '결과 수락 및 S1 연결',
})
assert(acceptedArt.ok && acceptedArt.data.status === 'accepted',
  'accept: ' + JSON.stringify(acceptedArt.data))
assert(acceptedArt.data.linked_task_id, 'must link S1 task')
const taskId = assertUuid(acceptedArt.data.linked_task_id, 'task')

const task = await rest('owner', 'GET', 'project_tasks', null, '?id=eq.' + taskId)
assert.equal(task.data.length, 1)
assert.match(task.data[0].title, /AI 검수/)
console.log('PASS accept creates S1 project_task')

const ev2 = await rest('owner', 'GET', 'ai_artifact_events', null,
  '?artifact_id=eq.' + published.data.id + '&order=created_at.asc')
assert.equal(ev2.data.length, 2)
assert.equal(ev2.data[0].event_type, 'published')
assert.equal(ev2.data[1].event_type, 'accepted')
assert.equal(ev2.data[1].linked_task_id, taskId)
console.log('PASS publish and accept are separate events')

const dup = await rpc('owner', 'decide_ai_artifact', {
  p_artifact_id: published.data.id,
  p_expected_version: acceptedArt.data.version,
  p_decision: 'rejected',
  p_comment: 'too late',
})
assert(!dup.ok, 'already decided must fail')

const outsider = await rest('outsider', 'GET', 'ai_artifacts', null, '?id=eq.' + published.data.id)
assert.equal(outsider.data.length, 0)
const viewer = await rest('viewer', 'GET', 'ai_artifacts', null, '?id=eq.' + published.data.id)
assert.equal(viewer.data.length, 1)
console.log('PASS RLS isolation for artifacts')

// Reject path on a second run
const draft2 = await rpc('owner', 'create_agent_contract_draft', {
  p_project_id: projectOne,
  p_task: '두 번째 보고서는 반려합니다.',
  p_acceptance_criteria: '반려 확인',
  p_audit_manifest_id: manifest.data,
  p_budget_cap_minor: 0,
  p_client_request_id: randomUUID(),
  p_expires_at: null,
})
// manifest may still be current
const acc2 = await rpc('owner', 'accept_agent_contract', {
  p_contract_id: draft2.data.id,
  p_expected_version: draft2.data.version,
  p_consent_statement: 'Mock 실행만 승인하며 유료 LLM을 호출하지 않습니다.',
})
const q2 = await rpc('owner', 'enqueue_ai_run', {
  p_contract_id: acc2.data.id,
  p_idempotency_key: randomUUID(),
})
const r2 = await rpc('owner', 'process_mock_ai_run', { p_run_id: q2.data.id })
const p2 = await rpc('owner', 'publish_ai_artifact_from_run', { p_run_id: r2.data.id })
const rejected = await rpc('owner', 'decide_ai_artifact', {
  p_artifact_id: p2.data.id,
  p_expected_version: p2.data.version,
  p_decision: 'rejected',
  p_comment: '품질 부족',
})
assert(rejected.ok && rejected.data.status === 'rejected' && !rejected.data.linked_task_id)
console.log('PASS reject without S1 link')

console.log('SUCCESS F-C artifacts accept/reject/S1 over genuine Supabase Auth/JWT/PostgREST')
