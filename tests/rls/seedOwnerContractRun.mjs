// Shared Auth/JWT seed: policy doc → S2 manifest → active contract → succeeded Mock run.
import { randomUUID } from 'node:crypto'
import { assertUuid } from '../helpers/rest.mjs'
import { runPsqlSeed } from '../helpers/psql.mjs'

const CONSENT = 'Mock 실행만 승인하며 유료 LLM을 호출하지 않습니다.'

export async function ensurePolicyDocument(rest, projectId, content) {
  runPsqlSeed([
    `insert into public.documents(project_id,type,content)
     select '${projectId}','policy','${content.replace(/'/g, "''")}'
     where not exists (
       select 1 from public.documents where project_id='${projectId}' and type='policy'
     )`,
  ])
  const docs = await rest('owner', 'GET', 'documents', null,
    '?project_id=eq.' + projectId + '&select=id&order=type')
  return docs.data.slice(0, 2).map((d) => d.id)
}

export async function createActiveContract(rpc, {
  projectId,
  task,
  acceptanceCriteria,
  docIds,
}) {
  const manifest = await rpc('owner', 'create_audit_source_manifest', {
    p_project_id: projectId,
    p_document_ids: docIds,
    p_request_key: randomUUID(),
  })
  const draft = await rpc('owner', 'create_agent_contract_draft', {
    p_project_id: projectId,
    p_task: task,
    p_acceptance_criteria: acceptanceCriteria,
    p_audit_manifest_id: manifest.data,
    p_budget_cap_minor: 0,
    p_client_request_id: randomUUID(),
    p_expires_at: null,
  })
  const accepted = await rpc('owner', 'accept_agent_contract', {
    p_contract_id: draft.data.id,
    p_expected_version: draft.data.version,
    p_consent_statement: CONSENT,
  })
  return { manifest, draft, accepted, manifestId: assertUuid(manifest.data, 'manifest') }
}

export async function enqueueAndSucceedMockRun(rpc, contractId) {
  const queued = await rpc('owner', 'enqueue_ai_run', {
    p_contract_id: contractId,
    p_idempotency_key: randomUUID(),
  })
  const run = await rpc('owner', 'process_mock_ai_run', { p_run_id: queued.data.id })
  return { queued, run }
}
