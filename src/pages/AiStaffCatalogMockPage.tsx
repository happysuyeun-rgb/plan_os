import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AiStaffHireCard } from '../components/aiStaff/AiStaffHireCard'
import { AiStaffMarketplaceHero } from '../components/aiStaff/AiStaffMarketplaceHero'
import { AiStaffUpcomingRow } from '../components/aiStaff/AiStaffUpcomingRow'
import {
  filterAiStaffByCategory,
  hireableAiStaff,
  upcomingAiStaff,
  type AiStaffCategory,
} from '../lib/aiStaffCatalog'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'

/**
 * Project-scoped AI staff catalog: hireable roles → real request routes.
 * FUTURE seats stay display-only (no hire, payment, or fabricated scores).
 */
export default function AiStaffCatalogMockPage() {
  const { projectId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [category, setCategory] = useState<'all' | AiStaffCategory>('all')
  const [detailRoleId, setDetailRoleId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    if (!projectId || !userId) return
    void setCurrentProject(projectId)
      .then(() => {
        if (mounted) setReady(true)
      })
      .catch(() => {
        if (mounted) {
          setError('프로젝트를 불러올 수 없습니다.')
          setReady(true)
        }
      })
    return () => {
      mounted = false
    }
  }, [projectId, userId, setCurrentProject])

  const accessible = Boolean(
    ready && projectId && currentProject?.id === projectId && !currentProject.deleted_at,
  )

  const hireable = useMemo(
    () => filterAiStaffByCategory(hireableAiStaff(), category),
    [category],
  )
  const upcoming = useMemo(
    () => filterAiStaffByCategory(upcomingAiStaff(), category === 'all' ? 'all' : category),
    [category],
  )
  const detailRole = hireableAiStaff()
    .concat(upcomingAiStaff())
    .find((r) => r.id === detailRoleId)

  return (
    <main className="min-h-screen px-5 py-8 text-gray-900 landing-root sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link to="/ai-staff" className="text-gray-500 hover:underline">
            ← AI 직원 채용
          </Link>
          <Link
            to={projectId ? `/projects/${projectId}` : '/projects'}
            className="text-gray-500 hover:underline"
          >
            프로젝트 문서
          </Link>
        </nav>

        <AiStaffMarketplaceHero
          category={category}
          onCategoryChange={setCategory}
          subtitle="이 프로젝트에 맡길 전문가를 고르세요. 채용 가능 역할만 계약·큐로 이어집니다."
        />

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}
        {!ready && projectId && userId ? (
          <p role="status">프로젝트를 확인하는 중입니다.</p>
        ) : !accessible ? (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
            프로젝트에 접근할 수 없거나 삭제된 프로젝트입니다.
          </p>
        ) : (
          <div className="space-y-8">
            <section aria-label="채용 가능 AI 직원" className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900">지금 이용할 수 있는 직원</h2>
                <p className="text-xs text-gray-400">
                  {hireable.length}종 · 서버 계약 · CrewAI/Liner
                </p>
              </div>

              {hireable.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-5 py-8 text-center text-sm text-gray-500">
                  이 카테고리에 채용 가능한 직원이 없습니다.
                </p>
              ) : (
                <ul className="grid gap-4 lg:grid-cols-2" data-testid="ai-staff-catalog-list">
                  {hireable.map((role) => (
                    <li key={role.id}>
                      <AiStaffHireCard
                        role={role}
                        testId="ai-staff-catalog-card"
                        hireHref={`/projects/${projectId}/specialists/${role.requestPath || 'request'}`}
                        hireLabel={
                          role.id === 'ai_market_researcher_v1'
                            ? '시장조사 요청'
                            : '업무 맡기기'
                        }
                        onDetail={() =>
                          setDetailRoleId((prev) => (prev === role.id ? null : role.id))
                        }
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
                  <p className="font-semibold text-gray-900">{detailRole.title}</p>
                  <dl className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-gray-800">역할 ID</dt>
                      <dd>{detailRole.id}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-gray-800">실행</dt>
                      <dd>{detailRole.capability}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-gray-800">가격</dt>
                      <dd>산정 전 · 유료 결제 없음</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-gray-800">상태</dt>
                      <dd>요청·계약·큐잉 가능</dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <Link
                      to={`/projects/${projectId}/ai-review`}
                      className="text-sm font-semibold text-brand-700 underline underline-offset-2"
                    >
                      AI 기획 검수 화면으로
                    </Link>
                  </div>
                </aside>
              )}
            </section>

            <AiStaffUpcomingRow roles={upcoming} />

            <p className="text-xs text-gray-500">
              준비 중 자리(#37 영업·#38 마케터)는 표시만이며 결제·유료 LLM·실발송이 없습니다. 복수 직무
              실실행·경력 티어는 후속(P2)입니다.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
