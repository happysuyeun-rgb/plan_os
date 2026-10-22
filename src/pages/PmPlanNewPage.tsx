import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useMemberStore } from '../store/memberStore'
import { validateHumanPlan, type PlanStep } from '../lib/humanPmPlanDraft'
import { createPmPlan } from '../lib/api/pmPlans'

const newStep = (): PlanStep => ({
  id: crypto.randomUUID(),
  title: '',
  acceptanceCriteria: '',
  dependsOn: null,
})

/**
 * F-401 / N08 / TF-13: human-authored PM plan draft, persisted to the
 * server. AI never writes here; source is recorded as `human`, approval
 * starts nothing by itself (no execution, no billing).
 */
export default function PmPlanNewPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const members = useMemberStore((s) => s.members)
  const fetchMembers = useMemberStore((s) => s.fetchMembers)
  const [ready, setReady] = useState(false)
  const [objective, setObjective] = useState('')
  const [steps, setSteps] = useState<PlanStep[]>([newStep()])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    if (!projectId || !userId) return
    void (async () => {
      try {
        await setCurrentProject(projectId)
        await fetchMembers(projectId)
        if (mounted) setReady(true)
      } catch {
        if (mounted) setError('프로젝트를 확인할 수 없습니다.')
      }
    })()
    return () => { mounted = false }
  }, [projectId, userId, setCurrentProject, fetchMembers])

  const activeProject = currentProject?.id === projectId && !currentProject?.deleted_at
  const membership = members.find(
    (m) => m.project_id === projectId && m.user_id === userId && m.status === 'active',
  )
  const canEdit = ready && !!activeProject && (
    currentProject?.user_id === userId || membership?.role === 'owner' || membership?.role === 'editor'
  )

  const change = (id: string, patch: Partial<PlanStep>) => {
    setSteps((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const submit = async () => {
    if (!projectId || !canEdit || saving) return
    const validationError = validateHumanPlan({ projectId, objective, status: 'draft', steps })
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    try {
      const plan = await createPmPlan(projectId, objective, steps)
      navigate(`/projects/${projectId}/plans/${plan.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '계획 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link className="text-sm text-indigo-700 underline" to={projectId ? `/projects/${projectId}/plans` : '/projects'}>← PM 계획 목록</Link>
      <header>
        <p className="text-xs font-bold text-indigo-700">F-401 · 사람이 작성한 계획 (서버 저장)</p>
        <h1 className="mt-2 text-2xl font-bold">업무 계획 초안 작성</h1>
        <p className="mt-2 text-sm text-gray-500">
          사람이 직접 작성하는 계획입니다. 저장해도 AI 실행이나 결제는 시작되지 않으며, 소유자 승인 후에만 업무로 연결할 수 있습니다.
        </p>
      </header>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {!ready && <p role="status">프로젝트를 확인하는 중...</p>}
      {ready && !canEdit && (
        <p role="alert" className="rounded bg-amber-50 p-3 text-amber-800">프로젝트 소유자 또는 편집자만 계획 초안을 작성할 수 있습니다.</p>
      )}
      {canEdit && (
        <>
          <label className="block font-semibold">
            업무 목표
            <textarea
              value={objective}
              maxLength={1000}
              rows={4}
              onChange={(e) => setObjective(e.target.value)}
              className="mt-2 block w-full rounded border p-3 font-normal"
              placeholder="해결하려는 문제와 원하는 결과를 입력하세요 (10~1000자)"
            />
          </label>

          <section className="space-y-4" aria-label="업무 단계 편집">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">업무 단계</h2>
              <button
                type="button"
                className="rounded border px-3 py-2"
                disabled={steps.length >= 20}
                onClick={() => setSteps((v) => [...v, newStep()])}
              >
                + 단계 추가
              </button>
            </div>
            {steps.map((step, index) => (
              <article key={step.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex justify-between">
                  <h3 className="font-semibold">단계 {index + 1}</h3>
                  <button
                    type="button"
                    disabled={steps.length === 1}
                    className="text-sm text-red-700 disabled:opacity-40"
                    onClick={() => setSteps((v) => v.filter((s) => s.id !== step.id).map((s) => (s.dependsOn === step.id ? { ...s, dependsOn: null } : s)))}
                  >
                    단계 삭제
                  </button>
                </div>
                <label className="block text-sm">
                  단계 제목
                  <input
                    value={step.title}
                    maxLength={120}
                    onChange={(e) => change(step.id, { title: e.target.value })}
                    className="mt-1 block w-full rounded border p-2"
                  />
                </label>
                <label className="block text-sm">
                  완료 기준
                  <textarea
                    value={step.acceptanceCriteria}
                    maxLength={500}
                    rows={2}
                    onChange={(e) => change(step.id, { acceptanceCriteria: e.target.value })}
                    className="mt-1 block w-full rounded border p-2"
                  />
                </label>
                <label className="block text-sm">
                  선행 단계
                  <select
                    value={step.dependsOn ?? ''}
                    onChange={(e) => change(step.id, { dependsOn: e.target.value || null })}
                    className="mt-1 block w-full rounded border p-2"
                  >
                    <option value="">없음</option>
                    {steps.slice(0, index).map((s, i) => (
                      <option key={s.id} value={s.id}>단계 {i + 1} · {s.title || '제목 미입력'}</option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </section>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {saving ? '저장 중...' : '서버에 초안 저장'}
            </button>
            <button
              type="button"
              className="rounded border px-4 py-2"
              onClick={() => { setObjective(''); setSteps([newStep()]); setError('') }}
            >
              초기화
            </button>
          </div>
        </>
      )}
    </main>
  )
}
