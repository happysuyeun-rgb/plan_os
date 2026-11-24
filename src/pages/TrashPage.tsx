import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '../components/common/Button'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { EmptyState } from '../components/common/EmptyState'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { TrashedProjectCard } from '../components/project/TrashedProjectCard'
import { TRASH_RETENTION_DAYS } from '../lib/projectTrash'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'

function purgeErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message.trim()) return e.message
  return '영구 삭제에 실패했습니다'
}

export default function TrashPage() {
  const navigate = useNavigate()
  const showToast = useUIStore((s) => s.showToast)
  const {
    trashedProjects,
    isTrashLoading,
    fetchTrashedProjects,
    restoreProject,
    purgeProject,
    purgeAllTrashedProjects,
  } = useProjectStore()

  const [purgeTarget, setPurgeTarget] = useState<string | null>(null)
  const [purgeAllOpen, setPurgeAllOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchTrashedProjects()
  }, [fetchTrashedProjects])

  const filtered = trashedProjects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  )

  const handleRestore = async (id: string) => {
    try {
      await restoreProject(id)
      showToast('success', '프로젝트가 복원되었습니다')
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '복원에 실패했습니다')
    }
  }

  const handlePurge = async () => {
    if (!purgeTarget || busy) return
    setBusy(true)
    try {
      await purgeProject(purgeTarget)
      showToast('success', '프로젝트가 영구 삭제되었습니다')
      setPurgeTarget(null)
    } catch (e) {
      showToast('error', purgeErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handlePurgeAll = async () => {
    if (busy || trashedProjects.length === 0) return
    setBusy(true)
    try {
      const count = await purgeAllTrashedProjects()
      showToast(
        'success',
        count > 0
          ? `휴지통 ${count}개 프로젝트를 모두 영구 삭제했습니다`
          : '삭제할 휴지통 항목이 없습니다',
      )
      setPurgeAllOpen(false)
    } catch (e) {
      showToast('error', purgeErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="px-2" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Trash2 className="h-6 w-6 text-gray-500" />
              휴지통
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {TRASH_RETENTION_DAYS}일 후 자동으로 영구 삭제됩니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {trashedProjects.length > 0 && (
            <Button
              variant="danger"
              className="text-sm"
              disabled={busy}
              onClick={() => setPurgeAllOpen(true)}
              data-testid="trash-purge-all"
            >
              모두 삭제
            </Button>
          )}
          <Link to="/projects" className="text-sm text-brand-600 hover:underline">
            프로젝트 목록
          </Link>
        </div>
      </div>

      {trashedProjects.length > 0 && (
        <div className="mt-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="휴지통 검색..."
            className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </div>
      )}

      <div className="mt-6">
        {isTrashLoading ? (
          <LoadingSpinner className="py-16" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="휴지통이 비어 있습니다"
            description="삭제한 프로젝트가 여기에 표시됩니다."
            action={
              <Button variant="ghost" onClick={() => navigate('/projects')}>
                프로젝트 목록으로
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((project) => (
              <TrashedProjectCard
                key={project.id}
                project={project}
                onRestore={() => void handleRestore(project.id)}
                onPurge={() => setPurgeTarget(project.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!purgeTarget}
        title="영구 삭제"
        message="프로젝트와 모든 문서·버전·채팅·댓글이 완전히 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="영구 삭제"
        danger
        confirming={busy}
        onConfirm={() => void handlePurge()}
        onCancel={() => {
          if (!busy) setPurgeTarget(null)
        }}
      />

      <ConfirmModal
        isOpen={purgeAllOpen}
        title="휴지통 모두 삭제"
        message={`휴지통의 프로젝트 ${trashedProjects.length}개를 모두 영구 삭제합니다. 문서·버전·채팅·댓글이 완전히 삭제되며 되돌릴 수 없습니다.`}
        confirmLabel="모두 삭제"
        danger
        confirming={busy}
        onConfirm={() => void handlePurgeAll()}
        onCancel={() => {
          if (!busy) setPurgeAllOpen(false)
        }}
      />
    </div>
  )
}
