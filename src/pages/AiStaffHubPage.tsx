import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { AI_STAFF_ROSTER } from '../lib/aiStaffCatalog'
import { isLocalDevAuth } from '../lib/localDevAuth'
import { useProjectStore } from '../store/projectStore'

/**
 * Single AI staffing entry: roster first, then project pick for hireable roles.
 */
export default function AiStaffHubPage() {
  const navigate = useNavigate()
  const { projects, isLoading, fetchProjects, currentProject } = useProjectStore()
  const [selectedRoleId, setSelectedRoleId] = useState(AI_STAFF_ROSTER.find((r) => r.available)?.id ?? '')

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  const active = useMemo(() => {
    const fromStore = projects.filter((p) => !p.deleted_at)
    if (fromStore.length > 0) return fromStore
    if (currentProject && !currentProject.deleted_at) return [currentProject]
    return []
  }, [projects, currentProject])

  const selected = AI_STAFF_ROSTER.find((r) => r.id === selectedRoleId)
  const localHint = isLocalDevAuth()

  const hireHref = (projectId: string) =>
    selected?.available
      ? `/projects/${projectId}/specialists/request`
      : `/projects/${projectId}/specialists`

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-brand-700">AI 직원</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">AI 직원 채용</h1>
        <p className="max-w-xl text-sm leading-relaxed text-gray-500">
          지금 채용 가능한 역할과 준비 중 역할(마케터 #38·영업 #37 자리 포함)을 한눈에 봅니다. (Mock · 결제/유료
          LLM·실발송 없음)
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <Link
              to="/ai-staff/pm-ops"
              className="font-semibold text-brand-700 underline underline-offset-2"
              data-testid="ai-staff-hub-n29-link"
            >
              정식 PM 운영실 Mock (N29)
            </Link>
            <span className="text-gray-500"> · 배정·scheduler·유료 없음</span>
          </span>
          <span>
            <Link
              to="/ai-staff/reputation"
              className="font-semibold text-brand-700 underline underline-offset-2"
              data-testid="ai-staff-hub-f801-link"
            >
              면담·추천·평판 Mock (F-801)
            </Link>
            <span className="text-gray-500"> · 별점/경력 원장 없음</span>
          </span>
        </p>
      </header>

      <section className="space-y-3" aria-label="AI 직원 목록">
        <h2 className="text-sm font-semibold text-gray-700">직원 목록</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {AI_STAFF_ROSTER.map((role) => {
            const selectedCard = role.id === selectedRoleId
            return (
              <li key={role.id}>
                <button
                  type="button"
                  data-testid={`ai-staff-card-${role.id}`}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedCard
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">{role.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        role.available
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {role.available ? '채용 가능' : '준비 중'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{role.description}</p>
                  <p className="mt-2 text-xs text-gray-500">{role.capability}</p>
                  {role.futureRef && (
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      이슈 {role.futureRef} · 표시만
                    </p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white px-5 py-5" aria-label="채용 진행">
        <h2 className="text-sm font-semibold text-gray-700">
          {selected?.available ? `「${selected.title}」채용할 프로젝트` : '준비 중 역할'}
        </h2>

        {!selected?.available ? (
          <p className="text-sm text-gray-500">
            이 역할은 아직 채용할 수 없습니다. 채용 가능 배지가 있는 직원을 선택하세요.
          </p>
        ) : isLoading ? (
          <p className="text-sm text-gray-500">프로젝트 불러오는 중…</p>
        ) : active.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {localHint
                ? '로컬(Mock)에서는 프로젝트 목록이 DB에 없어 비어 보일 수 있습니다. 프로젝트를 만들거나, 문서 화면의 「AI 직원 채용」으로 들어가세요.'
                : '먼저 프로젝트가 필요합니다.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/projects/new')}>프로젝트 만들기</Button>
              <Button variant="ghost" onClick={() => navigate('/projects')}>
                프로젝트 목록
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {active.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{project.title}</p>
                  <p className="truncate text-xs text-gray-500">
                    {project.service_type} · {project.target_user}
                  </p>
                </div>
                <Link
                  to={hireHref(project.id)}
                  className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                  data-testid="ai-staff-hub-hire"
                >
                  이 프로젝트에 채용
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
