import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import {
  MOCK_SPECIALIST,
  createMockDraft,
  previewMockContract,
  getMockBudgetReview,
  type MockRequest,
  type MockContractReview,
} from '../lib/mockSpecialistRequest'
import { buildHandoffFromDraft, writeSpecialistReviewHandoff } from '../lib/specialistReviewHandoff'
import { loadProjectManifest } from '../lib/s2ManifestSession'
import {
  AGENT_CONTRACT_CONSENT_STATEMENT,
  AGENT_CONTRACT_TERMS_SUMMARY,
  AGENT_CONTRACT_TERMS_VERSION,
  MOCK_BUDGET_CAP_MINOR,
} from '../lib/agentContractTerms'
import {
  acceptAgentContract,
  createAgentContractDraft,
  listAgentContractEvents,
  listProjectAgentContracts,
  revokeAgentContract,
  type AgentContractEventRow,
  type AgentContractRow,
  AgentContractAccessError,
  AgentContractConflictError,
} from '../lib/api/agentContracts'
import { AuditManifestStaleError } from '../lib/api/auditManifests'
import {
  enqueueAndProcessMockRun,
  listAiRunEvents,
  listAiUsageForRun,
  listProjectAiRuns,
  processMockAiRun,
  retryFailedAiRun,
  type AiRunEventRow,
  type AiRunRow,
  type AiUsageLedgerRow,
  AiRunConflictError,
} from '../lib/api/aiRuns'
import {
  decideAiArtifact,
  listAiArtifactEvents,
  listProjectAiArtifacts,
  publishAiArtifactFromRun,
  type AiArtifactEventRow,
  type AiArtifactRow,
} from '../lib/api/aiArtifacts'

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0')
}

const fixtureMode = import.meta.env.DEV && import.meta.env.VITE_S3_E2E_FIXTURE === 'true'

function decisionComment(decision: 'accepted' | 'rejected' | 'revision_requested'): string {
  if (decision === 'accepted') return '결과 수락 및 S1 연결'
  if (decision === 'rejected') return '결과 반려'
  return '수정 요청'
}

export default function SpecialistRequestMockPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const [task, setTask] = useState('')
  const [criteria, setCriteria] = useState('')
  const [draft, setDraft] = useState<MockRequest | null>(null)
  const [error, setError] = useState('')
  const [noticeRead, setNoticeRead] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [contractPreview, setContractPreview] = useState<MockContractReview | null>(null)
  const budgetReview = contractPreview ? getMockBudgetReview(contractPreview) : null
  const [verifiedProjectId, setVerifiedProjectId] = useState<string | null>(null)
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [manifestId, setManifestId] = useState<string | null>(null)
  const [serverContract, setServerContract] = useState<AgentContractRow | null>(null)
  const [events, setEvents] = useState<AgentContractEventRow[]>([])
  const [busy, setBusy] = useState(false)
  const [clientRequestId, setClientRequestId] = useState(() => newRequestId())
  const [runIdempotencyKey, setRunIdempotencyKey] = useState(() => newRequestId())
  const [serverRun, setServerRun] = useState<AiRunRow | null>(null)
  const [runEvents, setRunEvents] = useState<AiRunEventRow[]>([])
  const [usageRows, setUsageRows] = useState<AiUsageLedgerRow[]>([])
  const [artifact, setArtifact] = useState<AiArtifactRow | null>(null)
  const [artifactEvents, setArtifactEvents] = useState<AiArtifactEventRow[]>([])

  useEffect(() => {
    let mounted = true
    if (!projectId || !userId) return
    void setCurrentProject(projectId)
      .then(() => {
        if (!mounted) return
        setVerifiedProjectId(projectId)
        setVerifiedUserId(userId)
        const stored = loadProjectManifest(projectId)
        setManifestId(stored?.manifestId ?? null)
      })
      .catch(() => {
        if (mounted) {
          setVerifiedProjectId(null)
          setVerifiedUserId(null)
          setError('프로젝트를 불러올 수 없습니다.')
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [projectId, userId, setCurrentProject])

  useEffect(() => {
    let mounted = true
    if (!projectId || !userId || verifiedProjectId !== projectId) return
    if (fixtureMode) return
    void listProjectAgentContracts(projectId)
      .then(async (rows) => {
        if (!mounted) return
        const latest = rows[0] ?? null
        setServerContract(latest)
        if (latest) {
          const ev = await listAgentContractEvents(latest.id)
          if (mounted) setEvents(ev)
        } else {
          setEvents([])
        }
        const runs = await listProjectAiRuns(projectId)
        if (!mounted) return
        const latestRun = runs[0] ?? null
        setServerRun(latestRun)
        if (latestRun) {
          const [re, usage] = await Promise.all([
            listAiRunEvents(latestRun.id),
            listAiUsageForRun(latestRun.id),
          ])
          if (mounted) {
            setRunEvents(re)
            setUsageRows(usage)
          }
        } else {
          setRunEvents([])
          setUsageRows([])
        }
        const arts = await listProjectAiArtifacts(projectId)
        if (!mounted) return
        const latestArt = arts[0] ?? null
        setArtifact(latestArt)
        if (latestArt) {
          const aev = await listAiArtifactEvents(latestArt.id)
          if (mounted) setArtifactEvents(aev)
        } else {
          setArtifactEvents([])
        }
      })
      .catch(() => {
        if (mounted) {
          setEvents([])
          setRunEvents([])
          setUsageRows([])
          setArtifactEvents([])
        }
      })
    return () => {
      mounted = false
    }
  }, [projectId, userId, verifiedProjectId])

  const accessible = Boolean(
    userId &&
      projectId &&
      verifiedProjectId === projectId &&
      verifiedUserId === userId &&
      currentProject?.id === projectId &&
      !currentProject.deleted_at,
  )
  const owner = accessible && currentProject?.user_id === userId

  const mapError = (e: unknown): string => {
    if (e instanceof AuditManifestStaleError) {
      return e.message
    }
    if (e instanceof AgentContractAccessError) {
      return e.message
    }
    if (e instanceof AgentContractConflictError) {
      if (e.code === 'CONTRACT_VERSION_CONFLICT') return '계약 버전이 변경되었습니다. 새로고침 후 다시 시도하세요.'
      if (e.code === 'CONTRACT_EXPIRED') return '계약이 만료되어 승인할 수 없습니다.'
      return e.message
    }
    if (e instanceof AiRunConflictError) {
      if (e.code === 'CONTRACT_NOT_ACTIVE') return '승인된 계약이 없어 실행할 수 없습니다.'
      return e.message
    }
    return e instanceof Error ? e.message : '요청을 처리하지 못했습니다.'
  }

  const refreshRun = async (run: AiRunRow) => {
    setServerRun(run)
    setRunEvents(await listAiRunEvents(run.id))
    setUsageRows(await listAiUsageForRun(run.id))
  }

  const refreshArtifact = async (row: AiArtifactRow) => {
    setArtifact(row)
    setArtifactEvents(await listAiArtifactEvents(row.id))
  }

  const runMockWorker = async () => {
    if (!owner || !serverContract || serverContract.status !== 'active') {
      setError('승인된 서버 계약으로만 Mock worker를 실행할 수 있습니다.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const run = await enqueueAndProcessMockRun(serverContract.id, runIdempotencyKey)
      await refreshRun(run)
      if (run.status === 'succeeded') {
        setRunIdempotencyKey(newRequestId())
        const published = await publishAiArtifactFromRun(run.id)
        await refreshArtifact(published)
      } else if (run.status === 'failed') {
        setError(run.error_message ?? run.error_code ?? 'Mock 실행이 실패했습니다.')
      }
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const decideReport = async (decision: 'accepted' | 'rejected' | 'revision_requested') => {
    if (!owner || !artifact) return
    setBusy(true)
    setError('')
    try {
      const row = await decideAiArtifact(artifact.id, artifact.version, decision, decisionComment(decision))
      await refreshArtifact(row)
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const retryMockWorker = async () => {
    if (!owner || !serverRun || serverRun.status !== 'failed') return
    setBusy(true)
    setError('')
    try {
      const queued = await retryFailedAiRun(serverRun.id, serverRun.version)
      const processed = await processMockAiRun(queued.id)
      await refreshRun(processed)
      if (processed.status === 'succeeded') {
        const published = await publishAiArtifactFromRun(processed.id)
        await refreshArtifact(published)
      } else if (processed.status === 'failed') {
        setError(processed.error_message ?? processed.error_code ?? 'Mock 재시도가 실패했습니다.')
      }
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    if (!owner || !projectId) return
    try {
      setDraft(createMockDraft({ roleId: MOCK_SPECIALIST.id, projectId, task, acceptanceCriteria: criteria }))
      setContractPreview(null)
      setNoticeRead(false)
      setConsentChecked(false)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 초안을 만들지 못했습니다.')
    }
  }

  const reset = () => {
    setTask('')
    setCriteria('')
    setDraft(null)
    setContractPreview(null)
    setNoticeRead(false)
    setConsentChecked(false)
    setError('')
    setClientRequestId(newRequestId())
  }

  const reviewContract = () => {
    if (!draft) return
    try {
      setContractPreview(previewMockContract(draft, noticeRead))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '검토 화면을 열 수 없습니다.')
    }
  }

  const saveServerDraft = async () => {
    if (!owner || !projectId || !draft || !manifestId) {
      setError('서버 계약 초안을 만들려면 S2 문서 manifest가 필요합니다. 기획 검수 문서 선택에서 먼저 저장하세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const row = await createAgentContractDraft({
        projectId,
        task: draft.task,
        acceptanceCriteria: draft.acceptanceCriteria,
        auditManifestId: manifestId,
        clientRequestId,
        budgetCapMinor: MOCK_BUDGET_CAP_MINOR,
      })
      setServerContract(row)
      setEvents(await listAgentContractEvents(row.id))
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const acceptServerContract = async () => {
    if (!owner || !serverContract || serverContract.status !== 'draft') return
    if (!consentChecked) {
      setError('명시적 동의 문구를 확인해야 승인할 수 있습니다.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const row = await acceptAgentContract(
        serverContract.id,
        serverContract.version,
        AGENT_CONTRACT_CONSENT_STATEMENT,
      )
      setServerContract(row)
      setEvents(await listAgentContractEvents(row.id))
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const revokeServerContract = async () => {
    if (!owner || !serverContract || serverContract.status !== 'active') return
    setBusy(true)
    setError('')
    try {
      const row = await revokeAgentContract(serverContract.id, serverContract.version, 'owner revoke')
      setServerContract(row)
      setEvents(await listAgentContractEvents(row.id))
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const continueToMockReview = () => {
    if (!projectId) return
    const activeContract = serverContract?.status === 'active' ? serverContract : null
    if (!fixtureMode && !activeContract) {
      setError('Mock 검수로 이어가려면 서버 계약을 승인해야 합니다.')
      return
    }
    try {
      const handoffDraft =
        draft ??
        (activeContract
          ? createMockDraft({
              roleId: MOCK_SPECIALIST.id,
              projectId,
              task: String(activeContract.scope_json?.task ?? ''),
              acceptanceCriteria: String(activeContract.scope_json?.acceptanceCriteria ?? ''),
            })
          : null)
      if (!handoffDraft) {
        setError('이어갈 요청 초안이 없습니다.')
        return
      }
      writeSpecialistReviewHandoff(buildHandoffFromDraft(handoffDraft))
      navigate(`/projects/${projectId}/ai-review${activeContract ? `?contract=${activeContract.id}` : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '검수 화면으로 이어갈 수 없습니다.')
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-gray-900">
      <nav className="mb-6 text-sm">
        <Link to={projectId ? `/projects/${projectId}` : '/projects'} className="text-blue-700 underline">
          프로젝트로 돌아가기
        </Link>
      </nav>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">AI 인력사무소 · F-A 서버 계약</p>
        <h1 className="mt-2 text-3xl font-bold">전문가에게 업무 요청하기</h1>
        <p className="mt-3 text-sm text-gray-600">
          계약 초안·명시적 동의는 서버에 저장됩니다. 유료 LLM·실공급사 과금은 없습니다. Mock worker 실행은 승인된 계약만
          허용됩니다.
        </p>
      </div>

      {loading && projectId && userId && verifiedProjectId !== projectId ? (
        <p role="status">프로젝트 권한을 확인하고 있습니다.</p>
      ) : !accessible ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          프로젝트에 접근할 수 없거나 삭제된 프로젝트입니다.
        </div>
      ) : !owner ? (
        <div className="space-y-4">
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            현재 Mock 업무 요청은 프로젝트 소유자만 작성할 수 있습니다. 멤버는 저장된 계약 조회만 가능합니다.
          </div>
          {serverContract && (
            <section
              role="status"
              aria-label="서버 계약 조회"
              className="rounded-xl border border-slate-300 bg-slate-50 p-5"
              data-testid="server-contract-panel"
            >
              <h2 className="text-lg font-bold">서버 계약 (읽기 전용)</h2>
              <p className="mt-2 text-sm" data-testid="server-contract-status">
                상태: {serverContract.status} · version {serverContract.version}
              </p>
              <p className="mt-1 text-xs" data-testid="server-contract-id">
                ID: {serverContract.id}
              </p>
            </section>
          )}
        </div>
      ) : (
        <>
          <section aria-label="선택된 전문가" className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="text-xs font-semibold text-indigo-700">선택된 전문가 · requirements_auditor_v1</p>
            <h2 className="mt-2 text-xl font-semibold">{MOCK_SPECIALIST.title}</h2>
            <p className="mt-2 text-sm">{MOCK_SPECIALIST.description}</p>
            <p className="mt-2 text-sm font-medium text-indigo-900">Mock 실행만 가능 · 유료 LLM 금지</p>
            <p className="mt-2 text-xs text-gray-600">
              약관 버전: {AGENT_CONTRACT_TERMS_VERSION} · Mock 예산 상한: {MOCK_BUDGET_CAP_MINOR} (KRW minor, 결제 아님)
            </p>
            <p className="mt-2 text-xs text-gray-700">
              S2 manifest:{' '}
              {manifestId ? (
                <span data-testid="contract-manifest-id">{manifestId}</span>
              ) : (
                <>
                  없음 —{' '}
                  <Link className="underline" to={`/projects/${projectId}/audits/new`}>
                    문서 선택에서 저장
                  </Link>
                </>
              )}
            </p>
          </section>

          {serverContract && (
            <section
              role="status"
              aria-label="서버 계약 상태"
              className="mb-6 rounded-xl border border-slate-300 bg-slate-50 p-5"
              data-testid="server-contract-panel"
            >
              <h2 className="text-lg font-bold">서버 계약</h2>
              <p className="mt-2 text-sm" data-testid="server-contract-status">
                상태: {serverContract.status} · version {serverContract.version}
              </p>
              <p className="mt-1 text-xs text-gray-600" data-testid="server-contract-id">
                ID: {serverContract.id}
              </p>
              <p className="mt-1 text-xs break-all">terms_digest: {serverContract.terms_digest}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-700">
                {AGENT_CONTRACT_TERMS_SUMMARY.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {events.length > 0 && (
                <ol className="mt-3 space-y-1 text-xs" data-testid="server-contract-events">
                  {events.map((ev) => (
                    <li key={ev.id}>
                      {ev.event_type}
                      {ev.comment ? ` · ${ev.comment}` : ''}
                    </li>
                  ))}
                </ol>
              )}
              {serverContract.status === 'draft' && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      data-testid="contract-consent-check"
                    />
                    <span>{AGENT_CONTRACT_CONSENT_STATEMENT}</span>
                  </label>
                  <button
                    type="button"
                    disabled={busy || !consentChecked}
                    onClick={() => void acceptServerContract()}
                    className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    data-testid="contract-accept"
                  >
                    서버 계약 승인
                  </button>
                </div>
              )}
              {serverContract.status === 'active' && (
                <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runMockWorker()}
                    className="rounded-md bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    data-testid="mock-worker-run"
                  >
                    Mock worker 서버 실행
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={continueToMockReview}
                    className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                    data-testid="specialist-continue-ai-review"
                  >
                    (레거시) 세션 검수 화면으로 이어가기
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revokeServerContract()}
                    className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                    data-testid="contract-revoke"
                  >
                    계약 철회
                  </button>
                </div>
              )}
            </section>
          )}

          {serverRun && (
            <section
              role="status"
              aria-label="서버 실행 상태"
              className="mb-6 rounded-xl border border-violet-300 bg-violet-50 p-5"
              data-testid="server-run-panel"
            >
              <h2 className="text-lg font-bold">서버 실행 (F-B)</h2>
              <p className="mt-2 text-sm" data-testid="server-run-status">
                상태: {serverRun.status} · attempt {serverRun.attempt} · version {serverRun.version}
              </p>
              <p className="mt-1 text-xs" data-testid="server-run-id">
                ID: {serverRun.id}
              </p>
              {serverRun.error_code && (
                <p className="mt-2 text-sm text-red-700" role="alert">
                  {serverRun.error_code}: {serverRun.error_message}
                </p>
              )}
              {serverRun.status === 'succeeded' && serverRun.result_json && (
                <pre
                  className="mt-3 max-h-48 overflow-auto rounded border bg-white p-3 text-xs"
                  data-testid="server-run-result"
                >
                  {JSON.stringify(serverRun.result_json, null, 2)}
                </pre>
              )}
              {runEvents.length > 0 && (
                <ol className="mt-3 space-y-1 text-xs" data-testid="server-run-events">
                  {runEvents.map((ev) => (
                    <li key={ev.id}>
                      {ev.event_type}
                      {ev.detail ? ` · ${ev.detail}` : ''}
                    </li>
                  ))}
                </ol>
              )}
              {usageRows.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs" data-testid="server-run-usage">
                  {usageRows.map((u) => (
                    <li key={u.id}>
                      {u.billing_kind}/{u.entry_type} · amount_minor={u.amount_minor} · {u.provider_ref}
                    </li>
                  ))}
                </ul>
              )}
              {serverRun.status === 'failed' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void retryMockWorker()}
                  className="mt-4 rounded-md bg-violet-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  data-testid="mock-worker-retry"
                >
                  실패 실행 재시도
                </button>
              )}
            </section>
          )}

          {artifact && (
            <section
              role="status"
              aria-label="서버 보고서"
              className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-5"
              data-testid="server-artifact-panel"
            >
              <h2 className="text-lg font-bold">서버 보고서 · 사람 수락 (F-C)</h2>
              <p className="mt-2 text-sm" data-testid="server-artifact-status">
                상태: {artifact.status} · version {artifact.version}
              </p>
              <p className="mt-1 text-xs break-all" data-testid="server-artifact-id">
                ID: {artifact.id} · digest {artifact.content_digest}
              </p>
              {artifact.linked_task_id && projectId && (
                <p className="mt-2 text-sm" data-testid="server-artifact-task">
                  S1 연결 업무:{' '}
                  <Link className="underline" to={`/projects/${projectId}/tasks/${artifact.linked_task_id}`}>
                    {artifact.linked_task_id}
                  </Link>
                </p>
              )}
              {artifactEvents.length > 0 && (
                <ol className="mt-3 space-y-1 text-xs" data-testid="server-artifact-events">
                  {artifactEvents.map((ev) => (
                    <li key={ev.id}>
                      {ev.event_type}
                      {ev.comment ? ` · ${ev.comment}` : ''}
                      {ev.linked_task_id ? ` · task ${ev.linked_task_id.slice(0, 8)}` : ''}
                    </li>
                  ))}
                </ol>
              )}
              {(artifact.status === 'published' || artifact.status === 'revision_requested') && (
                <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decideReport('accepted')}
                    className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                    data-testid="artifact-accept"
                  >
                    결과 수락 · S1 연결
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decideReport('revision_requested')}
                    className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                    data-testid="artifact-revision"
                  >
                    수정 요청
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decideReport('rejected')}
                    className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-800 disabled:opacity-50"
                    data-testid="artifact-reject"
                  >
                    반려
                  </button>
                </div>
              )}
            </section>
          )}

          <section aria-label="업무 요청 입력" className="space-y-5 rounded-xl border p-5">
            <label className="block text-sm font-semibold">
              요청할 업무
              <textarea
                className="mt-2 w-full rounded-md border p-3 font-normal"
                rows={5}
                value={task}
                maxLength={1000}
                onChange={(e) => {
                  setTask(e.target.value)
                  setDraft(null)
                  setContractPreview(null)
                }}
                placeholder="검수할 범위와 원하는 결과를 10자 이상 작성하세요."
              />
            </label>
            <label className="block text-sm font-semibold">
              완료 기준
              <textarea
                className="mt-2 w-full rounded-md border p-3 font-normal"
                rows={3}
                value={criteria}
                maxLength={500}
                onChange={(e) => {
                  setCriteria(e.target.value)
                  setDraft(null)
                  setContractPreview(null)
                }}
                placeholder="어떤 결과면 완료인지 5자 이상 작성하세요."
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={submit} className="rounded-md bg-indigo-700 px-4 py-2 font-semibold text-white">
                요청 초안 미리보기
              </button>
              <button type="button" onClick={reset} className="rounded-md border px-4 py-2">
                초기화
              </button>
            </div>
          </section>

          {contractPreview && !serverContract && (
            <section role="status" aria-label="모의 계약 검토" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
              <h2 className="font-semibold">로컬 검토 → 서버 초안</h2>
              <p>검토 상태: {contractPreview.status} · 로컬 미리보기는 실행 권한이 없습니다.</p>
              <div className="mt-3 rounded border border-amber-300 bg-white p-3">
                <h3 className="font-semibold">예상 비용·예산 검토 (Mock)</h3>
                <p>예상 비용: 산정 불가 · 최대 청구금액: 미정 · 결제: 불가</p>
                <p className="mt-1">유료 과금 없음 · Mock 상한 {MOCK_BUDGET_CAP_MINOR} KRW minor · {budgetReview?.reason}</p>
              </div>
              {!fixtureMode && (
                <button
                  type="button"
                  disabled={busy || !manifestId}
                  onClick={() => void saveServerDraft()}
                  className="mt-4 rounded-md bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                  data-testid="contract-save-draft"
                >
                  서버에 계약 초안 저장
                </button>
              )}
              {fixtureMode && (
                <button
                  type="button"
                  onClick={continueToMockReview}
                  className="mt-4 rounded-md bg-indigo-700 px-4 py-2 font-semibold text-white"
                  data-testid="specialist-continue-ai-review"
                >
                  Mock 기획 검수로 이어가기
                </button>
              )}
            </section>
          )}

          {draft && (
            <section aria-label="업무 요청 초안" className="mt-6 rounded-xl border border-green-300 bg-green-50 p-5">
              <h2 className="text-lg font-bold">요청 초안 생성됨 · 실행 대기 아님</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{draft.task}</p>
              <h3 className="mt-3 font-semibold">완료 기준</h3>
              <p className="whitespace-pre-wrap text-sm">{draft.acceptanceCriteria}</p>
              {!serverContract && (
                <div className="mt-4 border-t border-green-200 pt-4">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={noticeRead}
                      onChange={(e) => {
                        setNoticeRead(e.target.checked)
                        setContractPreview(null)
                      }}
                    />
                    유료 LLM·외부전송·실결제가 없으며, 서버 동의 후에만 Mock 실행이 가능함을 확인했습니다.
                  </label>
                  <button
                    type="button"
                    onClick={reviewContract}
                    disabled={!noticeRead}
                    className="mt-3 rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    계약 조건 모의 검토
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setDraft(null)
                  setContractPreview(null)
                  setNoticeRead(false)
                }}
                className="mt-3 rounded border px-3 py-2 text-sm"
              >
                초안 취소
              </button>
            </section>
          )}
        </>
      )}
    </main>
  )
}
