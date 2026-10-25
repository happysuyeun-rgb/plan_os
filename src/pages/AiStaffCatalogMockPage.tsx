import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MidProjectAiStaffingNotice } from '../components/common/MidProjectAiStaffingNotice'
import { MOCK_SPECIALIST } from '../lib/mockSpecialistRequest'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'

/**
 * F-301 catalog Mock: one role card, description only.
 * No hire checkout, payment, or model execution.
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
      .then(() => { if (mounted) setReady(true) })
      .catch(() => {
        if (mounted) {
          setError('프로젝트를 불러올 수 없습니다.')
          setReady(true)
        }
      })
    return () => { mounted = false }
  }, [projectId, userId, setCurrentProject])

  const accessible = Boolean(
    ready &&
      projectId &&
      currentProject?.id === projectId &&
      !currentProject.deleted_at,
  )

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 text-gray-900">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link to={projectId ? `/projects/${projectId}` : '/projects'} className="text-gray-500 hover:underline">
          ← 프로젝트 문서
        </Link>
        <Link to={projectId ? `/projects/${projectId}/tasks` : '/projects'} className="text-indigo-700 hover:underline">
          업무 관리
        </Link>
        <Link to={projectId ? `/projects/${projectId}/plans` : '/projects'} className="text-indigo-700 hover:underline">
          사람 PM 계획
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">AI 인력 · CATALOG MOCK</p>
        <h1 className="text-3xl font-bold">AI 직원 카탈로그 (Mock)</h1>
        <p className="text-sm text-gray-600">
          현재 1개 역할만 표시합니다. 결제·채용 확정·실제 AI 실행은 없습니다.
        </p>
      </header>

      <MidProjectAiStaffingNotice projectId={projectId} />

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {!ready && projectId && userId ? (
        <p role="status">프로젝트를 확인하는 중입니다.</p>
      ) : !accessible ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-4">
          프로젝트에 접근할 수 없거나 삭제된 프로젝트입니다.
        </p>
      ) : (
        <section aria-label="AI 직원 카드" className="space-y-4">
          <article
            data-testid="ai-staff-catalog-card"
            className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold text-indigo-700">제공 역할 · 1종</p>
            <h2 className="mt-2 text-xl font-semibold">{MOCK_SPECIALIST.title}</h2>
            <p className="mt-2 text-sm text-gray-700">{MOCK_SPECIALIST.description}</p>
            <p className="mt-2 text-sm font-medium text-indigo-900">{MOCK_SPECIALIST.capability}</p>
            <dl className="mt-4 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-gray-800">역할 ID</dt>
                <dd>{MOCK_SPECIALIST.id}</dd>
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
          <p className="text-xs text-gray-500">
            복수 직무·경력 티어·인력사무소 풀스펙은 후속(P2)입니다. 사람 PM(`/plans`)과 병행합니다.
          </p>
        </section>
      )}
    </main>
  )
}
