import { supabase } from '../supabase'
import { AuditManifestStaleError } from './auditManifests'
import {
  AGENT_CONTRACT_CONSENT_STATEMENT,
  AGENT_CONTRACT_TERMS_VERSION,
  MOCK_BUDGET_CAP_MINOR,
} from '../agentContractTerms'

export type AgentContractStatus = 'draft' | 'active' | 'revoked' | 'expired'

export type AgentContractRow = {
  id: string
  project_id: string
  agent_slug: string
  created_by: string
  client_request_id: string
  terms_version: string
  terms_digest: string
  scope_json: {
    agentSlug: string
    task: string
    acceptanceCriteria: string
    auditManifestId: string
    mockOnly: boolean
    paidLlmAllowed: boolean
  }
  audit_manifest_id: string
  budget_cap_minor: number
  currency: string
  status: AgentContractStatus
  expires_at: string | null
  accepted_by: string | null
  accepted_at: string | null
  version: number
  created_at: string
  updated_at: string
}

export type AgentContractEventRow = {
  id: number
  contract_id: string
  project_id: string
  actor_id: string | null
  event_type: 'draft_created' | 'accepted' | 'revoked' | 'expired'
  from_status: string | null
  to_status: string | null
  contract_version: number
  comment: string | null
  created_at: string
}

export class AgentContractAccessError extends Error {
  readonly status = 403
  readonly code = 'NOT_ALLOWED'

  constructor(message = '계약에 접근할 권한이 없습니다.') {
    super(message)
    this.name = 'AgentContractAccessError'
  }
}

export class AgentContractConflictError extends Error {
  readonly status = 409
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AgentContractConflictError'
    this.code = code
  }
}

function throwContractError(error: { code?: string; message?: string } | null): never {
  const code = error?.code ?? ''
  const message = error?.message ?? ''
  if (message.includes('STALE_SOURCE')) {
    throw new AuditManifestStaleError()
  }
  if (
    message.includes('CONTRACT_VERSION_CONFLICT') ||
    message.includes('INVALID_CONTRACT_TRANSITION') ||
    message.includes('CONTRACT_EXPIRED') ||
    (code === 'P4001' && !message.includes('STALE_SOURCE'))
  ) {
    const kind = message.includes('CONTRACT_EXPIRED')
      ? 'CONTRACT_EXPIRED'
      : message.includes('CONTRACT_VERSION_CONFLICT')
        ? 'CONTRACT_VERSION_CONFLICT'
        : 'INVALID_CONTRACT_TRANSITION'
    throw new AgentContractConflictError(kind, message || kind)
  }
  if (
    code === '42501' ||
    message.includes('NOT_ALLOWED') ||
    message.includes('ONLY_OWNER_MAY_ACCEPT') ||
    message.includes('ONLY_OWNER_MAY_REVOKE')
  ) {
    throw new AgentContractAccessError()
  }
  if (code === 'P0002' || message.includes('CONTRACT_NOT_FOUND')) {
    throw new AgentContractConflictError('CONTRACT_NOT_FOUND', '계약을 찾을 수 없습니다.')
  }
  throw error ?? new Error('계약 요청에 실패했습니다.')
}

function parseContract(data: unknown): AgentContractRow {
  if (!data || typeof data !== 'object') {
    throw new Error('계약 결과가 올바르지 않습니다.')
  }
  const row = data as AgentContractRow
  if (!row.id || !row.status || typeof row.version !== 'number') {
    throw new Error('계약 결과가 올바르지 않습니다.')
  }
  return row
}

export async function createAgentContractDraft(input: {
  projectId: string
  task: string
  acceptanceCriteria: string
  auditManifestId: string
  clientRequestId: string
  budgetCapMinor?: number
  expiresAt?: string | null
}): Promise<AgentContractRow> {
  const { data, error } = await supabase.rpc('create_agent_contract_draft', {
    p_project_id: input.projectId,
    p_task: input.task,
    p_acceptance_criteria: input.acceptanceCriteria,
    p_audit_manifest_id: input.auditManifestId,
    p_budget_cap_minor: input.budgetCapMinor ?? MOCK_BUDGET_CAP_MINOR,
    p_client_request_id: input.clientRequestId,
    p_expires_at: input.expiresAt ?? null,
  })
  if (error) throwContractError(error)
  return parseContract(data)
}

export async function acceptAgentContract(
  contractId: string,
  expectedVersion: number,
  consentStatement: string = AGENT_CONTRACT_CONSENT_STATEMENT,
): Promise<AgentContractRow> {
  const { data, error } = await supabase.rpc('accept_agent_contract', {
    p_contract_id: contractId,
    p_expected_version: expectedVersion,
    p_consent_statement: consentStatement,
  })
  if (error) throwContractError(error)
  return parseContract(data)
}

export async function revokeAgentContract(
  contractId: string,
  expectedVersion: number,
  comment?: string,
): Promise<AgentContractRow> {
  const { data, error } = await supabase.rpc('revoke_agent_contract', {
    p_contract_id: contractId,
    p_expected_version: expectedVersion,
    p_comment: comment ?? null,
  })
  if (error) throwContractError(error)
  return parseContract(data)
}

export async function listProjectAgentContracts(projectId: string): Promise<AgentContractRow[]> {
  const { data, error } = await supabase
    .from('agent_contracts')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
  if (error) throwContractError(error)
  return (data as AgentContractRow[]) ?? []
}

export async function listAgentContractEvents(contractId: string): Promise<AgentContractEventRow[]> {
  const { data, error } = await supabase
    .from('agent_contract_events')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })
  if (error) throwContractError(error)
  return (data as AgentContractEventRow[]) ?? []
}

export { AGENT_CONTRACT_TERMS_VERSION, AGENT_CONTRACT_CONSENT_STATEMENT, MOCK_BUDGET_CAP_MINOR }
