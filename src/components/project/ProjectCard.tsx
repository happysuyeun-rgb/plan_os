import { useNavigate } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import type { DocumentType, Project } from '../../types'
import { DOCUMENT_TYPE_LABELS } from '../../types'
import { DOCUMENT_TYPE_UI_ORDER } from '../../lib/documentTypes'
import { getLastDocPath } from '../../lib/sessionStorage'
import { Badge } from '../common/Badge'
import { Card } from '../common/Card'
import { ProjectNotificationBadges } from './ProjectNotificationBadges'

const DOC_TYPES: DocumentType[] = DOCUMENT_TYPE_UI_ORDER

interface ProjectCardProps {
  project: Project
  hasDocuments?: DocumentType[]
  notificationCounts?: { comment: number; chat: number }
  onContextMenu?: (e: React.MouseEvent) => void
  onMenuClick?: (e: React.MouseEvent) => void
}

export function ProjectCard({
  project,
  hasDocuments = [],
  notificationCounts,
  onContextMenu,
  onMenuClick,
}: ProjectCardProps) {
  const navigate = useNavigate()
  const date = new Date(project.updated_at).toLocaleDateString('ko-KR')

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
