import type { DocumentType, Project } from '../../types'
import { ContextMenu } from '../common/ContextMenu'
import { ProjectCard } from './ProjectCard'
import type { MemberAvatarPerson } from './MemberAvatarStack'

interface ProjectCardItemProps {
  project: Project
  hasDocuments?: DocumentType[]
  notificationCounts?: { comment: number; chat: number }
  members?: MemberAvatarPerson[]
  isMenuOpen: boolean
  onOpenMenu: () => void
  onCloseMenu: () => void
  onRename: () => void
  onTrash: () => void
}

export function ProjectCardItem({
  project,
  hasDocuments = [],
  notificationCounts,
  members,
  isMenuOpen,
  onOpenMenu,
  onCloseMenu,
  onRename,
  onTrash,
}: ProjectCardItemProps) {
  return (
    <div className="relative">
      <ProjectCard
        project={project}
        hasDocuments={hasDocuments}
        notificationCounts={notificationCounts}
        members={members}
        onContextMenu={(e) => {
          e.preventDefault()
          onOpenMenu()
        }}
        onMenuClick={(e) => {
          e.stopPropagation()
          onOpenMenu()
        }}
      />
      {isMenuOpen && (
        <ContextMenu
          items={[
            {
              id: 'rename',
              label: '이름 변경',
              icon: 'edit',
              onClick: onRename,
            },
            {
              id: 'trash',
              label: '휴지통으로 이동',
              icon: 'delete',
              danger: true,
              onClick: onTrash,
            },
          ]}
          onClose={onCloseMenu}
        />
      )}
    </div>
  )
}
