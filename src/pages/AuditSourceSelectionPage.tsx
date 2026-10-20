import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchDocuments } from '../lib/api/documents'
import { useDocumentStore } from '../store/documentStore'
import { useProjectStore } from '../store/projectStore'
import { useAuthStore } from '../store/authStore'
import { DOCUMENT_TYPE_LABELS, type Document } from '../types'
import { validateAuditSourceSelection, type AuditSourceCandidate } from '../lib/auditSourceSelection'

const errorLabels = {
  NEED_TWO_SOURCES: '검수할 문서를 2개 이상 선택해야 합니다.',
  DUPLICATE_SOURCE: '같은 문서를 중복 선택할 수 없습니다.',
  CROSS_PROJECT: '다른 프로젝트의 문서는 선택할 수 없습니다.',
  DELETED_SOURCE: '삭제된 문서는 선택할 수 없습니다.',
  UNSAVED_SOURCE: '저장되지 않은 수정사항이 있습니다. 먼저 문서 저장을 완료하세요.',
  MISSING_SNAPSHOT: '문서 버전 또는 내용 해시를 확인할 수 없습니다.',
}

async function digestContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return 'sha256:' + Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

export default function AuditSourceSelectionPage() {
  const { projectId } = useParams()
  const userId = useAuthStore((s) => s.user?.id)
  const { currentProject, setCurrentProject } = useProjectStore()
  const saveStatus = useDocumentStore((s) => s.saveStatus)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [candidates, setCandidates] = useState<AuditSourceCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true
    if (!projectId || !userId) return
    void Promise.all([setCurrentProject(projectId), fetchDocuments(projectId)])
      .then(([, docs]) => { if (active) { setDocuments(docs); setLoading(false) } })
      .catch(() => { if (active) { setError('프로젝트 문서를 불러오지 못했습니다.'); setLoading(false) } })
    return () => { active = false }
  }, [projectId, userId, setCurrentProject])

  const accessible = currentProject?.id === projectId && currentProject.deleted_at === null
  const toggle = (id: string) => {
    setChecked(false)
    setCandidates([])
    setSelected((current) => current.includes(id) ? current.filter((v) => v !== id) : [...current, id])
  }

  const verify = async () => {
    if (!projectId || !accessible) return
    setChecked(false)
    setError('')
    try {
      // Always re-read server data before local preflight. This is not a server-side
      // immutable manifest: execution must revalidate source revisions and digests.
      const fresh = await fetchDocuments(projectId)
      const chosen = fresh.filter((doc) => selected.includes(doc.id))
      if (chosen.length !== selected.length) {
        setError('선택한 문서가 변경되었거나 접근할 수 없습니다.')
        return
      }
      const snapshot = await Promise.all(chosen.map(async (doc) => ({
        id: doc.id,
        projectId: doc.project_id,
        type: doc.type,
        revision: doc.updated_at,
        digest: await digestContent(doc.content),
        deleted: false,
        hasUnsavedChanges: saveStatus !== 'saved',
      })))
      const result = validateAuditSourceSelection(projectId, snapshot)
      if (!result.ok) { setError(errorLabels[result.reason]); return }
      setDocuments(fresh)
      setCandidates(result.sources)
      setChecked(true)
    } catch {
      setError('문서 검증에 실패했습니다. 다시 시도하세요.')
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <Link to={projectId ? `/projects/${projectId}/tasks` : '/projects'} className="text-sm text-gray-600 hover:underline">← 업무 관리</Link>
      <h1 className="text-2xl font-bold">기획 검수 — 문서 선택</h1>
      <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
        S2 개발 시안입니다. 선택한 문서는 서버에 계약·저장·전송되지 않습니다.
        현재 화면의 해시는 브라우저에서 계산한 사전 검증 결과이며 실제 실행 승인이나 불변 스냅샷이 아닙니다.
      </p>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {loading ? <p>프로젝트 문서를 불러오는 중입니다.</p> : !accessible ? (
        <p role="alert">이 프로젝트에 접근할 수 없습니다.</p>
      ) : <>
        <section className="space-y-3" aria-label="검수 문서 선택">
          <h2 className="font-semibold">문서 선택 ({selected.length}개)</h2>
          {documents.length === 0 && <p>저장된 문서가 없습니다.</p>}
          {documents.map((doc) => (
            <label key={doc.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
              <input type="checkbox" checked={selected.includes(doc.id)} onChange={() => toggle(doc.id)} />
              <span>
                <span className="block font-medium">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
                <span className="block text-sm text-gray-600">최종 수정: {new Date(doc.updated_at).toLocaleString('ko-KR')}</span>
                <span className="block text-xs text-gray-500">문서 ID: {doc.id}</span>
              </span>
            </label>
          ))}
          {saveStatus !== 'saved' && <p role="alert" className="text-sm text-amber-700">현재 문서에 저장 대기 또는 실패 상태가 있습니다.</p>}
          <button type="button" onClick={() => { void verify() }} disabled={selected.length < 2}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40">
            선택한 문서 사전 검증
          </button>
        </section>
        {checked && <section className="space-y-2 rounded-lg border p-4" aria-label="사전 검증 결과">
          <h2 className="font-semibold">사전 검증 통과 · 서버 고정 전</h2>
          {candidates.map((doc) => (
            <div key={doc.id} className="break-all border-t py-2 text-xs">
              <p>문서 ID: {doc.id}</p>
              <p>수정 시각: {doc.revision}</p>
              <p>내용 SHA-256: {doc.digest}</p>
            </div>
          ))}
          <p className="text-sm text-gray-600">다음 단계: 서버에서 문서 소속과 버전·해시를 재확인하고 불변 manifest를 생성합니다.</p>
        </section>}
      </>}
    </main>
  )
}
