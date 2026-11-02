import { supabase } from '../supabase'
import { AuditManifestStaleError } from './auditManifests'
import { AgentContractAccessError, AgentContractConflictError } from './agentContracts'

export type AiRunStatus =
  | 'queued'
  | 'running'
  | 'validating'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type AiRunRow = {
  id: string
  project_id: string
  contract_id: string
  created_by: string
  idempotency_key: string
  status: AiRunStatus
  attempt: number
  version: number
  error_code: string | null
  error_message: string | null
  result_json: Record<string, unknown> | null
  terms_version: string
  terms_digest: string
  manifest_id: string
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export type AiRunEventRow = {
  id: number
  run_id: string
  project_id: string
  actor_id: string | null
  event_type: string
  from_status: string | null
  to_status: string | null
  run_version: number
  detail: string | null
  created_at: string
}

export type AiUsageLedgerRow = {
  id: number
  project_id: string
  run_id: string
  billing_kind: 'mock'
  entry_type: string
  amount_minor: number
  currency: string
  units: number
  provider_ref: string
  created_at: string
}

export class AiRunConflictError extends Error {
  readonly status = 409
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AiRunConflictError'
    this.code = code
  }
}

function throwRunError(error: { code?: string; message?: string } | null): never {
  const code = error?.code ?? ''
  const message = error?.message ?? ''
  if (message.includes('STALE_SOURCE')) {
    throw new AuditManifestStaleError()
  }
  if (
    message.includes('CONTRACT_NOT_ACTIVE') ||
    message.includes('RUN_VERSION_CONFLICT') ||
    message.includes('INVALID_RUN_TRANSITION') ||
    message.includes('RUN_CANCELLED') ||
    message.includes('RUN_FAILED_RETRY_REQUIRED') ||
    message.includes('IDEMPOTENCY_KEY_CONFLICT') ||
    code === 'P4001'
  ) {
    const kind = message.includes('CONTRACT_NOT_ACTIVE')
      ? 'CONTRACT_NOT_ACTIVE'
      : message.includes('STALE_SOURCE')
        ? 'STALE_SOURCE'
        : message.includes('RUN_VERSION_CONFLICT')
          ? 'RUN_VERSION_CONFLICT'
          : 'INVALID_RUN_TRANSITION'
    throw new AiRunConflictError(kind, message || kind)
  }
  if (code === '42501' || message.includes('NOT_ALLOWED')) {
    throw new AgentContractAccessError('실행에 접근할 권한이 없습니다.')
  }
  if (code === 'P0002' || message.includes('RUN_NOT_FOUND') || message.includes('CONTRACT_NOT_FOUND')) {
    throw new AgentContractConflictError('NOT_FOUND', message || '실행을 찾을 수 없습니다.')
  }
  throw error ?? new Error('AI 실행 요청에 실패했습니다.')
}

function parseRun(data: unknown): AiRunRow {
  if (!data || typeof data !== 'object') throw new Error('실행 결과가 올바르지 않습니다.')
  const row = data as AiRunRow
  if (!row.id || !row.status) throw new Error('실행 결과가 올바르지 않습니다.')
  return row
}

export async function enqueueAiRun(contractId: string, idempotencyKey: string): Promise<AiRunRow> {
  const { data, error } = await supabase.rpc('enqueue_ai_run', {
    p_contract_id: contractId,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throwRunError(error)
  return parseRun(data)
}

/** Mock worker step: advances queued→…→succeeded on the server (no paid LLM). */
export async function processMockAiRun(runId: string): Promise<AiRunRow> {
  const { data, error } = await supabase.rpc('process_mock_ai_run', { p_run_id: runId })
  if (error) throwRunError(error)
  return parseRun(data)
}

export async function cancelAiRun(runId: string, expectedVersion: number): Promise<AiRunRow> {
  const { data, error } = await supabase.rpc('cancel_ai_run', {
    p_run_id: runId,
    p_expected_version: expectedVersion,
  })
  if (error) throwRunError(error)
  return parseRun(data)
}

export async function retryFailedAiRun(runId: string, expectedVersion: number): Promise<AiRunRow> {
  const { data, error } = await supabase.rpc('retry_failed_ai_run', {
    p_run_id: runId,
    p_expected_version: expectedVersion,
  })
  if (error) throwRunError(error)
  return parseRun(data)
}

export async function listProjectAiRuns(projectId: string): Promise<AiRunRow[]> {
  const { data, error } = await supabase
    .from('ai_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
  if (error) throwRunError(error)
  return (data as AiRunRow[]) ?? []
}

export async function listAiRunEvents(runId: string): Promise<AiRunEventRow[]> {
  const { data, error } = await supabase
    .from('ai_run_events')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
  if (error) throwRunError(error)
  return (data as AiRunEventRow[]) ?? []
}

export async function listAiUsageForRun(runId: string): Promise<AiUsageLedgerRow[]> {
  const { data, error } = await supabase
    .from('ai_usage_ledger')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
  if (error) throwRunError(error)
  return (data as AiUsageLedgerRow[]) ?? []
}

/** Enqueue then immediately drive the Mock worker to a terminal state. */
export async function enqueueAndProcessMockRun(
  contractId: string,
  idempotencyKey: string,
): Promise<AiRunRow> {
  const queued = await enqueueAiRun(contractId, idempotencyKey)
  if (queued.status === 'succeeded') return queued
  return processMockAiRun(queued.id)
}
