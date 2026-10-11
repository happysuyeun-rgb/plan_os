import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import type { DocumentType } from '../types'
import { Button } from '../components/common/Button'
import { EmptyState } from '../components/common/EmptyState'
import { UpgradeModal } from '../components/common/UpgradeModal'
import { ProjectSearch } from '../components/project/ProjectSearch'
import { ServiceTypeFilter } from '../components/project/ServiceTypeFilter'
import { ProjectGrid } from '../components/project/ProjectGrid'
import { ProjectCardItem } from '../components/project/ProjectCardItem'
import { ProjectActionModals } from '../components/project/ProjectActionModals'
import { useProjectActions } from '../hooks/useProjectActions'
import { useProjectStore } from '../store/projectStore'
import { usePlanStore } from '../store/planStore'
import { useNotificationStore } from '../store/notificationStore'
import { useDebounce } from '../hooks/useDebounce'
import { DOCUMENT_TYPE_UI_ORDER } from '../lib/documentTypes'

const ALL_DOC_TYPES: DocumentType[] = DOCUMENT_TYPE_UI_ORDER

export default function ProjectListPage() {
  const navigate = useNavigate()
  const {
    searchQuery,
    serviceTypeFilter,
    isLoading,
    fetchProjects,
    fetchTrashedProjects,
    setSearchQuery,
    setServiceTypeFilter,
    getFilteredProjects,
    projects,
    trashedProjects,
  } = useProjectStore()
  const canCreateProject = usePlanStore((s) => s.canCreateProject)
  const summary = useNotificationStore((s) => s.summary)
  const refreshNotifications = useNotificationStore((s) => s.refresh)

  const [showUpgrade, setShowUpgrade] = useState(false)
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const debouncedSearch = useDebounce(localSearch, 300)

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
    fetchTrashedProjects()
    refreshNotifications()
  }, [fetchProjects, fetchTrashedProjects, refreshNotifications])

  useEffect(() => {
    setSearchQuery(debouncedSearch)
  }, [debouncedSearch, setSearchQuery])

  const filtered = getFilteredProjects()

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
        <h1 className="text-2xl font-bold text-gray-900">프로젝트</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/projects/trash"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Trash2 className="h-4 w-4" />
            휴지통
            {trashedProjects.length > 0 && (
              <span className="rounded-full bg-gray-200 px-1.5 text-xs font-medium text-gray-700">
                {trashedProjects.length}
              </span>
            )}
          </Link>
          <Button onClick={handleNewProject}>
            <Plus className="h-4 w-4" />
            새 프로젝트
          </Button>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <ProjectSearch value={localSearch} onChange={setLocalSearch} />
        <ServiceTypeFilter value={serviceTypeFilter} onChange={setServiceTypeFilter} />
      </div>

      {isLoading ? (
        <p className="mt-12 text-center text-gray-400">로딩 중...</p>
      ) : filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="검색 결과가 없습니다" />
        </div>
      ) : (
        <div className="relative mt-8">
          <ProjectGrid>
            {filtered.map((project) => (
              <ProjectCardItem
                key={project.id}
                project={project}
                hasDocuments={project.memory_summary ? ALL_DOC_TYPES : []}
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
          </ProjectGrid>
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
