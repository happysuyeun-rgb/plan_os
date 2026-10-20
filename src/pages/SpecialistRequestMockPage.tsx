import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { MOCK_SPECIALIST, createMockDraft, type MockRequest } from '../lib/mockSpecialistRequest'

export default function SpecialistRequestMockPage() {
  const { projectId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const [task, setTask] = useState('')
  const [criteria, setCriteria] = useState('')
  const [draft, setDraft] = useState<MockRequest | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    if (!projectId || !userId) return
    void setCurrentProject(projectId)
      .catch(() => { if (mounted) setError('프로젝트를 불러올 수 없습니다.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [projectId, userId, setCurrentProject])

  const accessible = Boolean(userId && projectId && currentProject?.id === projectId && !currentProject.deleted_at)
  // Mock approval is restricted to the project owner until full membership/RLS is validated.
  const owner = accessible && currentProject?.user_id === userId
  const submit = () => {
    if (!owner || !projectId) return
    try {
      setDraft(createMockDraft({ roleId: MOCK_SPECIALIST.id, projectId, task, acceptanceCriteria: criteria }))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 초안을 만들지 못했습니다.')
    }
  }
  const reset = () => { setTask(''); setCriteria(''); setDraft(null); setError('') }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-gray-900">
      <nav className="mb-6 text-sm"><Link to={projectId ? `/projects/${projectId}` : '/projects'} className="text-blue-700 underline">프로젝트로 돌아가기</Link></nav>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">AI 인력사무소 · S3 / MOCK ONLY</p>
        <h1 className="mt-2 text-3xl font-bold">전문가에게 업무 요청하기</h1>
        <p className="mt-3 text-sm text-gray-600">실제 AI 실행, 계약, 저장, 과금 및 외부 데이터 전송은 발생하지 않습니다. 이 화면의 초안은 새로고침하면 사라집니다.</p>
      </div>

      {loading && projectId && userId ? <p role="status">프로젝트 권한을 확인하고 있습니다.</p> : !accessible ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">프로젝트에 접근할 수 없거나 삭제된 프로젝트입니다.</div>
      ) : !owner ? (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">현재 Mock 업무 요청은 프로젝트 소유자만 작성할 수 있습니다. 멤버 권한 연결은 아직 검증되지 않았습니다.</div>
      ) : (
        <>
          <section aria-label="선택된 전문가" className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="text-xs font-semibold text-indigo-700">선택된 전문가 · 1개 역할만 제공</p>
            <h2 className="mt-2 text-xl font-semibold">{MOCK_SPECIALIST.title}</h2>
            <p className="mt-2 text-sm">{MOCK_SPECIALIST.description}</p>
            <p className="mt-2 text-sm font-medium text-indigo-900">{MOCK_SPECIALIST.capability}</p>
            <p className="mt-2 text-xs text-gray-600">사용 도구: 없음 · 실제 모델 연결: 안 됨 · 예상 비용: 산정 전(실행 불가)</p>
          </section>
          <section aria-label="업무 요청 입력" className="space-y-5 rounded-xl border p-5">
            <label className="block text-sm font-semibold">요청할 업무
              <textarea className="mt-2 w-full rounded-md border p-3 font-normal" rows={5} value={task} maxLength={1000} onChange={(e) => { setTask(e.target.value); setDraft(null) }} placeholder="검수할 범위와 원하는 결과를 10자 이상 작성하세요." />
            </label>
            <label className="block text-sm font-semibold">완료 기준
              <textarea className="mt-2 w-full rounded-md border p-3 font-normal" rows={3} value={criteria} maxLength={500} onChange={(e) => { setCriteria(e.target.value); setDraft(null) }} placeholder="어떤 결과면 완료인지 5자 이상 작성하세요." />
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={submit} className="rounded-md bg-indigo-700 px-4 py-2 font-semibold text-white">요청 초안 미리보기</button>
              <button type="button" onClick={reset} className="rounded-md border px-4 py-2">초기화</button>
            </div>
          </section>
          {draft && (
            <section aria-label="업무 요청 초안" className="mt-6 rounded-xl border border-green-300 bg-green-50 p-5">
              <h2 className="text-lg font-bold">요청 초안 생성됨 · 실행 대기 아님</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{draft.task}</p>
              <h3 className="mt-3 font-semibold">완료 기준</h3>
              <p className="whitespace-pre-wrap text-sm">{draft.acceptanceCriteria}</p>
              <p className="mt-4 text-xs font-medium text-green-900">상태: draft · 서버 미저장 · 계약/승인/결제/실행 불가</p>
              <button type="button" onClick={() => setDraft(null)} className="mt-3 rounded border px-3 py-2 text-sm">초안 취소</button>
            </section>
          )}
        </>
      )}
    </main>
  )
}
