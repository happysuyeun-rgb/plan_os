import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useMemberStore } from '../store/memberStore'
import { listPmPlans, type PmPlan } from '../lib/api/pmPlans'
import { PM_PLAN_STATUS_LABELS } from '../lib/pmPlanLabels'

/** F-401/F-402: server-backed PM plan list for one project (N08 entry). */
export default function PmPlanListPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const members = useMemberStore((s) => s.members)
  const fetchMembers = useMemberStore((s) => s.fetchMembers)
  const [plans, setPlans] = useState<PmPlan[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    if (!projectId || !userId) return
    void (async () => {
      try {
        await setCurrentProject(projectId)
        await fetchMembers(projectId)
        const rows = await listPmPlans(projectId)
        if (!mounted) return
        setPlans(rows)
        setReady(true)
      } catch {
        if (mounted) setError('계획을 불러올 수 없습니다.')
      }
    })()
    return () => { mounted = false }
  }, [projectId, userId, setCurrentProject, fetchMembers])

  const activeProject = currentProject?.id === projectId && !currentProject?.deleted_at
  const membership = members.find(
    (m) => m.project_id === projectId && m.user_id === userId && m.status === 'active',
  )
  const canEdit = !!activeProject && (
    currentProject?.user_id === userId || membership?.role === 'owner' || membership?.role === 'editor'
  )

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link className="text-sm text-indigo-700 underline" to={projectId ? `/projects/${projectId}/tasks` : '/projects'}>← 프로젝트 업무 보드</Link>
          <h1 className="mt-2 text-2xl font-bold">PM 계획</h1>
          <p className="mt-1 text-sm text-gray-500">사람이 작성한 프로젝트 계획을 서버에 저장하고, 소유자 승인 후 업무로 연결합니다.</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white"
            onClick={() => navigate(`/projects/${projectId}/plans/new`)}
          >
            새 계획 작성
          </button>
        )}
      </div>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {!ready && !error && <p role="status">계획을 불러오는 중...</p>}
      {ready && plans.length === 0 && (
        <p className="rounded border border-dashed p-6 text-center text-sm text-gray-500">
          아직 저장된 계획이 없습니다. {canEdit ? '새 계획을 작성해 보세요.' : '계획 작성 권한이 있으면 여기에 표시됩니다.'}
        </p>
      )}
      <ul className="space-y-3">
        {plans.map((plan) => (
          <li key={plan.id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <Link className="font-semibold text-indigo-800 underline" to={`/projects/${plan.project_id}/plans/${plan.id}`}>
                {plan.objective.slice(0, 80)}{plan.objective.length > 80 ? '…' : ''}
              </Link>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium">
                {PM_PLAN_STATUS_LABELS[plan.status]}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {plan.source === 'human' ? '사람이 작성한 계획' : 'AI가 제안한 계획'} · 버전 {plan.version} · {new Date(plan.updated_at).toLocaleString('ko-KR')}
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}
