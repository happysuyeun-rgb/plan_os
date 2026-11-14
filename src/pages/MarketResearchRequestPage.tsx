import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MarketResearchReportView } from '../components/ai/MarketResearchReportView'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { loadProjectManifest } from '../lib/s2ManifestSession'
import {
  MARKET_RESEARCHER,
  MARKET_RESEARCH_BUDGET_CAP_MINOR,
  MARKET_RESEARCH_CONSENT_STATEMENT,
  MARKET_RESEARCH_TERMS_SUMMARY,
  MARKET_RESEARCH_TERMS_VERSION,
  validateMarketResearchInput,
  type ResearchDepth,
  type ResearchRegion,
} from '../lib/marketResearchStaff'
import {
  acceptAgentContract,
  createMarketResearchContractDraft,
  listAgentContractEvents,
  listProjectAgentContracts,
  type AgentContractEventRow,
  type AgentContractRow,
  AgentContractAccessError,
  AgentContractConflictError,
} from '../lib/api/agentContracts'
import { AuditManifestStaleError } from '../lib/api/auditManifests'
import {
  enqueueForCrewAiWorker,
  listAiRunEvents,
  listProjectAiRuns,
  type AiRunEventRow,
  type AiRunRow,
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
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [manifestId, setManifestId] = useState<string | null>(null)
  const [clientRequestId, setClientRequestId] = useState(() => newRequestId())
  const [runIdempotencyKey, setRunIdempotencyKey] = useState(() => newRequestId())
  const [serverContract, setServerContract] = useState<AgentContractRow | null>(null)
  const [events, setEvents] = useState<AgentContractEventRow[]>([])
  const [serverRun, setServerRun] = useState<AiRunRow | null>(null)
  const [runEvents, setRunEvents] = useState<AiRunEventRow[]>([])
  const [artifact, setArtifact] = useState<AiArtifactRow | null>(null)
  const [artifactEvents, setArtifactEvents] = useState<AiArtifactEventRow[]>([])

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
      .then(() => {
        if (!mounted) return
        const stored = loadProjectManifest(projectId)
        setManifestId(stored?.manifestId ?? null)
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
    let mounted = true
    if (!projectId || !userId || loading) return
    void listProjectAgentContracts(projectId)
      .then(async (rows) => {
        if (!mounted) return
        const latest =
          rows.find((r) => r.agent_slug === MARKET_RESEARCHER.id) ??
          rows.find((r) => r.scope_json?.agentSlug === MARKET_RESEARCHER.id) ??
          null
        setServerContract(latest)
        if (latest) setEvents(await listAgentContractEvents(latest.id))
        const runs = await listProjectAiRuns(projectId)
        if (!mounted) return
        const latestRun =
          runs.find((r) => (r.result_json as { agentSlug?: string } | null)?.agentSlug === MARKET_RESEARCHER.id) ??
          runs[0] ??
          null
        setServerRun(latestRun)
        if (latestRun) setRunEvents(await listAiRunEvents(latestRun.id))
        const arts = await listProjectAiArtifacts(projectId)
        if (!mounted) return
        setArtifact(arts[0] ?? null)
        if (arts[0]) setArtifactEvents(await listAiArtifactEvents(arts[0].id))
      })
      .catch(() => {
        /* disposable DB without 035 may fail list — keep UI usable */
      })
    return () => {
      mounted = false
    }
  }, [projectId, userId, loading])

  const mapError = (e: unknown) => {
    if (e instanceof AuditManifestStaleError) return e.message
    if (e instanceof AgentContractAccessError) return e.message
    if (e instanceof AgentContractConflictError) return e.message
    if (e instanceof AiRunConflictError) return e.message
    return e instanceof Error ? e.message : '요청을 처리하지 못했습니다.'
  }

  const saveDraft = async () => {
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
    if (!manifestId) {
      setError('S2 문서 manifest가 필요합니다. 기획 검수에서 문서 2개 이상 선택·저장한 뒤 다시 시도하세요.')
      return
    }
    if (!consentChecked) {
      setError('약관·동의 문구를 확인해야 합니다.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const row = await createMarketResearchContractDraft({
        projectId,
        task,
        acceptanceCriteria: criteria,
        auditManifestId: manifestId,
        clientRequestId,
        researchTarget,
        region,
        researchDepth,
        budgetCapMinor: MARKET_RESEARCH_BUDGET_CAP_MINOR,
      })
      setServerContract(row)
      setEvents(await listAgentContractEvents(row.id))
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const accept = async () => {
    if (!owner || !serverContract || serverContract.status !== 'draft') return
    setBusy(true)
    setError('')
    try {
      const row = await acceptAgentContract(
        serverContract.id,
        serverContract.version,
        MARKET_RESEARCH_CONSENT_STATEMENT,
      )
      setServerContract(row)
      setEvents(await listAgentContractEvents(row.id))
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const enqueue = async () => {
    if (!owner || !serverContract || serverContract.status !== 'active') {
      setError('승인된 시장조사 계약으로만 실행을 큐에 넣을 수 있습니다.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const run = await enqueueForCrewAiWorker(serverContract.id, runIdempotencyKey)
      setServerRun(run)
      setRunEvents(await listAiRunEvents(run.id))
      setRunIdempotencyKey(newRequestId())
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
      const latestRun = runs[0] ?? null
      setServerRun(latestRun)
      setRunEvents(latestRun ? await listAiRunEvents(latestRun.id) : [])
      const arts = await listProjectAiArtifacts(projectId)
      const latestArt = arts[0] ?? null
      setArtifact(latestArt)
      setArtifactEvents(latestArt ? await listAiArtifactEvents(latestArt.id) : [])
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (!owner || !serverRun || serverRun.status !== 'succeeded') return
    setBusy(true)
    setError('')
    try {
      const published = await publishAiArtifactFromRun(serverRun.id)
      setArtifact(published)
      setArtifactEvents(await listAiArtifactEvents(published.id))
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  const decide = async (decision: 'accepted' | 'rejected' | 'revision_requested') => {
    if (!owner || !artifact) return
    setBusy(true)
    setError('')
    try {
      const comment =
        decision === 'accepted'
          ? '시장조사 결과 수락'
          : decision === 'rejected'
            ? '시장조사 결과 반려'
            : '시장조사 수정 요청'
      const row = await decideAiArtifact(artifact.id, artifact.version, decision, comment)
      setArtifact(row)
      setArtifactEvents(await listAiArtifactEvents(row.id))
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-gray-500">불러오는 중…</p>
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 text-gray-900">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link to="/ai-staff" className="text-gray-500 hover:underline">
          ← AI 직원 채용
        </Link>
        <Link
          to={projectId ? `/projects/${projectId}/specialists` : '/projects'}
          className="text-gray-500 hover:underline"
        >
          카탈로그
        </Link>
        <Link
          to={projectId ? `/projects/${projectId}/audits/new` : '/projects'}
          className="text-gray-500 hover:underline"
        >
          S2 문서 선택
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">
          LIVE · {MARKET_RESEARCHER.id}
        </p>
        <h1 className="text-3xl font-bold">{MARKET_RESEARCHER.title}</h1>
        <p className="text-sm text-gray-600">{MARKET_RESEARCHER.description}</p>
        <p className="text-xs text-gray-500">
          terms {MARKET_RESEARCH_TERMS_VERSION} · 예산 상한 ${MARKET_RESEARCH_BUDGET_CAP_MINOR / 100} (소프트)
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700" data-testid="market-research-error">
          {error}
        </p>
      )}

      {!owner ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-4">
          owner만 시장조사 계약을 만들고 실행할 수 있습니다.
        </p>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-5">
            <h2 className="text-sm font-semibold text-gray-800">조사 요청</h2>
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
                  <option value="KR">한국 (KR)</option>
                  <option value="US">미국 (US)</option>
                  <option value="GLOBAL">글로벌</option>
                </select>
              </label>
              <label className="block text-sm">
                조사 수준
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={researchDepth}
                  onChange={(e) => setResearchDepth(e.target.value as ResearchDepth)}
                  data-testid="market-research-depth"
                >
                  <option value="standard">표준 (Search Agent)</option>
                  <option value="deep">심층 (Deep Research · 비용↑)</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">
              업무 요청
              <textarea
                className="mt-1 w-full rounded border px-3 py-2"
                rows={3}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                data-testid="market-research-task"
              />
            </label>
            <label className="block text-sm">
              완료 기준
              <textarea
                className="mt-1 w-full rounded border px-3 py-2"
                rows={2}
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                data-testid="market-research-criteria"
              />
            </label>
            <ul className="list-disc pl-5 text-xs text-gray-600">
              {MARKET_RESEARCH_TERMS_SUMMARY.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                data-testid="market-research-consent"
              />
              <span>{MARKET_RESEARCH_CONSENT_STATEMENT}</span>
            </label>
            <p className="text-xs text-gray-500">
              manifest: {manifestId ?? '없음 — S2 문서 선택 필요'}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveDraft()}
                className="rounded-md bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                data-testid="market-research-save-draft"
              >
                계약 초안 저장
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setClientRequestId(newRequestId())
                  setConsentChecked(false)
                  setServerContract(null)
                }}
                className="rounded-md border px-4 py-2 text-sm"
              >
                새 요청 ID
              </button>
            </div>
          </section>

          {serverContract && (
            <section
              className="rounded-xl border border-teal-300 bg-white p-5"
              data-testid="market-research-contract"
            >
              <h2 className="text-lg font-bold">서버 계약</h2>
              <p className="mt-2 text-sm" data-testid="market-research-contract-status">
                상태: {serverContract.status} · version {serverContract.version} ·{' '}
                {serverContract.agent_slug}
              </p>
              <p className="mt-1 text-xs text-gray-500">ID: {serverContract.id}</p>
              {events.length > 0 && (
                <ol className="mt-3 space-y-1 text-xs">
                  {events.map((ev) => (
                    <li key={ev.id}>
                      {ev.event_type}
                      {ev.comment ? ` · ${ev.comment}` : ''}
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                {serverContract.status === 'draft' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void accept()}
                    className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    data-testid="market-research-accept"
                  >
                    owner 승인
                  </button>
                )}
                {serverContract.status === 'active' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void enqueue()}
                    className="rounded-md bg-indigo-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    data-testid="market-research-enqueue"
                  >
                    Liner 실실행 큐에 넣기
                  </button>
                )}
              </div>
            </section>
          )}

          {serverRun && (
            <section
              className="rounded-xl border border-violet-300 bg-violet-50 p-5"
              data-testid="market-research-run"
            >
              <h2 className="text-lg font-bold">실행</h2>
              <p className="mt-2 text-sm" data-testid="market-research-run-status">
                상태: {serverRun.status} · version {serverRun.version}
              </p>
              <p className="mt-1 text-xs" data-testid="market-research-run-id">
                ID: {serverRun.id}
              </p>
              {serverRun.error_code && (
                <p className="mt-2 text-sm text-red-700" role="alert">
                  {serverRun.error_code}: {serverRun.error_message}
                </p>
              )}
              {serverRun.status === 'succeeded' && serverRun.result_json && (
                <div className="mt-4">
                  <MarketResearchReportView resultJson={serverRun.result_json} runId={serverRun.id} />
                </div>
              )}
              {runEvents.length > 0 && (
                <ol className="mt-3 space-y-1 text-xs">
                  {runEvents.map((ev) => (
                    <li key={ev.id}>
                      {ev.event_type}
                      {ev.detail ? ` · ${ev.detail}` : ''}
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void refresh()}
                  className="rounded-md border px-4 py-2 text-sm"
                  data-testid="market-research-refresh"
                >
                  상태 새로고침
                </button>
                {serverRun.status === 'succeeded' && !artifact && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void publish()}
                    className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    data-testid="market-research-publish"
                  >
                    프로젝트에 보고서 저장
                  </button>
                )}
              </div>
            </section>
          )}

          {artifact && (
            <section
              className="rounded-xl border border-emerald-300 bg-emerald-50 p-5"
              data-testid="market-research-artifact"
            >
              <h2 className="text-lg font-bold">저장된 산출물</h2>
              <p className="mt-2 text-sm">
                상태: {artifact.status} · version {artifact.version}
              </p>
              {artifact.content_json && (
                <div className="mt-4">
                  <MarketResearchReportView
                    resultJson={artifact.content_json}
                    runId={artifact.run_id}
                  />
                </div>
              )}
              {artifactEvents.length > 0 && (
                <ol className="mt-3 space-y-1 text-xs">
                  {artifactEvents.map((ev) => (
                    <li key={ev.id}>
                      {ev.event_type}
                      {ev.comment ? ` · ${ev.comment}` : ''}
                    </li>
                  ))}
                </ol>
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
        </>
      )}
    </main>
  )
}
