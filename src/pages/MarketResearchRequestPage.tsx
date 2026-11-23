import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MarketResearchReportView } from '../components/ai/MarketResearchReportView'
import { ResearchPrdApplyModal } from '../components/ai/ResearchPrdApplyModal'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import { ensureResearchAuditManifest } from '../lib/ensureResearchAuditManifest'
import {
  MARKET_RESEARCHER,
  MARKET_RESEARCH_BUDGET_CAP_MINOR,
  MARKET_RESEARCH_CONSENT_STATEMENT,
  validateMarketResearchInput,
  type ResearchDepth,
  type ResearchRegion,
} from '../lib/marketResearchStaff'
import {
  acceptAgentContract,
  createMarketResearchContractDraft,
  listProjectAgentContracts,
  type AgentContractRow,
  AgentContractAccessError,
  AgentContractConflictError,
} from '../lib/api/agentContracts'
import { AuditManifestStaleError } from '../lib/api/auditManifests'
import {
  enqueueForCrewAiWorker,
  listProjectAiRuns,
  type AiRunRow,
  AiRunConflictError,
} from '../lib/api/aiRuns'
import {
  decideAiArtifact,
  listProjectAiArtifacts,
  publishAiArtifactFromRun,
  type AiArtifactRow,
} from '../lib/api/aiArtifacts'

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0')
}

function runStatusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return '대기 중 (워커 처리 대기)'
    case 'running':
    case 'claimed':
    case 'validating':
      return '조사 중…'
    case 'succeeded':
      return '조사 완료'
    case 'failed':
      return '실패 — 다시 조사 시작을 눌러 주세요'
    default:
      return status
  }
}

function isInFlight(status: string | undefined): boolean {
  return status === 'queued' || status === 'running' || status === 'claimed' || status === 'validating'
}

function marketResearchRuns(runs: AiRunRow[], contractId: string | null): AiRunRow[] {
  const forContract = contractId ? runs.filter((r) => r.contract_id === contractId) : []
  const bySlug = runs.filter(
    (r) => (r.result_json as { agentSlug?: string } | null)?.agentSlug === MARKET_RESEARCHER.id,
  )
  if (forContract.length > 0 || bySlug.length > 0) {
    const ids = new Set([...forContract, ...bySlug].map((r) => r.id))
    return runs.filter((r) => ids.has(r.id))
  }
  return runs
}

function pickSucceededReport(runs: AiRunRow[], contractId: string | null): AiRunRow | null {
  return (
    marketResearchRuns(runs, contractId).find((r) => r.status === 'succeeded' && r.result_json) ??
    null
  )
}

function pickActiveRun(runs: AiRunRow[], contractId: string | null): AiRunRow | null {
  const pool = marketResearchRuns(runs, contractId)
  return pool.find((r) => isInFlight(r.status)) ?? pool.find((r) => r.status === 'failed') ?? null
}

export default function MarketResearchRequestPage() {
  const { projectId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const [researchTarget, setResearchTarget] = useState('반려동물 예약 서비스 경쟁시장 조사')
  const [region, setRegion] = useState<ResearchRegion>('KR')
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>('standard')
  const [task, setTask] = useState(
    '공개 정보만으로 경쟁사 3~5곳, 기능·가격, 고객 문제, 시장 기회를 조사하세요.',
  )
  const [criteria, setCriteria] = useState('출처 URL이 포함된 구조화 시장조사 보고서')
  const [consentChecked, setConsentChecked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [serverContract, setServerContract] = useState<AgentContractRow | null>(null)
  const [serverRun, setServerRun] = useState<AiRunRow | null>(null)
  const [reportRun, setReportRun] = useState<AiRunRow | null>(null)
  const [artifact, setArtifact] = useState<AiArtifactRow | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const showToast = useUIStore((s) => s.showToast)

  const applyRuns = (runs: AiRunRow[], contractId: string | null) => {
    setReportRun(pickSucceededReport(runs, contractId))
    setServerRun(pickActiveRun(runs, contractId) ?? pickSucceededReport(runs, contractId))
  }

  const owner = Boolean(
    projectId &&
      userId &&
      currentProject?.id === projectId &&
      !currentProject.deleted_at &&
      currentProject.user_id === userId,
  )

  useEffect(() => {
    let mounted = true
    if (!projectId || !userId) return
    void setCurrentProject(projectId)
      .then(async () => {
        if (!mounted) return
        try {
          await ensureResearchAuditManifest(projectId)
        } catch {
          /* save path will retry */
        }
        try {
          const rows = await listProjectAgentContracts(projectId)
          if (!mounted) return
          const latest =
            rows.find((r) => r.agent_slug === MARKET_RESEARCHER.id) ??
            rows.find((r) => r.scope_json?.agentSlug === MARKET_RESEARCHER.id) ??
            null
          setServerContract(latest)
          const runs = await listProjectAiRuns(projectId)
          if (!mounted) return
          applyRuns(runs, latest?.id ?? null)
          const arts = await listProjectAiArtifacts(projectId)
          if (!mounted) return
          setArtifact(arts[0] ?? null)
        } catch {
          /* disposable DB without tables — keep form usable */
        }
      })
      .catch(() => {
        if (mounted) setError('프로젝트를 불러올 수 없습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [projectId, userId, setCurrentProject])

  useEffect(() => {
    if (!projectId || !isInFlight(serverRun?.status)) return
    let cancelled = false
    const tick = async () => {
      try {
        const runs = await listProjectAiRuns(projectId)
        if (cancelled) return
        const contractId = serverContract?.id ?? null
        applyRuns(runs, contractId)
        const report = pickSucceededReport(runs, contractId)
        const active = pickActiveRun(runs, contractId)
        if (report?.result_json) {
          setNotice('조사 결과가 준비되었습니다. 아래 보고서를 확인하세요.')
        }
        if (active?.status === 'failed') {
          setError(active.error_message || '조사에 실패했습니다. 다시 시도해 주세요.')
        }
      } catch {
        /* keep polling */
      }
    }
    const id = window.setInterval(() => void tick(), 4000)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [projectId, serverRun?.status, serverRun?.id, serverContract?.id])

  const mapError = (e: unknown) => {
    if (e instanceof AuditManifestStaleError) return e.message
    if (e instanceof AgentContractAccessError) return e.message
    if (e instanceof AgentContractConflictError) return e.message
    if (e instanceof AiRunConflictError) return e.message
    return e instanceof Error ? e.message : '요청을 처리하지 못했습니다.'
  }

  /** One click: draft → owner accept → queue (backend steps stay distinct). */
  const startResearch = async () => {
    if (!owner || !projectId) return
    const invalid = validateMarketResearchInput({
      researchTarget,
      task,
      acceptanceCriteria: criteria,
      region,
      researchDepth,
    })
    if (invalid) {
      setError(invalid)
      return
    }
    if (!consentChecked) {
      setError('아래 동의 항목을 체크해 주세요.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const ensured = await ensureResearchAuditManifest(projectId)
      let contract = serverContract

      const needsNewDraft =
        !contract ||
        contract.status === 'revoked' ||
        contract.status === 'expired' ||
        (contract.status === 'active' && serverRun?.status === 'succeeded')

      if (needsNewDraft || contract?.status === 'draft') {
        if (needsNewDraft || !contract) {
          contract = await createMarketResearchContractDraft({
            projectId,
            task,
            acceptanceCriteria: criteria,
            auditManifestId: ensured.manifestId,
            clientRequestId: newRequestId(),
            researchTarget,
            region,
            researchDepth,
            budgetCapMinor: MARKET_RESEARCH_BUDGET_CAP_MINOR,
          })
          setServerContract(contract)
        }
        if (contract.status === 'draft') {
          contract = await acceptAgentContract(
            contract.id,
            contract.version,
            MARKET_RESEARCH_CONSENT_STATEMENT,
          )
          setServerContract(contract)
        }
      }

      if (!contract || contract.status !== 'active') {
        throw new Error('조사를 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.')
      }

      const run = await enqueueForCrewAiWorker(contract.id, newRequestId())
      setServerRun(run)
      setNotice('조사를 큐에 넣었습니다. 워커가 처리하면 아래에 보고서가 나타납니다.')
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    if (!projectId) return
    setBusy(true)
    setError('')
    try {
      const runs = await listProjectAiRuns(projectId)
      applyRuns(runs, serverContract?.id ?? null)
      const arts = await listProjectAiArtifacts(projectId)
      setArtifact(arts[0] ?? null)
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    const target = reportRun?.status === 'succeeded' ? reportRun : serverRun
    if (!owner || !target || target.status !== 'succeeded') return
    setBusy(true)
    setError('')
    try {
      const published = await publishAiArtifactFromRun(target.id)
      setArtifact(published)
      setNotice('보고서를 프로젝트에 저장했습니다.')
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const decide = async (decision: 'accepted' | 'revision_requested') => {
    if (!owner || !artifact) return
    setBusy(true)
    setError('')
    try {
      const comment = decision === 'accepted' ? '시장조사 결과 수락' : '시장조사 수정 요청'
      const row = await decideAiArtifact(artifact.id, artifact.version, decision, comment)
      setArtifact(row)
      setNotice(decision === 'accepted' ? '결과를 수락했습니다.' : '수정 요청을 남겼습니다.')
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-gray-500">불러오는 중…</p>
  }

  const runInFlight = isInFlight(serverRun?.status)

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10 text-gray-900">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link to="/ai-staff" className="text-gray-500 hover:underline">
          ← AI 직원 채용
        </Link>
        {projectId && (
          <Link
            to={`/projects/${projectId}/research`}
            className="text-gray-500 hover:underline"
            data-testid="market-research-project-results"
          >
            프로젝트에서 보기
          </Link>
        )}
      </nav>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{MARKET_RESEARCHER.title}</h1>
        <p className="text-sm text-gray-600">{MARKET_RESEARCHER.description}</p>
      </header>

      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700" data-testid="market-research-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded bg-teal-50 p-3 text-teal-900">
          {notice}
        </p>
      )}

      {!owner ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-4">
          프로젝트 소유자만 시장조사를 시작할 수 있습니다.
        </p>
      ) : (
        <>
          {(serverRun || reportRun) && (
            <section
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
              data-testid="market-research-run"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">조사 결과</h2>
                  <p className="mt-1 text-sm text-gray-600" data-testid="market-research-run-status">
                    {runStatusLabel((isInFlight(serverRun?.status) ? serverRun : reportRun)?.status ?? '—')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void refresh()}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    data-testid="market-research-refresh"
                  >
                    새로고침
                  </button>
                  {reportRun?.status === 'succeeded' && projectId && (
                    <Link
                      to={`/projects/${projectId}/research`}
                      className="rounded-lg border border-teal-200 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
                    >
                      프로젝트에서 보기
                    </Link>
                  )}
                  {reportRun?.status === 'succeeded' && reportRun.result_json && (
                    <button
                      type="button"
                      disabled={!owner || busy}
                      onClick={() => setApplyOpen(true)}
                      className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
                      data-testid="market-research-apply-prd"
                    >
                      리서치 → PRD 반영
                    </button>
                  )}
                  {reportRun?.status === 'succeeded' && !artifact && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void publish()}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      data-testid="market-research-publish"
                    >
                      프로젝트에 저장
                    </button>
                  )}
                </div>
              </div>
              <p className="sr-only" data-testid="market-research-run-id">
                {(isInFlight(serverRun?.status) ? serverRun : reportRun)?.id}
              </p>
              {serverRun?.status === 'failed' && (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {serverRun.error_message || serverRun.error_code}
                </p>
              )}
              {isInFlight(serverRun?.status) && !reportRun?.result_json && (
                <p className="mt-3 text-sm text-gray-600">
                  워커가 검색을 처리 중입니다. 잠시 후 자동으로 갱신됩니다.
                </p>
              )}
              {reportRun?.result_json && (
                <div className="mt-5">
                  <MarketResearchReportView
                    resultJson={reportRun.result_json}
                    runId={reportRun.id}
                  />
                </div>
              )}
            </section>
          )}

          <section className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-5">
            <h2 className="text-sm font-semibold text-gray-800">
              {reportRun ? '새 조사 요청' : '무엇을 조사할까요?'}
            </h2>
            <label className="block text-sm">
              조사 대상
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={researchTarget}
                onChange={(e) => setResearchTarget(e.target.value)}
                data-testid="market-research-target"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                지역
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as ResearchRegion)}
                  data-testid="market-research-region"
                >
                  <option value="KR">한국</option>
                  <option value="US">미국</option>
                  <option value="GLOBAL">글로벌</option>
                </select>
              </label>
              <label className="block text-sm">
                조사 깊이
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={researchDepth}
                  onChange={(e) => setResearchDepth(e.target.value as ResearchDepth)}
                  data-testid="market-research-depth"
                >
                  <option value="standard">표준</option>
                  <option value="deep">심층 (더 오래·비용↑)</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">
              요청 내용
              <textarea
                className="mt-1 w-full rounded border px-3 py-2"
                rows={3}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                data-testid="market-research-task"
              />
            </label>
            <label className="block text-sm">
              원하는 결과
              <textarea
                className="mt-1 w-full rounded border px-3 py-2"
                rows={2}
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                data-testid="market-research-criteria"
              />
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                data-testid="market-research-consent"
              />
              <span>{MARKET_RESEARCH_CONSENT_STATEMENT}</span>
            </label>
            <p className="text-xs text-gray-500">
              웹 검색만 하며, 해커톤 크레딧 한도는 약 ${MARKET_RESEARCH_BUDGET_CAP_MINOR / 100}입니다.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void startResearch()}
              className="rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="market-research-save-draft"
            >
              {busy ? '처리 중…' : runInFlight ? '다시 조사 시작' : '조사 시작'}
            </button>
            {runInFlight && (
              <p className="text-xs text-amber-800" role="status">
                이전 조사가 아직 대기/진행 중입니다. 결과는 위쪽에서 확인하세요.
              </p>
            )}
          </section>

          {/* Keep accept/enqueue test hooks for existing specs while primary CTA is startResearch */}
          {serverContract?.status === 'draft' && (
            <button
              type="button"
              className="sr-only"
              data-testid="market-research-accept"
              onClick={() => void startResearch()}
            >
              owner 승인
            </button>
          )}
          {serverContract?.status === 'active' && (
            <button
              type="button"
              className="sr-only"
              data-testid="market-research-enqueue"
              onClick={() => void startResearch()}
            >
              큐에 넣기
            </button>
          )}
          <div className="sr-only" data-testid="market-research-contract">
            <p data-testid="market-research-contract-status">
              {serverContract
                ? `상태: ${serverContract.status} · version ${serverContract.version} · ${serverContract.agent_slug}`
                : '없음'}
            </p>
          </div>

          {artifact && (
            <section
              className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5"
              data-testid="market-research-artifact"
            >
              <h2 className="text-lg font-bold">저장된 보고서</h2>
              {artifact.content_json && (
                <div className="mt-4">
                  <MarketResearchReportView
                    resultJson={artifact.content_json}
                    runId={artifact.run_id}
                  />
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide('accepted')}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  data-testid="market-research-accept-artifact"
                >
                  결과 수락
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide('revision_requested')}
                  className="rounded-md border px-4 py-2 text-sm"
                  data-testid="market-research-revise-artifact"
                >
                  수정 요청
                </button>
              </div>
            </section>
          )}

          {projectId && reportRun?.result_json && (
            <ResearchPrdApplyModal
              open={applyOpen}
              projectId={projectId}
              reportJson={reportRun.result_json}
              canEdit={owner}
              onClose={() => setApplyOpen(false)}
              onApplied={() => showToast('success', '리서치 내용을 PRD 섹션에 반영했습니다')}
            />
          )}
        </>
      )}
    </main>
  )
}
