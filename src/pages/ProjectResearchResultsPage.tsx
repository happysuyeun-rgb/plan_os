import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { MarketResearchReportView } from '../components/ai/MarketResearchReportView'
import { ResearchPrdApplyModal } from '../components/ai/ResearchPrdApplyModal'
import { useProjectPermissions } from '../hooks/useProjectPermissions'
import { listProjectAiArtifacts, type AiArtifactRow } from '../lib/api/aiArtifacts'
import { listProjectAiRuns, type AiRunRow } from '../lib/api/aiRuns'
import { MARKET_RESEARCHER } from '../lib/marketResearchStaff'
import { useAuthStore } from '../store/authStore'
import { useMemberStore } from '../store/memberStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'

type ResearchItem = {
  id: string
  kind: 'artifact' | 'run'
  title: string
  statusLabel: string
  updatedAt: string
  resultJson: unknown
  runId: string
}

function isMarketResearchRun(run: AiRunRow): boolean {
  const slug = (run.result_json as { agentSlug?: string } | null)?.agentSlug
  return slug === MARKET_RESEARCHER.id
}

function isMarketResearchArtifact(art: AiArtifactRow): boolean {
  const slug = (art.content_json as { agentSlug?: string } | null)?.agentSlug
  const kind = art.kind || ''
  return slug === MARKET_RESEARCHER.id || kind.includes('market_research')
}

function reportTitle(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback
  const row = json as { researchTarget?: string; goalAndScope?: { goal?: string } }
  return row.researchTarget || row.goalAndScope?.goal || fallback
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function ProjectResearchResultsPage() {
  const { projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const { members, fetchMembers } = useMemberStore()
  const { can } = useProjectPermissions(currentProject, members)
  const showToast = useUIStore((s) => s.showToast)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<ResearchItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)

  const accessible = Boolean(
    projectId && currentProject?.id === projectId && !currentProject.deleted_at,
  )
  const canEditPrd = can('document.edit')

  useEffect(() => {
    let mounted = true
    if (!projectId || !userId) return
    void setCurrentProject(projectId)
      .then(async () => {
        await fetchMembers(projectId).catch(() => undefined)
        const [runs, arts] = await Promise.all([
          listProjectAiRuns(projectId),
          listProjectAiArtifacts(projectId),
        ])
        if (!mounted) return

        const artifactRunIds = new Set<string>()
        const fromArts: ResearchItem[] = arts.filter(isMarketResearchArtifact).map((art) => {
          artifactRunIds.add(art.run_id)
          return {
            id: `artifact:${art.id}`,
            kind: 'artifact',
            title: reportTitle(art.content_json, '저장된 시장조사 보고서'),
            statusLabel:
              art.status === 'accepted'
                ? '수락됨'
                : art.status === 'published'
                  ? '프로젝트 저장'
                  : art.status,
            updatedAt: art.updated_at,
            resultJson: art.content_json,
            runId: art.run_id,
          }
        })

        const fromRuns: ResearchItem[] = runs
          .filter(
            (run) =>
              run.status === 'succeeded' &&
              run.result_json &&
              isMarketResearchRun(run) &&
              !artifactRunIds.has(run.id),
          )
          .map((run) => ({
            id: `run:${run.id}`,
            kind: 'run' as const,
            title: reportTitle(run.result_json, '시장조사 보고서'),
            statusLabel: '조사 완료',
            updatedAt: run.updated_at || run.finished_at || run.created_at,
            resultJson: run.result_json,
            runId: run.id,
          }))

        const merged = [...fromArts, ...fromRuns].sort(
          (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        )
        setItems(merged)
        setSelectedId((prev) => prev ?? merged[0]?.id ?? null)
        if (searchParams.get('apply') === '1' && merged.length > 0) {
          setApplyOpen(true)
        }
      })
      .catch(() => {
        if (mounted) setError('리서치 결과를 불러올 수 없습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
    // apply query is read once on load; stripping it separately avoids reload loops
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: load on project/user only
  }, [projectId, userId, setCurrentProject, fetchMembers])

  useEffect(() => {
    if (searchParams.get('apply') !== '1') return
    const next = new URLSearchParams(searchParams)
    next.delete('apply')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  )

  if (loading) {
    return <p className="p-8 text-sm text-gray-500">불러오는 중…</p>
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-10 text-gray-900">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link
          to={projectId ? `/projects/${projectId}` : '/projects'}
          className="text-gray-500 hover:underline"
        >
          ← 프로젝트 문서
        </Link>
        <Link
          to={projectId ? `/projects/${projectId}/specialists/market-research` : '/ai-staff'}
          className="text-gray-500 hover:underline"
        >
          새 시장조사
        </Link>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">리서치 결과</h1>
          <p className="text-sm text-gray-600">
            {currentProject?.title
              ? `「${currentProject.title}」프로젝트의 시장조사 보고서를 모았습니다.`
              : '이 프로젝트의 시장조사 보고서입니다.'}
          </p>
        </div>
        {selected && projectId && (
          <button
            type="button"
            disabled={!canEditPrd}
            onClick={() => setApplyOpen(true)}
            className="rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="research-apply-to-prd"
          >
            리서치 → PRD 반영
          </button>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!accessible ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          프로젝트에 접근할 수 없습니다.
        </p>
      ) : items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-gray-600">아직 저장된 리서치 결과가 없습니다.</p>
          <Link
            to={`/projects/${projectId}/specialists/market-research`}
            className="mt-4 inline-flex rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
          >
            리서치 전문가에게 맡기기
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <aside className="space-y-2" aria-label="리서치 결과 목록">
            {items.map((item) => {
              const active = item.id === selected?.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-200'
                      : 'border-gray-200 bg-white hover:border-teal-200'
                  }`}
                  data-testid="project-research-item"
                >
                  <p className="line-clamp-2 text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.statusLabel} · {formatWhen(item.updatedAt)}
                  </p>
                </button>
              )
            })}
          </aside>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            {selected ? (
              <MarketResearchReportView resultJson={selected.resultJson} runId={selected.runId} />
            ) : (
              <p className="text-sm text-gray-500">왼쪽에서 보고서를 선택하세요.</p>
            )}
          </section>
        </div>
      )}

      {projectId && selected && (
        <ResearchPrdApplyModal
          open={applyOpen}
          projectId={projectId}
          reportJson={selected.resultJson}
          canEdit={canEditPrd}
          onClose={() => setApplyOpen(false)}
          onApplied={() => showToast('success', '리서치 내용을 PRD 섹션에 반영했습니다')}
        />
      )}
    </main>
  )
}
