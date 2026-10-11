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

export default function TrashPage() {
  const navigate = useNavigate()
  const showToast = useUIStore((s) => s.showToast)
  const {
    trashedProjects,
    isTrashLoading,
    fetchTrashedProjects,
    restoreProject,
    purgeProject,
  } = useProjectStore()

  const [purgeTarget, setPurgeTarget] = useState<string | null>(null)
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
    } catch {
      showToast('error', '복원에 실패했습니다')
    }
  }

  const handlePurge = async () => {
    if (!purgeTarget) return
    try {
      await purgeProject(purgeTarget)
      showToast('success', '프로젝트가 영구 삭제되었습니다')
    } catch {
      showToast('error', '영구 삭제에 실패했습니다')
    }
    setPurgeTarget(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
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
        <Link to="/projects" className="text-sm text-brand-600 hover:underline">
          프로젝트 목록
        </Link>
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
                onRestore={() => handleRestore(project.id)}
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
        onConfirm={handlePurge}
        onCancel={() => setPurgeTarget(null)}
      />
    </div>
  )
}
