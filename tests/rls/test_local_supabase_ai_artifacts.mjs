// F-C: publish artifact + human accept → S1 task link over Auth/JWT/PostgREST.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  people, projectOne, anonKey, API_URL,
} from './test_local_supabase_auth.mjs'
import { createRestClient, assertUuid } from '../helpers/rest.mjs'
import {
  ensurePolicyDocument,
  createActiveContract,
  enqueueAndSucceedMockRun,
} from './seedOwnerContractRun.mjs'

const { rest, rpc } = createRestClient({ apiUrl: API_URL, anonKey, roles: people })
const docIds = await ensurePolicyDocument(rest, projectOne, 'One Project Policy for F-C artifacts')

const first = await createActiveContract(rpc, {
  projectId: projectOne,
  task: 'F-C 보고서 수락 후 S1 연결 검증입니다.',
  acceptanceCriteria: '수락 시 업무 생성',
  docIds,
})
const { run } = await enqueueAndSucceedMockRun(rpc, first.accepted.data.id)
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

const second = await createActiveContract(rpc, {
  projectId: projectOne,
  task: '두 번째 보고서는 반려합니다.',
  acceptanceCriteria: '반려 확인',
  docIds,
})
const { run: r2 } = await enqueueAndSucceedMockRun(rpc, second.accepted.data.id)
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
