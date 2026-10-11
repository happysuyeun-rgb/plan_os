import { Layout, Lock } from 'lucide-react'
import type { DocumentType, SidebarVersionInfo } from '../../types'
import { DOCUMENT_TYPE_LABELS } from '../../types'
import { DOCUMENT_TYPE_UI_ORDER } from '../../lib/documentTypes'
import { TEST_UNLOCK_ALL_DOCUMENTS } from '../../config'
import { cn } from '../../lib/utils'

const DOC_TYPE_ICONS: Partial<Record<DocumentType, typeof Layout>> = {
  wireframe: Layout,
}

interface DocumentTypeTabsProps {
  activeType: DocumentType
  availableTypes: DocumentType[]
  openCommentCounts?: Partial<Record<DocumentType, number>>
  versionInfo?: Partial<Record<DocumentType, SidebarVersionInfo>>
  onSelect: (type: DocumentType) => void
}

export function DocumentTypeTabs({
  activeType,
  availableTypes,
  openCommentCounts,
  versionInfo,
  onSelect,
}: DocumentTypeTabsProps) {
  return (
    <nav
      className="flex h-full max-w-full gap-0.5 overflow-x-auto"
      aria-label="산출물 탭"
    >
      {DOCUMENT_TYPE_UI_ORDER.map((type) => {
        const available = TEST_UNLOCK_ALL_DOCUMENTS || availableTypes.includes(type)
        const active = activeType === type
        const vInfo = versionInfo?.[type]
        const displayVersion =
          vInfo?.viewing_version_number ??
          (vInfo && vInfo.latest_version_number > 0 ? vInfo.latest_version_number : null)
        const showLatestBadge = available && vInfo?.is_on_latest
        const commentCount = openCommentCounts?.[type] ?? 0
        const Icon = DOC_TYPE_ICONS[type]

        return (
          <button
            key={type}
            type="button"
            disabled={!available}
            onClick={() => onSelect(type)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm transition-colors',
              active && 'font-medium text-brand-700',
              !active && available && 'text-gray-600 hover:text-gray-900',
              !available && 'cursor-not-allowed text-gray-300',
            )}
          >
            {active && (
              <span
                className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-brand-600"
                aria-hidden
              />
            )}
            {!available ? (
              <Lock className="h-3.5 w-3.5 shrink-0" />
            ) : Icon ? (
              <Icon className="h-3.5 w-3.5 shrink-0" />
            ) : null}
            <span>{DOCUMENT_TYPE_LABELS[type]}</span>
            {available && displayVersion != null && (
              <span
                className={cn(
                  'text-[10px] font-medium tabular-nums',
                  vInfo?.viewing_version_number != null ? 'text-amber-600' : 'text-gray-400',
                )}
              >
                v{displayVersion}
              </span>
            )}
            {showLatestBadge && (
              <span className="rounded bg-brand-100 px-1 py-px text-[9px] font-semibold leading-tight text-brand-700">
                최종
              </span>
            )}
            {commentCount > 0 && (
              <span className="rounded-full bg-orange-100 px-1.5 text-[10px] font-medium text-orange-700">
                {commentCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
