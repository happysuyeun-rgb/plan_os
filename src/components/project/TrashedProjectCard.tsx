import type { TrashedProject } from '../../types'
import { Button } from '../common/Button'
import { TRASH_RETENTION_DAYS } from '../../lib/projectTrash'

interface TrashedProjectCardProps {
  project: TrashedProject
  onRestore: () => void
  onPurge: () => void
}

export function TrashedProjectCard({ project, onRestore, onPurge }: TrashedProjectCardProps) {
  const deletedDate = new Date(project.deleted_at).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-gray-900">{project.title}</h3>
        <p className="mt-1 text-sm text-gray-500">{project.service_type}</p>
        <p className="mt-2 text-xs text-gray-400">
          삭제: {deletedDate} · {project.days_until_purge}일 후 영구 삭제 ({TRASH_RETENTION_DAYS}일
          보관)
        </p>
      </div>
      <div className="ml-4 flex shrink-0 gap-2">
        <Button variant="ghost" className="text-xs" onClick={onRestore}>
          복원
        </Button>
        <Button variant="ghost" className="text-xs text-red-600 hover:text-red-700" onClick={onPurge}>
          영구 삭제
        </Button>
      </div>
    </div>
  )
}
