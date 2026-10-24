import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Inbox, Plus, RefreshCw } from 'lucide-react'
import type { DocumentType, Project } from '../types'
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
import { fetchDashboardProjects, fetchWorkSummaries } from '../lib/api/dashboard'

const serverTasksEnabled = import.meta.env.VITE_S1_SERVER_TASKS === 'true'
import {
  formatCompletionRate,
  sortDashboardRows,
  summarizeTotals,
  type DashboardProjectRow,
} from '../lib/dashboardSummary'

function formatUpdatedAt(updatedAt: string): string {
  return new Date(updatedAt).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
  const [accessibleProjects, setAccessibleProjects] = useState<Project[] | null>(null)
  const [workRows, setWorkRows] = useState<DashboardProjectRow[] | null>(null)
  const [approvalsAvailable, setApprovalsAvailable] = useState(true)
  const [workError, setWorkError] = useState<string | null>(null)
  const [workLoading, setWorkLoading] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  // 계정 전환·연속 새로고침 경합 방지: 마지막 요청만 화면에 반영한다.
  const requestGuard = useRef({ sequence: 0, controller: null as AbortController | null })

  const beginRequest = useCallback(() => {
    requestGuard.current.controller?.abort()
    const controller = new AbortController()
    requestGuard.current.controller = controller
    requestGuard.current.sequence += 1
    return { sequence: requestGuard.current.sequence, controller }
  }, [])

  const isCurrentRequest = useCallback((sequence: number, userId: string) => {
    return (
      requestGuard.current.sequence === sequence &&
      useAuthStore.getState().user?.id === userId
    )
  }, [])

  const refreshWorkStatus = useCallback(async () => {
    if (!user) return
    const requestedUserId = user.id
    const { sequence, controller } = beginRequest()
    try {
      const dashboardProjects = await fetchDashboardProjects(requestedUserId, controller.signal)
      if (!isCurrentRequest(sequence, requestedUserId)) return
      setAccessibleProjects(dashboardProjects)
      if (!serverTasksEnabled) return
      setWorkLoading(true)
      const { summaries, approvalsAvailable: approvalsOk } = await fetchWorkSummaries(
        dashboardProjects.map((p) => p.id),
        controller.signal,
      )
      if (!isCurrentRequest(sequence, requestedUserId)) return
      const summaryById = new Map(summaries.map((s) => [s.projectId, s]))
      setWorkRows(
        sortDashboardRows(
          dashboardProjects.map((project) => ({
            projectId: project.id,
            title: project.title,
            serviceType: project.service_type,
            updatedAt: project.updated_at,
            summary: summaryById.get(project.id)!,
          })),
        ),
      )
      setApprovalsAvailable(approvalsOk)
      setWorkError(null)
      setSyncedAt(
        new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      )
    } catch (loadError) {
      if (controller.signal.aborted || !isCurrentRequest(sequence, requestedUserId)) return
      console.error('[대시보드] 업무 현황을 불러오지 못했습니다.', loadError)
      if (serverTasksEnabled) {
        setWorkError('업무 현황을 불러오지 못했습니다. 네트워크 상태를 확인하고 다시 시도하세요.')
      }
    } finally {
      if (isCurrentRequest(sequence, requestedUserId)) setWorkLoading(false)
    }
  }, [user, beginRequest, isCurrentRequest])

  useEffect(() => {
    // 마운트·계정 변경 시 서버 현황을 불러온다 (동기 렌더링과 분리).
    const guard = requestGuard.current
    void Promise.resolve().then(() => refreshWorkStatus())
    return () => {
      guard.controller?.abort()
      guard.sequence += 1
    }
  }, [refreshWorkStatus])

  const totals = workRows ? summarizeTotals(workRows.map((row) => row.summary)) : null
  const ownedProjectIds = new Set(projects.map((project) => project.id))
  const sharedProjects = (accessibleProjects ?? []).filter(
    (project) => !ownedProjectIds.has(project.id),
  )

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

      {/* 업무 현황 요약 (C04) — 서버 업무 모드가 켜진 환경에서만 집계한다. */}
      <section aria-label="업무 현황" className="mt-6">
        {!serverTasksEnabled ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            현재 환경에서는 서버 업무가 연결되지 않아 업무 통계를 표시하지 않습니다. 프로젝트·문서·기획
            기능은 그대로 사용할 수 있습니다.
          </div>
        ) : workError ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{workError}</span>
            <Button variant="ghost" onClick={() => void refreshWorkStatus()}>
              다시 시도
            </Button>
          </div>
        ) : workLoading && !workRows ? (
          <p className="text-sm text-gray-400">업무 현황을 불러오는 중입니다...</p>
        ) : workRows && totals ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-500">접근 가능한 프로젝트</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{totals.projectCount}개</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-500">
                  등록 업무 완료율 <span className="text-gray-400">(프로젝트 전체 완성도 아님)</span>
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {totals.completionRate !== null
                    ? `${totals.doneTotal} / ${totals.taskTotal} · ${totals.completionRate}%`
                    : '업무 미등록'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-500">차단된 업무</p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
                  <AlertTriangle className={`h-5 w-5 ${totals.blockedTotal > 0 ? 'text-red-500' : 'text-gray-300'}`} />
                  {totals.blockedTotal}개
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-500">승인 대기 중인 계획</p>
                {approvalsAvailable ? (
                  <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
                    <Inbox className={`h-5 w-5 ${totals.pendingApprovalsTotal > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
                    {totals.pendingApprovalsTotal}건
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-medium text-gray-500">
                    PM 승인이 연결되지 않은 환경입니다
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  마지막 업데이트 {syncedAt ?? '—'}
                </span>
              </p>
              <Button variant="ghost" onClick={() => void refreshWorkStatus()} disabled={workLoading}>
                <RefreshCw className={`h-4 w-4 ${workLoading ? 'animate-spin' : ''}`} />
                새로고침
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {workRows.map((row) => (
                <button
                  key={row.projectId}
                  type="button"
                  onClick={() => navigate(`/projects/${row.projectId}/tasks`)}
                  className="rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{row.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{row.serviceType}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      최근 업데이트 {formatUpdatedAt(row.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-medium text-gray-900">{formatCompletionRate(row.summary)}</span>
                    <span className="text-gray-600">진행 중 {row.summary.inProgress}</span>
                    <span className="text-gray-600">검토 중 {row.summary.inReview}</span>
                    <span className={row.summary.blocked > 0 ? 'font-medium text-red-600' : 'text-gray-600'}>
                      차단 {row.summary.blocked}
                    </span>
                    {!approvalsAvailable ? (
                      <span className="text-gray-400">승인 현황 미연결</span>
                    ) : row.summary.pendingApprovals > 0 ? (
                      <span className="font-medium text-amber-600">
                        승인 대기 {row.summary.pendingApprovals}건
                      </span>
                    ) : null}
                  </div>
                  {row.summary.total > 0 ? (
                    <div
                      className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={row.summary.completionRate ?? 0}
                      aria-label={`${row.title} 등록 업무 완료율`}
                    >
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${row.summary.completionRate ?? 0}%` }}
                      />
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {isLoading ? (
        <p className="mt-12 text-center text-gray-400">로딩 중...</p>
      ) : projects.length === 0 && sharedProjects.length === 0 ? (
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
      ) : projects.length === 0 ? (
        <div className="mt-8">
          <p className="text-sm text-gray-600">
            본인이 소유한 프로젝트는 없습니다. 공유받은 프로젝트는 아래에서 열 수 있습니다.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sharedProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`/projects/${project.id}/tasks`)}
                className="rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm"
              >
                <p className="truncate font-semibold text-gray-900">{project.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{project.service_type}</p>
                <span className="mt-3 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  공유받은 프로젝트
                </span>
              </button>
            ))}
          </div>
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
          {sharedProjects.length > 0 ? (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-700">공유받은 프로젝트</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sharedProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}/tasks`)}
                    className="rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm"
                  >
                    <p className="truncate font-semibold text-gray-900">{project.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{project.service_type}</p>
                    <span className="mt-3 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      공유받은 프로젝트
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
