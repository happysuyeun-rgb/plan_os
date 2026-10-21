import type { DocumentType } from '../../types'
import { DOCUMENT_TYPE_LABELS } from '../../types'
import { Button } from '../common/Button'
import { SaveStatus } from '../common/SaveStatus'
import { VersionPills } from './VersionPills'
import { ExportMenu } from './ExportMenu'
import type { DocumentVersion } from '../../types'
import { History, Pencil, Eye } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { DocumentSaveStatus } from '../../lib/documentAutosave'

interface DocumentToolbarProps {
  docType: DocumentType
  versions: DocumentVersion[]
  activeVersionId: string | null
  saveStatus: DocumentSaveStatus
  isReadOnly: boolean
  canRegenerate: boolean
  canSaveVersion: boolean
  canRestore: boolean
  canExportMd: boolean
  canExportZip: boolean
  canViewHistory: boolean
  canComment: boolean
  viewMode: 'edit' | 'review'
  isCommentMode: boolean
  onViewModeChange: (mode: 'edit' | 'review') => void
  onCommentModeToggle: () => void
  onSelectVersion: (versionId: string | null) => void
  onRegenerate: () => void
  onSaveVersion: () => void
  onRestore: () => void
  onOpenHistory: () => void
  onExportMd: () => void
  onExportZip: () => void
  onCopyCursor: () => void
}

export function DocumentToolbar({
  docType,
  versions,
  activeVersionId,
  saveStatus,
  isReadOnly,
  canRegenerate,
  canSaveVersion,
  canRestore,
  canExportMd,
  canExportZip,
  canViewHistory,
  canComment,
  viewMode,
  isCommentMode,
  onViewModeChange,
  onCommentModeToggle,
  onSelectVersion,
  onRegenerate,
  onSaveVersion,
  onRestore,
  onOpenHistory,
  onExportMd,
  onExportZip,
  onCopyCursor,
}: DocumentToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-6 py-3">
      <div className="min-w-0 shrink">
        <h2 className="font-semibold text-gray-900">{DOCUMENT_TYPE_LABELS[docType]}</h2>
        <VersionPills
          versions={versions}
          activeVersionId={activeVersionId}
          onSelect={onSelectVersion}
        />
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {canComment && (
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange('edit')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs',
                viewMode === 'edit' ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Pencil className="h-3 w-3" />
              편집
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('review')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs',
                viewMode === 'review' ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Eye className="h-3 w-3" />
              리뷰
            </button>
            <button
              type="button"
              onClick={onCommentModeToggle}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs',
                isCommentMode ? 'bg-orange-50 font-medium text-orange-700' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              댓글모드
            </button>
          </div>
        )}

        {canComment && <div className="h-6 w-px bg-gray-200" aria-hidden />}

        <div className="flex items-center gap-2">
          <SaveStatus status={saveStatus} />
          {canViewHistory && (
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={onOpenHistory}>
              <History className="h-4 w-4" />
              히스토리
            </Button>
          )}
          <ExportMenu
            canExportMd={canExportMd}
            canExportZip={canExportZip}
            canCopyCursor={canExportMd}
            isCursorTab={docType === 'cursor_prompt'}
            onExportMd={onExportMd}
            onExportZip={onExportZip}
            onCopyCursor={onCopyCursor}
          />
          {!isReadOnly && canRegenerate && (
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={onRegenerate}>
              재생성
            </Button>
          )}
          {!isReadOnly && canSaveVersion && (
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={onSaveVersion}>
              버전 저장
            </Button>
          )}
          {isReadOnly && canRestore && (
            <Button className="px-3 py-1.5 text-xs" onClick={onRestore}>
              이 버전으로 복원
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
