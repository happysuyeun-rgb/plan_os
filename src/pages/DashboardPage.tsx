import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { DocumentType } from '../types'
import { Button } from '../components/common/Button'
import { EmptyState } from '../components/common/EmptyState'
import { UpgradeModal } from '../components/common/UpgradeModal'
import { ProjectGrid } from '../components/project/ProjectGrid'
import { ProjectCardItem } from '../components/project/ProjectCardItem'
import { ProjectActionModals } from '../components/project/ProjectActionModals'
import { NewProjectCard } from '../components/project/NewProjectCard'
import { useProjectActions } from '../hooks/useProjectActions'
import { useAuthStore } from '../store/authStore'
import { NotificationFeed } from '../components/dashboard/NotificationFeed'
import { useProjectStore } from '../store/projectStore'
import { DOCUMENT_TYPE_UI_ORDER } from '../lib/documentTypes'
import { usePlanStore } from '../store/planStore'
import { useNotificationStore } from '../store/notificationStore'

const ALL_DOC_TYPES: DocumentType[] = DOCUMENT_TYPE_UI_ORDER

function getDocTypes(project: { memory_summary: string }): DocumentType[] {
  return project.memory_summary ? ALL_DOC_TYPES : []
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { projects, isLoading, fetchProjects } = useProjectStore()
  const canCreateProject = usePlanStore((s) => s.canCreateProject)
  const summary = useNotificationStore((s) => s.summary)
  const refreshNotifications = useNotificationStore((s) => s.refresh)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const {
    contextMenu,
    setContextMenu,
    renameTarget,
    setRenameTarget,
    trashTarget,
    setTrashTarget,
    handleRename,
    handleTrash,
  } = useProjectActions()

  useEffect(() => {
    fetchProjects()
    refreshNotifications({ limit: 30 })
  }, [fetchProjects, refreshNotifications])

  const handleNewProject = () => {
    if (!canCreateProject(projects.length)) {
      setShowUpgrade(true)
      return
    }
    navigate('/projects/new')
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {user?.name ?? '사용자'}님
        </h1>
        <Button onClick={handleNewProject}>
          <Plus className="h-4 w-4" />
          새 프로젝트
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-12 text-center text-gray-400">로딩 중...</p>
      ) : projects.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="아직 프로젝트가 없습니다"
            action={
              <Button variant="ghost" onClick={handleNewProject}>
                첫 프로젝트 만들기
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-8 flex gap-6">
          <div className="min-w-0 flex-1">
          <ProjectGrid>
            {projects.map((project) => (
              <ProjectCardItem
                key={project.id}
                project={project}
                hasDocuments={getDocTypes(project)}
                notificationCounts={summary?.by_project[project.id]}
                isMenuOpen={contextMenu === project.id}
                onOpenMenu={() => setContextMenu(project.id)}
                onCloseMenu={() => setContextMenu(null)}
                onRename={() =>
                  setRenameTarget({ id: project.id, title: project.title })
                }
                onTrash={() => setTrashTarget(project.id)}
              />
            ))}
            <NewProjectCard onClick={handleNewProject} />
          </ProjectGrid>
          </div>
          <NotificationFeed className="hidden w-80 shrink-0 lg:flex" />
        </div>
      )}

      <ProjectActionModals
        renameTarget={renameTarget}
        trashTarget={trashTarget}
        onCloseRename={() => setRenameTarget(null)}
        onCloseTrash={() => setTrashTarget(null)}
        onConfirmRename={handleRename}
        onConfirmTrash={handleTrash}
      />
      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  )
}
