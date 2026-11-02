import { supabase } from '../supabase'
import { AgentContractAccessError, AgentContractConflictError } from './agentContracts'
import { AiRunConflictError } from './aiRuns'

export type AiArtifactStatus = 'published' | 'accepted' | 'rejected' | 'revision_requested'

export type AiArtifactRow = {
  id: string
  project_id: string
  run_id: string
  contract_id: string
  kind: string
  content_json: Record<string, unknown>
  content_digest: string
  status: AiArtifactStatus
  version: number
  linked_task_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type AiArtifactEventRow = {
  id: number
  artifact_id: string
  project_id: string
  actor_id: string | null
  event_type: string
  from_status: string | null
  to_status: string | null
  artifact_version: number
  comment: string | null
  linked_task_id: string | null
  created_at: string
}

function mapArtifactRpcFailure(error: { code?: string; message?: string } | null): never {
  const code = error?.code ?? ''
  const message = error?.message ?? ''
  const conflictHints = [
    'ARTIFACT_VERSION_CONFLICT',
    'ARTIFACT_ALREADY_DECIDED',
    'RUN_NOT_SUCCEEDED',
    'INVALID_ARTIFACT_TRANSITION',
  ]
  if (conflictHints.some((h) => message.includes(h)) || code === 'P4001') {
    const kind = message.includes('ARTIFACT_ALREADY_DECIDED')
      ? 'ARTIFACT_ALREADY_DECIDED'
      : 'ARTIFACT_CONFLICT'
    throw new AiRunConflictError(kind, message || kind)
  }
  if (code === '42501' || message.includes('NOT_ALLOWED')) {
    throw new AgentContractAccessError('보고서에 접근할 권한이 없습니다.')
  }
  if (code === 'P0002' || message.includes('NOT_FOUND')) {
    throw new AgentContractConflictError('NOT_FOUND', message || '보고서를 찾을 수 없습니다.')
  }
  throw error ?? new Error('보고서 요청에 실패했습니다.')
}

function asArtifactRow(data: unknown): AiArtifactRow {
  if (!data || typeof data !== 'object') throw new Error('보고서 결과가 올바르지 않습니다.')
  const row = data as AiArtifactRow
  if (!row.id || !row.status) throw new Error('보고서 결과가 올바르지 않습니다.')
  return row
}

export async function publishAiArtifactFromRun(runId: string): Promise<AiArtifactRow> {
  const { data, error } = await supabase.rpc('publish_ai_artifact_from_run', { p_run_id: runId })
  if (error) mapArtifactRpcFailure(error)
  return asArtifactRow(data)
}

export async function decideAiArtifact(
  artifactId: string,
  expectedVersion: number,
  decision: 'accepted' | 'rejected' | 'revision_requested',
  comment?: string,
): Promise<AiArtifactRow> {
  const { data, error } = await supabase.rpc('decide_ai_artifact', {
    p_artifact_id: artifactId,
    p_expected_version: expectedVersion,
    p_decision: decision,
    p_comment: comment ?? null,
  })
  if (error) mapArtifactRpcFailure(error)
  return asArtifactRow(data)
}

export async function listProjectAiArtifacts(projectId: string): Promise<AiArtifactRow[]> {
  const result = await supabase
    .from('ai_artifacts')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
  if (result.error) mapArtifactRpcFailure(result.error)
  return (result.data as AiArtifactRow[]) ?? []
}

export async function listAiArtifactEvents(artifactId: string): Promise<AiArtifactEventRow[]> {
  const result = await supabase
    .from('ai_artifact_events')
    .select('*')
    .eq('artifact_id', artifactId)
    .order('created_at', { ascending: true })
  if (result.error) mapArtifactRpcFailure(result.error)
  return (result.data as AiArtifactEventRow[]) ?? []
}
