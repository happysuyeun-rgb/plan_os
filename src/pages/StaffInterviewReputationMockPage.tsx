import { Link } from 'react-router-dom'
import { AI_STAFF_ROSTER, hireableAiStaff } from '../lib/aiStaffCatalog'
import { useProjectStore } from '../store/projectStore'

/**
 * F-801: interview/reputation seats stay non-scoring; hireable roles deep-link to catalog request.
 * No ratings ledger, career days, paid hire, or fabricated scores.
 */
export default function StaffInterviewReputationMockPage() {
  const currentProject = useProjectStore((s) => s.currentProject)
  const projectId =
    currentProject && !currentProject.deleted_at ? currentProject.id : null
  const hireable = hireableAiStaff()
  const upcoming = AI_STAFF_ROSTER.filter((r) => !r.available)

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="f801-interview-reputation-mock">
      <nav className="text-sm">
        <Link to="/ai-staff" className="text-gray-500 hover:underline">
          ← AI 직원 채용
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          F-801 · INTERVIEW / REPUTATION · 준비 중
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">면담 · 추천 · 평판</h1>
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="f801-disclaimer"
        >
          준비 중: 적합성 면담·추천 엔진·검증 경력일수·별점 원장이 없습니다. 0점 위조·가짜 성공률·유료 승급
          가격을 표시하지 않습니다. 채용은 카탈로그 실경로를 이용하세요.
        </p>
      </header>

      <section
        aria-label="업무 적합성 면담"
        className="rounded-2xl border border-gray-200 bg-white p-5"
        data-testid="f801-interview-panel"
      >
        <h2 className="text-sm font-semibold text-gray-800">면담 (N18 자리)</h2>
        <p className="mt-2 text-sm text-gray-600">
          희망 과업·도구·가능/불가를 확인하는 면담 UI는 미구현입니다. 지금은 카탈로그의채용 가능 역할로만 요청할
          수 있습니다.
        </p>
        <button
          type="button"
          disabled
          className="mt-3 cursor-not-allowed rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-gray-400"
          data-testid="f801-interview-start-disabled"
        >
          적합성 면담 시작
        </button>
      </section>

      <section
        aria-label="추천"
        className="rounded-2xl border border-gray-200 bg-white p-5"
        data-testid="f801-recommend-panel"
      >
        <h2 className="text-sm font-semibold text-gray-800">추천</h2>
        <p className="mt-2 text-sm text-gray-600">
          점수·매칭 알고리즘 추천이 아닙니다. 카탈로그에 있는 채용 가능/준비 중 역할만 안내합니다.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {hireable.map((role) => (
            <li
              key={role.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2"
              data-testid={`f801-recommend-hireable-${role.id}`}
            >
              <span className="font-medium text-gray-900">{role.title}</span>
              {projectId ? (
                <Link
                  to={`/projects/${projectId}/specialists/${role.requestPath || 'request'}`}
                  className="text-xs font-semibold text-emerald-800 underline underline-offset-2"
                  data-testid={`f801-recommend-request-${role.id}`}
                >
                  요청하기
                </Link>
              ) : (
                <span className="text-xs font-semibold text-emerald-800">채용 가능</span>
              )}
            </li>
          ))}
          {upcoming.slice(0, 3).map((role) => (
            <li
              key={role.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-slate-50 px-3 py-2"
              data-testid={`f801-recommend-upcoming-${role.id}`}
            >
              <span className="text-gray-800">{role.title}</span>
              <span className="text-xs text-gray-500">준비 중 · 추천 점수 없음</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <Link
            to={projectId ? `/projects/${projectId}/specialists` : '/ai-staff'}
            className="font-semibold text-brand-700 underline underline-offset-2"
            data-testid="f801-catalog-link"
          >
            {projectId ? '프로젝트 카탈로그로 요청' : 'AI 직원 허브로 이동'}
          </Link>
        </p>
      </section>

      <section
        aria-label="평판·경력"
        className="rounded-2xl border border-gray-200 bg-slate-50 p-5"
        data-testid="f801-reputation-panel"
      >
        <h2 className="text-sm font-semibold text-gray-800">평판 · 경력 (N30/N31 자리)</h2>
        <p className="mt-2 text-sm text-gray-600">
          검증 활동일수·후기·승급·공개 동의 철회(N32)는 미구현입니다. 표본이 없어 별점/성공률을 만들지
          않습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400"
            data-testid="f801-rating-disabled"
          >
            평가 작성
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400"
            data-testid="f801-career-disabled"
          >
            경력·승급 보기
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400"
            data-testid="f801-consent-disabled"
          >
            공개 동의 철회
          </button>
        </div>
      </section>
    </div>
  )
}
