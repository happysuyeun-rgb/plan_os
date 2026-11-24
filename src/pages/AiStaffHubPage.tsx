import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AiStaffHireCard } from '../components/aiStaff/AiStaffHireCard'
import { AiStaffMarketplaceHero } from '../components/aiStaff/AiStaffMarketplaceHero'
import { AiStaffUpcomingRow } from '../components/aiStaff/AiStaffUpcomingRow'
import { Button } from '../components/common/Button'
import {
  AI_STAFF_ROSTER,
  filterAiStaffByCategory,
  hireableAiStaff,
  upcomingAiStaff,
  type AiStaffCategory,
} from '../lib/aiStaffCatalog'
import { isLocalDevAuth } from '../lib/localDevAuth'
import { showProductMockUi } from '../lib/productMockUi'
import { useProjectStore } from '../store/projectStore'

/**
 * Single AI staffing entry: marketplace roster first, then project pick for hireable roles.
 */
export default function AiStaffHubPage() {
  const navigate = useNavigate()
  const { projects, isLoading, fetchProjects, currentProject } = useProjectStore()
  const [category, setCategory] = useState<'all' | AiStaffCategory>('all')
  const [selectedRoleId, setSelectedRoleId] = useState(
    () => hireableAiStaff()[0]?.id ?? '',
  )
  const [detailRoleId, setDetailRoleId] = useState<string | null>(null)
  const hirePanelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  const active = useMemo(() => {
    const fromStore = projects.filter((p) => !p.deleted_at)
    if (fromStore.length > 0) return fromStore
    if (currentProject && !currentProject.deleted_at) return [currentProject]
    return []
  }, [projects, currentProject])

  const hireable = useMemo(
    () => filterAiStaffByCategory(hireableAiStaff(), category),
    [category],
  )

  useEffect(() => {
    if (hireable.length === 0) return
    if (!hireable.some((r) => r.id === selectedRoleId)) {
      setSelectedRoleId(hireable[0].id)
    }
  }, [hireable, selectedRoleId])
  const upcoming = useMemo(
    () => filterAiStaffByCategory(upcomingAiStaff(), category === 'all' ? 'all' : category),
    [category],
  )

  const selected = AI_STAFF_ROSTER.find((r) => r.id === selectedRoleId)
  const detailRole = AI_STAFF_ROSTER.find((r) => r.id === detailRoleId)
  const localHint = isLocalDevAuth()

  const hireHrefFor = (projectId: string, roleId?: string) => {
    const role = roleId
      ? AI_STAFF_ROSTER.find((r) => r.id === roleId)
      : selected
    if (!role?.available) return `/projects/${projectId}/specialists`
    const path = role.requestPath || 'request'
    return `/projects/${projectId}/specialists/${path}`
  }

  /** Prefer current project, else sole active project — so CTA navigates instead of only scrolling. */
  const resolveHireProjectId = () => {
    if (currentProject && !currentProject.deleted_at && active.some((p) => p.id === currentProject.id)) {
      return currentProject.id
    }
    if (active.length === 1) return active[0].id
    return null
  }

  const onHireClick = (roleId: string) => {
    setSelectedRoleId(roleId)
    const projectId = resolveHireProjectId()
    if (projectId) {
      navigate(hireHrefFor(projectId, roleId))
      return
    }
    requestAnimationFrame(() => {
      hirePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] px-6 py-8 landing-root">
      <div className="mx-auto max-w-5xl space-y-10">
        <AiStaffMarketplaceHero category={category} onCategoryChange={setCategory} />

        {showProductMockUi() && (
          <p className="landing-rise landing-rise-delay-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
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
        )}

        <section aria-label="지금 이용할 수 있는 직원" className="landing-rise landing-rise-delay-2 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">지금 이용할 수 있는 직원</h2>
            <p className="text-xs text-gray-400">{hireable.length}명 · 결제·유료 LLM 없음</p>
          </div>

          {hireable.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-5 py-8 text-center text-sm text-gray-500">
              이 카테고리에 채용 가능한 직원이 없습니다. 다른 필터를 선택해 보세요.
            </p>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {hireable.map((role) => (
                <li key={role.id}>
                  <AiStaffHireCard
                    role={role}
                    selected={role.id === selectedRoleId}
                    hireLabel={
                      role.requestPath === 'market-research' ? '시장조사 요청' : '업무 맡기기'
                    }
                    onDetail={() => {
                      setSelectedRoleId(role.id)
                      setDetailRoleId((prev) => (prev === role.id ? null : role.id))
                    }}
                    onHire={() => onHireClick(role.id)}
                  />
                </li>
              ))}
            </ul>
          )}

          {detailRole && (
            <aside
              className="rounded-2xl border border-brand-100 bg-white/90 px-5 py-4 text-sm text-gray-600"
              data-testid="ai-staff-detail-panel"
            >
              <p className="font-semibold text-gray-900">{detailRole.title} · 상세</p>
              <p className="mt-2 leading-relaxed">{detailRole.capability}</p>
              {detailRole.futureRef && (
                <p className="mt-2 text-xs text-slate-500">이슈 {detailRole.futureRef} · 표시만</p>
              )}
            </aside>
          )}
        </section>

        <AiStaffUpcomingRow roles={upcoming} />

        <section
          ref={hirePanelRef}
          className="space-y-3 rounded-[1.75rem] border border-gray-100 bg-white px-5 py-5 shadow-[0_8px_24px_rgba(88,70,180,0.05)]"
          aria-label="채용 진행"
        >
          <h2 className="text-base font-bold text-gray-900">
            {selected?.available
              ? selected.requestPath === 'market-research'
                ? `「${selected.title}」시장조사할 프로젝트`
                : `「${selected.title}」채용할 프로젝트`
              : '준비 중 역할'}
          </h2>
          {selected?.available && active.length > 1 && !resolveHireProjectId() && (
            <p className="text-sm text-amber-800" role="status">
              프로젝트를 고른 뒤 「
              {selected.requestPath === 'market-research' ? '시장조사 요청' : '이 프로젝트에 채용'}」을
              눌러 주세요.
            </p>
          )}

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
                    to={hireHrefFor(project.id, selectedRoleId)}
                    className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                    data-testid={
                      selected?.requestPath === 'market-research'
                        ? 'ai-staff-hub-market-research'
                        : 'ai-staff-hub-hire'
                    }
                  >
                    {selected?.requestPath === 'market-research'
                      ? '시장조사 요청'
                      : '이 프로젝트에 채용'}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
