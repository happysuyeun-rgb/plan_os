import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AI_STAFF_ROSTER, hireableAiStaff } from '../lib/aiStaffCatalog'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'

/**
 * F-301 catalog Mock: hireable card + FUTURE placeholders (#37/#38 등).
 * No hire checkout, payment, or model execution for upcoming roles.
 */
export default function AiStaffCatalogMockPage() {
  const { projectId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

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

  const hireable = hireableAiStaff()
  const upcoming = AI_STAFF_ROSTER.filter((r) => !r.available)

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 text-gray-900">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link to="/ai-staff" className="text-gray-500 hover:underline">
          ← AI 직원 채용
        </Link>
        <Link to={projectId ? `/projects/${projectId}` : '/projects'} className="text-gray-500 hover:underline">
          프로젝트 문서
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">AI 인력 · CATALOG MOCK</p>
        <h1 className="text-3xl font-bold">AI 직원 카탈로그 (Mock)</h1>
        <p className="text-sm text-gray-600">
          채용 가능 역할만 업무 요청으로 이어집니다. FUTURE 자리(#37 영업·#38 마케터)는 표시만이며 결제·유료 LLM·실발송이
          없습니다.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {!ready && projectId && userId ? (
        <p role="status">프로젝트를 확인하는 중입니다.</p>
      ) : !accessible ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-4">
          프로젝트에 접근할 수 없거나 삭제된 프로젝트입니다.
        </p>
      ) : (
        <div className="space-y-8">
          <section aria-label="채용 가능 AI 직원" className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">
              채용 가능 · {hireable.length}종 (Mock)
            </h2>
            {hireable.map((role) => (
              <article
                key={role.id}
                data-testid="ai-staff-catalog-card"
                data-role-id={role.id}
                className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold text-indigo-700">제공 역할</p>
                <h3 className="mt-2 text-xl font-semibold">{role.title}</h3>
                <p className="mt-2 text-sm text-gray-700">{role.description}</p>
                <p className="mt-2 text-sm font-medium text-indigo-900">{role.capability}</p>
                <dl className="mt-4 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-gray-800">역할 ID</dt>
                    <dd>{role.id}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-800">도구 / 모델</dt>
                    <dd>없음 · 유료 LLM 미연결</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-800">가격</dt>
                    <dd>산정 전 · 유료 결제 없음</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-800">상태</dt>
                    <dd>카탈로그 안내만 · 채용 확정 아님</dd>
                  </div>
                </dl>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to={`/projects/${projectId}/specialists/request`}
                    className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white"
                    data-testid="ai-staff-catalog-request-cta"
                  >
                    이 역할로 업무 요청 Mock
                  </Link>
                  <Link
                    to={`/projects/${projectId}/ai-review`}
                    className="rounded-md border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-800"
                  >
                    AI 기획 검수 (Mock)
                  </Link>
                </div>
              </article>
            ))}
          </section>

          <section aria-label="준비 중 AI 직원" className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">준비 중 · {upcoming.length}종 (표시만)</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {upcoming.map((role) => (
                <li key={role.id}>
                  <article
                    data-testid={`ai-staff-upcoming-${role.id}`}
                    data-future-ref={role.futureRef ?? ''}
                    className="h-full rounded-xl border border-gray-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">{role.title}</h3>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                        준비 중
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{role.description}</p>
                    <p className="mt-2 text-xs text-gray-500">{role.capability}</p>
                    {role.futureRef && (
                      <p className="mt-2 text-xs font-medium text-slate-600">
                        이슈 {role.futureRef} · 구현·채용·발송 아님
                      </p>
                    )}
                  </article>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500">
              복수 직무 실실행·경력 티어·인력사무소 풀스펙은 후속(P2)입니다. 사람 PM(`/plans`)과 병행합니다.
            </p>
          </section>
        </div>
      )}
    </main>
  )
}
