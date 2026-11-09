import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'

/**
 * N29 Mock: formal hired-PM ops room placeholder.
 * No assignment DDL, scheduler, paid hire, or "auto-running" claims.
 * Does not duplicate C04 /dashboard aggregation.
 */
export default function PmOpsRoomMockPage() {
  const { projects, isLoading, fetchProjects, currentProject } = useProjectStore()
  const [selectedId, setSelectedId] = useState<string>('')

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

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="n29-pm-ops-room">
      <nav className="text-sm">
        <Link to="/ai-staff" className="text-gray-500 hover:underline">
          ← AI 직원 채용
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">N29 · PM OPS MOCK</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">정식 PM 운영실 (Mock)</h1>
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="n29-pm-ops-disclaimer"
        >
          정식 PM 채용·프로젝트 배정·백그라운드 scheduler·유료 계약이 없습니다. 「자동 운영 중」이 아니며 C04
          대시보드와 별도 화면입니다.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_240px]">
        <section
          aria-label="배정 프로젝트 목록"
          className="rounded-2xl border border-gray-200 bg-white p-4"
          data-testid="n29-pm-ops-project-list"
        >
          <h2 className="text-sm font-semibold text-gray-800">프로젝트</h2>
          <p className="mt-1 text-xs text-gray-500">배정 상태: 전부 미배정 (Mock)</p>
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
                        미배정 (Mock)
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
                PM worker가 이 프로젝트를 점검하지 않습니다. 사람 PM 계획·업무·Mock 검수로만 이어집니다.
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
                    AI 검수 Mock
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
          <p className="mt-2 text-xs text-gray-600">미구현 · 유료·worker 없음</p>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400"
              data-testid="n29-pm-ops-assign-disabled"
            >
              프로젝트 배정 변경
            </button>
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
