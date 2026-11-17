import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { listPmPlans } from '../lib/api/pmPlans'

/**
 * N29: PM ops room — PlanOS-first read path (approved plan count + deep links).
 * No assignment DDL, scheduler, paid hire, OpenClaw, or "auto-running" claims.
 */
export default function PmOpsRoomMockPage() {
  const { projects, isLoading, fetchProjects, currentProject } = useProjectStore()
  const [selectedId, setSelectedId] = useState<string>('')
  const [approvedCount, setApprovedCount] = useState<number | null>(null)
  const [planLoadError, setPlanLoadError] = useState('')

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  const active = useMemo(() => {
    const fromStore = projects.filter((p) => !p.deleted_at)
    if (fromStore.length > 0) return fromStore
    if (currentProject && !currentProject.deleted_at) return [currentProject]
    return []
  }, [projects, currentProject])

  const resolvedId =
    selectedId && active.some((p) => p.id === selectedId) ? selectedId : (active[0]?.id ?? '')
  const selected = active.find((p) => p.id === resolvedId) ?? null

  useEffect(() => {
    let mounted = true
    if (!resolvedId) {
      setApprovedCount(null)
      setPlanLoadError('')
      return
    }
    setApprovedCount(null)
    setPlanLoadError('')
    void listPmPlans(resolvedId)
      .then((rows) => {
        if (!mounted) return
        setApprovedCount(rows.filter((p) => p.status === 'approved').length)
      })
      .catch(() => {
        if (!mounted) return
        setApprovedCount(null)
        setPlanLoadError('계획 목록을 불러오지 못했습니다.')
      })
    return () => {
      mounted = false
    }
  }, [resolvedId])

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="n29-pm-ops-room">
      <nav className="text-sm">
        <Link to="/ai-staff" className="text-gray-500 hover:underline">
          ← AI 직원 채용
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">N29 · PM OPS · 준비 중</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">정식 PM 운영실</h1>
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="n29-pm-ops-disclaimer"
        >
          준비 중: 정식 PM 채용·프로젝트 배정·백그라운드 scheduler·유료 계약이 없습니다. 「자동 운영 중」이 아니며
          성과·과금 수치를 표시하지 않습니다. 아래 링크는 사람 PM·업무 실경로입니다.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_240px]">
        <section
          aria-label="배정 프로젝트 목록"
          className="rounded-2xl border border-gray-200 bg-white p-4"
          data-testid="n29-pm-ops-project-list"
        >
          <h2 className="text-sm font-semibold text-gray-800">프로젝트</h2>
          <p className="mt-1 text-xs text-gray-500">배정 상태: 전부 미배정 (준비 중)</p>
          {isLoading ? (
            <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>
          ) : active.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">
              표시할 프로젝트가 없습니다.{' '}
              <Link to="/projects/new" className="underline">
                만들기
              </Link>
            </p>
          ) : (
            <ul className="mt-3 space-y-1">
              {active.map((project) => {
                const on = project.id === resolvedId
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      data-testid={`n29-pm-ops-project-${project.id}`}
                      onClick={() => setSelectedId(project.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                        on ? 'bg-slate-900 text-white' : 'text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <span className="block truncate font-medium">{project.title}</span>
                      <span className={`mt-0.5 block text-[11px] ${on ? 'text-slate-300' : 'text-gray-500'}`}>
                        미배정 (준비 중)
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section
          aria-label="선택 프로젝트 다음 행동"
          className="rounded-2xl border border-gray-200 bg-white p-5"
          data-testid="n29-pm-ops-center"
        >
          <h2 className="text-sm font-semibold text-gray-800">다음 행동 (기존 화면 링크)</h2>
          {!selected ? (
            <p className="mt-3 text-sm text-gray-500">왼쪽에서 프로젝트를 선택하세요.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-base font-semibold text-gray-900">{selected.title}</p>
              <p className="text-sm text-gray-600">
                정식 AI PM 배정·scheduler는 없습니다. 승인된 사람 PM 계획 수와 실경로 링크만 표시합니다.
              </p>
              <p className="text-sm text-gray-800" data-testid="n29-pm-ops-approved-count">
                {planLoadError
                  ? planLoadError
                  : approvedCount === null
                    ? '승인 계획 수를 확인하는 중…'
                    : `승인된 PM 계획: ${approvedCount}건 (자동 실행 아님)`}
              </p>
              <ul className="flex flex-wrap gap-2">
                <li>
                  <Link
                    to={`/projects/${selected.id}/plans`}
                    className="inline-block rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                    data-testid="n29-pm-ops-link-plans"
                  >
                    사람 PM 계획
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/projects/${selected.id}/tasks`}
                    className="inline-block rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                    data-testid="n29-pm-ops-link-tasks"
                  >
                    업무
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/projects/${selected.id}/ai-review`}
                    className="inline-block rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                    data-testid="n29-pm-ops-link-ai-review"
                  >
                    AI 기획 검수
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </section>

        <aside
          aria-label="승인·비용·해임 (미구현)"
          className="rounded-2xl border border-gray-200 bg-slate-50 p-4"
          data-testid="n29-pm-ops-side-panel"
        >
          <h2 className="text-sm font-semibold text-gray-800">승인함 · 비용 · 해임</h2>
          <p className="mt-2 text-xs text-gray-600">비용·해임·OpenClaw 미구현 · 유료 없음</p>
          <div className="mt-4 space-y-2">
            {selected ? (
              <Link
                to={`/projects/${selected.id}/plans`}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-900 hover:bg-slate-50"
                data-testid="n29-pm-ops-assign-plans"
              >
                계획 승인·CrewAI 이어가기
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400"
                data-testid="n29-pm-ops-assign-disabled"
              >
                프로젝트 배정 변경
              </button>
            )}
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400"
              data-testid="n29-pm-ops-budget-disabled"
            >
              예상/실제 비용
            </button>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400"
              data-testid="n29-pm-ops-dismiss-disabled"
            >
              해임
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
