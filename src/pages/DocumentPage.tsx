import { useEffect, useCallback, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import type { DocumentType, DocumentVersion, SidebarVersionInfo } from '../types'
import { DOCUMENT_TYPE_PATHS } from '../types'
import type { MemberRole } from '../types'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { UpgradeModal } from '../components/common/UpgradeModal'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { Button } from '../components/common/Button'
import { MemberPanel } from '../components/project/MemberPanel'
import { InviteMemberModal } from '../components/project/InviteMemberModal'
import { DocumentTypeTabs } from '../components/document/DocumentTypeTabs'
import { DocumentLayout } from '../components/document/DocumentLayout'
import { DocumentLeftPanel } from '../components/document/DocumentLeftPanel'
import { DocumentToolbar } from '../components/document/DocumentToolbar'
import { HistoryPanel } from '../components/document/HistoryPanel'
import { DocumentRenderer } from '../components/document/DocumentRenderer'
import { DocumentReviewPane } from '../components/document/DocumentReviewPane'
import { CommentSidebar } from '../components/document/CommentSidebar'
import { ChatPanel } from '../components/document/ChatPanel'
import { DocumentRightPanel } from '../components/document/DocumentRightPanel'
import { RegenerateModal } from '../components/document/RegenerateModal'
import { SaveVersionModal } from '../components/document/SaveVersionModal'
import { resolveChatTitle } from '../lib/chatTitle'
import { saveLastDocType } from '../lib/sessionStorage'
import {
  getAvailableDocTypes,
  resolveDocType,
  getDocPathForType,
} from '../lib/documentAccess'
import { buildSingleMarkdown } from '../lib/export/buildMarkdown'
import { buildProjectZip } from '../lib/export/buildZip'
import { copyToClipboard, downloadBlob, downloadText, sanitizeFilename } from '../lib/export/download'
import { useProjectPermissions } from '../hooks/useProjectPermissions'
import { useProjectStore } from '../store/projectStore'
import { useDocumentStore } from '../store/documentStore'
import { useVersionStore } from '../store/versionStore'
import { useChatStore } from '../store/chatStore'
import { usePlanStore } from '../store/planStore'
import { useMemberStore } from '../store/memberStore'
import { useActivityStore } from '../store/activityStore'
import { useCommentStore } from '../store/commentStore'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { shouldUseStructuredRenderer, usesStructuredView } from '../lib/documentContent'
import { isProjectTrashed } from '../lib/projectTrash'
import { TEST_UNLOCK_ALL_DOCUMENTS } from '../config'

const PATH_TO_TYPE: Record<string, DocumentType> = Object.fromEntries(
  Object.entries(DOCUMENT_TYPE_PATHS).map(([type, path]) => [path, type as DocumentType]),
)

function getTargetUser(project: { target_user?: string } | null): string {
  return project?.target_user?.trim() || '일반 사용자'
}

function flattenReplies(
  replies: import('../types').ProjectComment[],
): import('../types').ProjectComment[] {
  return replies.flatMap((r) => [r, ...flattenReplies(r.replies ?? [])])
}

export default function DocumentPage() {
  const { projectId, docType: docTypePath } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const { currentProject, setCurrentProject, updateProject } = useProjectStore()
  const {
    documents,
    activeDocType,
    content,
    saveStatus,
    isReadOnly,
    isLoading,
    fetchDocuments,
    setActiveDocType,
    updateContent,
    setContent,
    regenerate,
    regenerateCascade,
    setReadOnly,
  } = useDocumentStore()
  const {
    versions,
    summaries: versionSummaries,
    activeVersionId,
    fetchVersions,
    fetchSummaries,
    saveVersion,
    selectVersion,
    restoreVersion,
    reset: resetVersions,
  } = useVersionStore()
  const { messages, fetchMessages, reset: resetChat } = useChatStore()
  const canGenerate = usePlanStore((s) => s.canGenerate)
  const canSaveVersionPlan = usePlanStore((s) => s.canSaveVersion)
  const canInviteMemberPlan = usePlanStore((s) => s.canInviteMember)
  const getMemberLimit = usePlanStore((s) => s.getMemberLimit)
  const showToast = useUIStore((s) => s.showToast)

  const {
    members,
    isLoading: isMembersLoading,
    fetchMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
    reset: resetMembers,
  } = useMemberStore()

  const {
    activities,
    isLoading: isActivitiesLoading,
    fetchActivities,
    logActivity,
    reset: resetActivities,
  } = useActivityStore()

  const { can, canManageMembers, role } = useProjectPermissions(currentProject, members)
  const canEditProjectTitle = can('project.edit_meta')
  const currentUser = useAuthStore((s) => s.user)
  const restoreProject = useProjectStore((s) => s.restoreProject)

  const handleProjectTitleSave = useCallback(
    async (newTitle: string) => {
      if (!projectId || !currentProject) return
      const from = currentProject.title
      if (newTitle === from) return
      try {
        await updateProject(projectId, { title: newTitle })
        await logActivity({
          project_id: projectId,
          action: 'project_rename',
          meta: { from, to: newTitle },
        })
        showToast('success', '프로젝트 이름이 변경되었습니다')
      } catch {
        showToast('error', '프로젝트 이름 변경에 실패했습니다')
      }
    },
    [projectId, currentProject, updateProject, logActivity, showToast],
  )

  const handleChatTitleSave = useCallback(
    async (newTitle: string) => {
      if (!projectId) return
      try {
        await updateProject(projectId, { chat_title: newTitle })
        showToast('success', '채팅 제목이 변경되었습니다')
      } catch {
        showToast('error', '채팅 제목 변경에 실패했습니다')
      }
    },
    [projectId, updateProject, showToast],
  )

  const {
    threads,
    counts,
    isLoading: isCommentsLoading,
    filter: commentFilter,
    search: commentSearch,
    isCommentMode,
    activeThreadId,
    replyToId,
    fetchThreads,
    fetchCounts,
    setFilter: setCommentFilter,
    setSearch: setCommentSearch,
    setCommentMode,
    setActiveThreadId,
    setReplyToId,
    createRootComment,
    replyToComment,
    resolveThread,
    setMyCompletion,
    toggleReaction,
    reset: resetComments,
  } = useCommentStore()

  const [requestedViewMode, setRequestedViewMode] = useState<'edit' | 'review'>('edit')
  const [commentsOpen, setCommentsOpen] = useState(() => searchParams.get('panel') === 'comments')

  useEffect(() => {
    const panel = searchParams.get('panel')
    const thread = searchParams.get('thread')
    if (panel === 'comments' && thread) setActiveThreadId(thread)
  }, [searchParams, setActiveThreadId])
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
  const [showSaveVersionModal, setShowSaveVersionModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [showMemberPanel, setShowMemberPanel] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [removeMemberTarget, setRemoveMemberTarget] = useState<string | null>(null)

  const availableTypes = useMemo(() => getAvailableDocTypes(documents), [documents])
  const activeDoc = documents[activeDocType]
  const activeDocumentId = activeDoc?.id

  const sidebarVersionInfo = useMemo(() => {
    const result: Partial<Record<DocumentType, SidebarVersionInfo>> = {}
    for (const type of availableTypes) {
      const doc = documents[type]
      if (!doc) continue
      const summary = versionSummaries[doc.id]
      const isActive = type === activeDocType
      const viewingVersion = isActive && activeVersionId
        ? versions.find((v) => v.id === activeVersionId)?.version_number ?? null
        : null
      result[type] = {
        latest_version_number: summary?.latest_version_number ?? 0,
        viewing_version_number: viewingVersion,
        is_on_latest: isActive ? activeVersionId === null : true,
      }
    }
    return result
  }, [availableTypes, documents, versionSummaries, activeDocType, activeVersionId, versions])
  const targetUser = getTargetUser(currentProject)
  const canEditDocument = can('document.edit')
  const canComment = can('comment.view')
  const viewMode = canEditDocument ? requestedViewMode : 'review'
  const editorReadOnly = isReadOnly || !canEditDocument

  const loadProject = useCallback(async () => {
    if (!projectId) return
    await setCurrentProject(projectId)
    await fetchDocuments(projectId)
  }, [projectId, setCurrentProject, fetchDocuments])

  useEffect(() => {
    loadProject()
    return () => {
      resetVersions()
      resetChat()
      resetMembers()
      resetActivities()
      resetComments()
    }
  }, [loadProject, resetVersions, resetChat, resetMembers, resetActivities, resetComments])

  useEffect(() => {
    if (projectId) fetchMembers(projectId)
  }, [projectId, fetchMembers])

  useEffect(() => {
    if (!projectId || !canComment) return
    fetchCounts(projectId)
  }, [projectId, canComment, fetchCounts])

  // Comment queries belong to a document identity, not its mutable content.
  // A keystroke replaces the cached Document object but must not re-fetch
  // comments or overwrite an in-progress reply UI.
  useEffect(() => {
    if (!projectId || !activeDocumentId || !canComment) return
    void fetchThreads(projectId, activeDocumentId)
  }, [projectId, activeDocumentId, canComment, commentFilter, commentSearch, fetchThreads])

  useEffect(() => {
    if (!projectId || isLoading) return

    const pathType = docTypePath ? PATH_TO_TYPE[docTypePath] ?? null : null
    const resolved = resolveDocType({
      pathType,
      projectId,
      availableTypes,
      unlockAll: TEST_UNLOCK_ALL_DOCUMENTS,
    })

    if (!resolved) return

    const expectedPath = getDocPathForType(resolved)
    if (docTypePath !== expectedPath) {
      navigate(`/projects/${projectId}/${expectedPath}`, { replace: true })
      return
    }

    setActiveDocType(resolved)
    saveLastDocType(projectId, resolved)
  }, [projectId, docTypePath, isLoading, availableTypes, navigate, setActiveDocType])

  // Only document identities affect version summary lookup; editing text
  // must not re-fetch version summaries on each keystroke.
  const documentIdsKey = availableTypes
    .map((type) => documents[type]?.id)
    .filter((id): id is string => !!id)
    .join(',')
  useEffect(() => {
    if (documentIdsKey) void fetchSummaries(documentIdsKey.split(','))
  }, [documentIdsKey, fetchSummaries])

  // Chat/version history belongs to a document ID. Draft content changing on
  // every keystroke must not clear and refetch the entire chat conversation.
  useEffect(() => {
    if (projectId && activeDocumentId) {
      void fetchVersions(activeDocumentId)
      void fetchMessages(projectId, activeDocumentId)
    }
  }, [activeDocumentId, projectId, fetchVersions, fetchMessages])

  useEffect(() => {
    if (activeVersionId) {
      const version = versions.find((v) => v.id === activeVersionId)
      if (version) {
        setContent(version.content)
        setReadOnly(true)
      }
    } else if (activeDoc) {
      setReadOnly(false)
      setContent(activeDoc.content)
    }
  }, [activeVersionId, activeDoc?.content])

  const handleTabSelect = (type: DocumentType) => {
    if (!projectId) return
    if (!TEST_UNLOCK_ALL_DOCUMENTS && !availableTypes.includes(type)) return
    setActiveDocType(type)
    selectVersion(null)
    saveLastDocType(projectId, type)
    navigate(`/projects/${projectId}/${DOCUMENT_TYPE_PATHS[type]}`)
  }

  const handleSaveVersion = () => {
    if (!activeDoc || !projectId) return
    if (!canSaveVersionPlan(versions.length)) {
      setShowUpgrade(true)
      showToast('error', '버전 보관 한도에 도달했습니다')
      return
    }
    setShowSaveVersionModal(true)
  }

  const handleConfirmSaveVersion = async (name?: string) => {
    if (!activeDoc || !projectId) return
    setShowSaveVersionModal(false)
    await saveVersion(activeDoc.id, content, name)
    await logActivity({
      project_id: projectId,
      document_id: activeDoc.id,
      action: 'version_save',
      meta: { version_number: versions.length + 1, version_name: name ?? null },
    })
    showToast('success', '버전이 저장되었습니다', { animation: 'completion' })
  }

  const handleRegenerate = async () => {
    if (!canGenerate()) {
      setShowUpgrade(true)
      return
    }
    if (!projectId || !currentProject) return

    if (activeDocType === 'prd' || activeDocType === 'ia') {
      setShowRegenerateModal(true)
      return
    }

    await regenerate(projectId, activeDocType, currentProject.title, targetUser)
    await logActivity({
      project_id: projectId,
      document_id: activeDoc?.id,
      action: 'regenerate',
      meta: { doc_type: activeDocType },
    })
    showToast('success', '재생성이 완료되었습니다')
  }

  const handleRegenerateSingle = async () => {
    if (!projectId || !currentProject) return
    setShowRegenerateModal(false)
    await regenerate(projectId, activeDocType, currentProject.title, targetUser)
    await logActivity({
      project_id: projectId,
      document_id: activeDoc?.id,
      action: 'regenerate',
      meta: { doc_type: activeDocType },
    })
    showToast('success', '재생성이 완료되었습니다')
  }

  const handleRegenerateCascade = async () => {
    if (!projectId || !currentProject) return
    setShowRegenerateModal(false)
    await regenerateCascade(projectId, activeDocType, currentProject.title, targetUser)
    await logActivity({
      project_id: projectId,
      document_id: activeDoc?.id,
      action: 'regenerate_cascade',
      meta: { from: activeDocType },
    })
    showToast('success', '연관 산출물이 모두 재생성되었습니다')
  }

  const handleOpenHistory = async () => {
    if (!projectId) return
    await fetchActivities(projectId, activeDoc?.id)
    setShowHistoryPanel(true)
  }

  const handleExportMd = async (exportContent?: string, version?: DocumentVersion) => {
    if (!currentProject || !projectId || !activeDoc) return
    const body = exportContent ?? content
    const md = buildSingleMarkdown(currentProject, activeDocType, body)
    const filename = `${sanitizeFilename(currentProject.title)}_${DOCUMENT_TYPE_PATHS[activeDocType]}.md`
    downloadText(md, filename)
    await logActivity({
      project_id: projectId,
      document_id: activeDoc.id,
      action: 'export',
      meta: { format: 'md', version: version?.version_number ?? 'current' },
    })
    showToast('success', 'Markdown 파일을 다운로드했습니다')
  }

  const handleExportZip = async () => {
    if (!currentProject || !projectId) return
    const blob = await buildProjectZip(currentProject, documents)
    downloadBlob(blob, `${sanitizeFilename(currentProject.title)}_PlanOS.zip`)
    await logActivity({
      project_id: projectId,
      action: 'export',
      meta: { format: 'zip' },
    })
    showToast('success', 'ZIP 파일을 다운로드했습니다')
  }

  const handleCopyCursor = async () => {
    try {
      await copyToClipboard(content)
      showToast('success', '클립보드에 복사되었습니다')
    } catch {
      showToast('error', '복사에 실패했습니다')
    }
  }

  const memberLimit = getMemberLimit()
  const canInvite = can('member.invite') && canInviteMemberPlan(members.length)

  const handleInviteClick = () => {
    if (!canInvite) {
      setShowUpgrade(true)
      return
    }
    setShowInviteModal(true)
  }

  const handleInvite = async (email: string, inviteRole: 'editor' | 'viewer') => {
    if (!projectId) return
    await inviteMember(projectId, email, inviteRole)
    showToast('success', `${email}에게 초대를 보냈습니다 (mock)`)
  }

  const handleRemoveMember = async () => {
    if (!removeMemberTarget) return
    await removeMember(removeMemberTarget)
    showToast('success', '멤버가 제거되었습니다')
    setRemoveMemberTarget(null)
  }

  const handleViewModeChange = (mode: 'edit' | 'review') => {
    if (mode === 'edit' && !canEditDocument) {
      showToast('info', '읽기 전용입니다. 리뷰 모드에서 댓글을 남길 수 있습니다.')
      return
    }
    if (mode === 'edit' && isCommentMode) {
      setCommentMode(false)
    }
    setRequestedViewMode(mode)
    if (mode === 'review' && canComment) setCommentsOpen(true)
  }

  const handleCommentModeToggle = () => {
    if (!can('comment.create')) return
    if (!isCommentMode) {
      setRequestedViewMode('review')
      setCommentsOpen(true)
    }
    setCommentMode(!isCommentMode)
  }

  const handleCreateComment = async (anchor: import('../types').RegionAnchor, body: string) => {
    if (!projectId || !activeDoc) return
    try {
      await createRootComment(projectId, activeDoc.id, body, anchor)
      showToast('success', '댓글이 등록되었습니다')
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '댓글 저장에 실패했습니다')
    }
  }

  const handleSubmitReply = async (parentId: string, body: string) => {
    const parent =
      threads.flatMap((t) => [t.root, ...flattenReplies(t.replies)]).find((c) => c.id === parentId)
    const threadRootId = parent?.thread_root_id ?? parent?.id ?? parentId
    try {
      await replyToComment(parentId, body, threadRootId)
      showToast('success', '답글이 등록되었습니다')
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '답글 저장에 실패했습니다')
    }
  }

  const openCommentCount =
    threads.filter((t) => t.root.status === 'open').length

  const handleUpdateRole = async (
    memberId: string,
    newRole: 'editor' | 'viewer',
    fromRole: MemberRole,
  ) => {
    if (!projectId || fromRole === 'owner') return
    await updateMemberRole(projectId, memberId, newRole, fromRole)
    showToast('success', '권한이 변경되었습니다')
  }

  if (!projectId || isLoading) {
    return <LoadingSpinner className="min-h-screen" />
  }

  if (currentProject && isProjectTrashed(currentProject)) {
    const isOwner = currentProject.user_id === currentUser?.id
    return (
      <EmptyState
        title="이 프로젝트는 휴지통에 있습니다"
        description={
          isOwner
            ? '복원하면 다시 편집할 수 있습니다.'
            : '소유자가 프로젝트를 휴지통으로 이동했습니다.'
        }
        action={
          <div className="flex gap-2">
            {isOwner && (
              <>
                <Button
                  onClick={async () => {
                    await restoreProject(projectId)
                    showToast('success', '프로젝트가 복원되었습니다')
                    await setCurrentProject(projectId)
                  }}
                >
                  복원
                </Button>
                <Button variant="ghost" onClick={() => navigate('/projects/trash')}>
                  휴지통으로 이동
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              대시보드로
            </Button>
          </div>
        }
      />
    )
  }

  if (role === null) {
    return (
      <EmptyState
        title="이 프로젝트에 접근할 권한이 없습니다"
        action={
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            대시보드로
          </Button>
        }
      />
    )
  }

  const hasNoDocuments = availableTypes.length === 0 && !TEST_UNLOCK_ALL_DOCUMENTS

  return (
    <>
      <DocumentLayout
        projectTitle={currentProject?.title ?? ''}
        canEditProjectTitle={canEditProjectTitle}
        onProjectTitleSave={handleProjectTitleSave}
        onBack={() => navigate('/dashboard')}
        headerActions={
          can('member.view') ? (
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              onClick={() => setShowMemberPanel(true)}
            >
              <Users className="h-4 w-4" />
              멤버 {members.length > 0 && `(${members.length})`}
            </Button>
          ) : undefined
        }
        docTabs={
          <DocumentTypeTabs
            activeType={activeDocType}
            availableTypes={availableTypes}
            openCommentCounts={
              counts?.by_document
                ? (Object.fromEntries(
                    Object.entries(counts.by_document).map(([k, v]) => [k, v.open]),
                  ) as Partial<Record<DocumentType, number>>)
                : undefined
            }
            versionInfo={sidebarVersionInfo}
            onSelect={handleTabSelect}
          />
        }
        leftPanel={
          activeDoc ? (
            <DocumentLeftPanel
              canChat={can('project.view')}
              chatPanel={
                <ChatPanel
                  projectId={projectId}
                  documentId={activeDoc.id}
                  docType={activeDocType}
                  chatTitle={currentProject ? resolveChatTitle(currentProject) : 'AI 채팅'}
                  canEditTitle={can('chat.send')}
                  onChatTitleSave={handleChatTitleSave}
                  onMessageSent={() =>
                    logActivity({
                      project_id: projectId,
                      document_id: activeDoc.id,
                      action: 'chat',
                    })
                  }
                  disabled={editorReadOnly || !can('chat.send')}
                />
              }
            />
          ) : undefined
        }
        toolbar={
          activeDoc ? (
            <DocumentToolbar
              docType={activeDocType}
              versions={versions}
              activeVersionId={activeVersionId}
              saveStatus={saveStatus}
              isReadOnly={isReadOnly}
              canRegenerate={can('document.regenerate')}
              canSaveVersion={can('document.version_save')}
              canRestore={can('document.version_restore')}
              canExportMd={can('export.md')}
              canExportZip={can('export.zip')}
              canViewHistory={can('project.view')}
              canComment={canComment}
              viewMode={viewMode}
              isCommentMode={isCommentMode}
              onViewModeChange={handleViewModeChange}
              onCommentModeToggle={handleCommentModeToggle}
              onSelectVersion={selectVersion}
              onRegenerate={handleRegenerate}
              onSaveVersion={handleSaveVersion}
              onRestore={() => setShowRestoreModal(true)}
              onOpenHistory={handleOpenHistory}
              onExportMd={() => handleExportMd()}
              onExportZip={handleExportZip}
              onCopyCursor={handleCopyCursor}
            />
          ) : (
            <div className="border-b border-gray-100 bg-white px-6 py-3">
              <h2 className="font-semibold text-gray-900">산출물</h2>
            </div>
          )
        }
        editor={
          hasNoDocuments ? (
            <EmptyState
              title="아직 생성된 산출물이 없습니다"
              action={
                <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                  대시보드로 돌아가기
                </Button>
              }
            />
          ) : activeDoc ? (
            viewMode === 'review' &&
            canComment &&
            !(
              usesStructuredView(activeDocType) &&
              shouldUseStructuredRenderer(activeDocType, content)
            ) ? (
              <DocumentReviewPane
                content={content}
                threads={threads}
                isCommentMode={isCommentMode && can('comment.create')}
                activeThreadId={activeThreadId}
                onSelectThread={(id) => {
                  setActiveThreadId(id)
                  setCommentsOpen(true)
                }}
                onCreateComment={handleCreateComment}
              />
            ) : (
              <DocumentRenderer
                docType={activeDocType}
                value={content}
                onChange={updateContent}
                readOnly={editorReadOnly || viewMode === 'review'}
              />
            )
          ) : (
            <EmptyState title="이 산출물은 아직 생성되지 않았습니다" />
          )
        }
        rightPanel={
          activeDoc ? (
            <DocumentRightPanel
              isOpen={commentsOpen}
              onToggle={() => setCommentsOpen((open) => !open)}
              canComment={canComment}
              commentBadge={openCommentCount}
              commentPanel={
                <CommentSidebar
                  isOpen
                  threads={threads}
                  isLoading={isCommentsLoading}
                  filter={commentFilter}
                  search={commentSearch}
                  activeThreadId={activeThreadId}
                  replyToId={replyToId}
                  currentUserId={currentUser?.id ?? ''}
                  canCreate={can('comment.create')}
                  canResolve={can('comment.resolve')}
                  canCompleteOwn={can('comment.complete_own')}
                  onClose={() => setCommentsOpen(false)}
                  onFilterChange={(f) => {
                    setCommentFilter(f)
                  }}
                  onSearchChange={setCommentSearch}
                  onSelectThread={setActiveThreadId}
                  onReply={setReplyToId}
                  onSubmitReply={handleSubmitReply}
                  onCancelReply={() => setReplyToId(null)}
                  onResolve={resolveThread}
                  onMyComplete={setMyCompletion}
                  onToggleReaction={toggleReaction}
                />
              }
            />
          ) : undefined
        }
      />

      <HistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        versions={versions}
        activeVersionId={activeVersionId}
        onSelectVersion={(id) => {
          selectVersion(id)
          setShowHistoryPanel(false)
        }}
        onExportVersion={
          can('export.md')
            ? (v) => handleExportMd(v.content, v)
            : undefined
        }
        messages={messages}
        activities={activities}
        isLoading={isActivitiesLoading}
      />

      <RegenerateModal
        isOpen={showRegenerateModal}
        docType={activeDocType}
        onClose={() => setShowRegenerateModal(false)}
        onRegenerateSingle={handleRegenerateSingle}
        onRegenerateCascade={handleRegenerateCascade}
      />

      <ConfirmModal
        isOpen={showRestoreModal}
        title="버전 복원"
        message="현재 버전은 보존되고, 선택한 버전 내용으로 새 버전이 생성됩니다."
        onConfirm={async () => {
          if (activeDoc && projectId) {
            await restoreVersion(activeDoc.id, content)
            await fetchDocuments(projectId)
            setContent(content)
            setReadOnly(false)
            selectVersion(null)
            await logActivity({
              project_id: projectId,
              document_id: activeDoc.id,
              action: 'version_restore',
            })
            showToast('success', '버전이 복원되었습니다')
          }
          setShowRestoreModal(false)
        }}
        onCancel={() => setShowRestoreModal(false)}
      />

      <MemberPanel
        isOpen={showMemberPanel}
        onClose={() => setShowMemberPanel(false)}
        members={members}
        isLoading={isMembersLoading}
        canInvite={canInvite}
        canManageMembers={canManageMembers}
        memberLimit={memberLimit}
        onInviteClick={handleInviteClick}
        onRemoveMember={(id) => setRemoveMemberTarget(id)}
        onUpdateRole={handleUpdateRole}
      />

      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
      />

      <ConfirmModal
        isOpen={!!removeMemberTarget}
        title="멤버 제거"
        message="이 멤버를 프로젝트에서 제거합니다. 되돌릴 수 없습니다."
        confirmLabel="제거"
        danger
        onConfirm={handleRemoveMember}
        onCancel={() => setRemoveMemberTarget(null)}
      />

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />

      <SaveVersionModal
        isOpen={showSaveVersionModal}
        onClose={() => setShowSaveVersionModal(false)}
        onConfirm={handleConfirmSaveVersion}
      />
    </>
  )
}
