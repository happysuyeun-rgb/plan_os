import { useNavigate } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import type { DocumentType, Project } from '../../types'
import { DOCUMENT_TYPE_LABELS } from '../../types'
import { DOCUMENT_TYPE_UI_ORDER } from '../../lib/documentTypes'
import { getLastDocPath } from '../../lib/sessionStorage'
import { Badge } from '../common/Badge'
import { Card } from '../common/Card'
import type { MemberAvatarPerson } from '../../lib/memberAvatars'
import {
  progressCaption,
  progressLabel,
  type ProjectProgress,
} from '../../lib/projectProgress'
import { cn } from '../../lib/utils'
import { MemberAvatarStack } from './MemberAvatarStack'
import { ProjectNotificationBadges } from './ProjectNotificationBadges'

const DOC_TYPES: DocumentType[] = DOCUMENT_TYPE_UI_ORDER

interface ProjectCardProps {
  project: Project
  hasDocuments?: DocumentType[]
  notificationCounts?: { comment: number; chat: number }
  members?: MemberAvatarPerson[]
  progress?: ProjectProgress
  onContextMenu?: (e: React.MouseEvent) => void
  onMenuClick?: (e: React.MouseEvent) => void
}

export function ProjectCard({
  project,
  hasDocuments = [],
  notificationCounts,
  members = [],
  progress,
  onContextMenu,
  onMenuClick,
}: ProjectCardProps) {
  const navigate = useNavigate()
  const date = new Date(project.updated_at).toLocaleDateString('ko-KR')
  const rate = progress?.completionRate
  const showBar = progress != null && progress.source !== 'unlinked' && progress.total > 0

  return (
    <Card
      className="cursor-pointer"
      onClick={() => navigate(`/projects/${project.id}/${getLastDocPath(project.id)}`)}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant="brand">{project.service_type}</Badge>
        <div className="flex items-center gap-2">
          <ProjectNotificationBadges
            comment={notificationCounts?.comment}
            chat={notificationCounts?.chat}
          />
          <span className="text-xs text-gray-400">{date}</span>
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="프로젝트 메뉴"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <h3 className="mt-3 font-semibold text-gray-900">{project.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{project.description}</p>
      {progress && (
        <div className="mt-3" data-testid="project-card-progress">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'text-lg font-semibold tabular-nums',
                progress.source === 'unlinked' ? 'text-amber-700' : 'text-gray-900',
              )}
              data-testid="project-card-progress-label"
            >
              {progressLabel(progress)}
            </span>
            {(progress.blocked ?? 0) > 0 && (
              <span className="text-xs font-medium text-red-600">차단 {progress.blocked}</span>
            )}
          </div>
          {showBar && (
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={rate ?? 0}
              aria-label={`${project.title} 등록 업무 완료율`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  progress.blocked > 0 ? 'bg-amber-500' : 'bg-blue-500',
                )}
                style={{ width: `${rate ?? 0}%` }}
              />
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">{progressCaption(progress)}</p>
        </div>
      )}
      {members.length > 0 && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <MemberAvatarStack members={members} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-1">
        {DOC_TYPES.map((type) => (
          <Badge
            key={type}
            variant={hasDocuments.includes(type) ? 'success' : 'muted'}
          >
            {DOCUMENT_TYPE_LABELS[type]}
          </Badge>
        ))}
      </div>
    </Card>
  )
}
