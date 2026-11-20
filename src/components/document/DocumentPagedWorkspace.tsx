import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { DocumentType } from '../../types'
import {
  parseDocumentOutline,
  replaceOutlineSection,
  type OutlineSection,
} from '../../lib/documentOutline'
import { parseWireframeContent, shouldUseStructuredRenderer } from '../../lib/documentContent'
import { DocumentStructurePanel } from './DocumentStructurePanel'
import { DocumentDecisionBar } from './DocumentDecisionBar'
import { DocumentPaperFrame } from './DocumentPaperFrame'
import { DocumentRenderer } from './DocumentRenderer'
import { Button } from '../common/Button'
import type { DocumentDecision } from '../../store/documentDecisionStore'

interface DocumentPagedWorkspaceProps {
  projectId: string
  docType: DocumentType
  content: string
  onChange: (value: string) => void
  readOnly?: boolean
  decision: DocumentDecision
  canDecide: boolean
  onApprove: () => void
  onReject: () => void
  onResetDecision: () => void
  /** When true, skip page split and show full document (e.g. comment review pane). */
  forceFull?: boolean
  children?: ReactNode
}

function outlineForDoc(docType: DocumentType, content: string): OutlineSection[] {
  if (docType === 'wireframe') {
    const slides = parseWireframeContent(content)
    if (slides && slides.length > 0) {
      return slides.map((slide, index) => ({
        id: slide.id || `slide-${index}`,
        index,
        level: 2,
        title: slide.name?.trim() || slide.code || `화면 ${index + 1}`,
        body: content, // page body handled by renderer; outline is nav-only for wireframe
      }))
    }
  }
  return parseDocumentOutline(content)
}

export function DocumentPagedWorkspace({
  docType,
  content,
  onChange,
  readOnly,
  decision,
  canDecide,
  onApprove,
  onReject,
  onResetDecision,
  forceFull,
  children,
}: DocumentPagedWorkspaceProps) {
  const sections = useMemo(() => outlineForDoc(docType, content), [docType, content])
  const [activeIndex, setActiveIndex] = useState(0)
  const [pageMode, setPageMode] = useState(true)

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, sections.length - 1)))
  }, [sections.length, docType])

  const structured = shouldUseStructuredRenderer(docType, content)
  const showPages = !forceFull && !structured && pageMode && sections.length > 0
  const active = sections[activeIndex] ?? sections[0]

  const handlePageChange = (nextBody: string) => {
    if (structured || readOnly) {
      onChange(nextBody)
      return
    }
    onChange(replaceOutlineSection(content, sections, activeIndex, nextBody))
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col" data-testid="document-paged-workspace">
      <DocumentDecisionBar
        decision={decision}
        canDecide={canDecide}
        onApprove={onApprove}
        onReject={onReject}
        onReset={onResetDecision}
      />

      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-1.5">
        <p className="text-[11px] text-slate-500">
          {showPages
            ? '구조 목록에서 페이지를 고르거나 아래 버튼으로 이동하세요'
            : '전체 문서를 한 번에 보고 있습니다'}
        </p>
        {!forceFull && (
          <button
            type="button"
            className="text-[11px] text-slate-600 underline-offset-2 hover:underline"
            onClick={() => setPageMode((v) => !v)}
            data-testid="document-page-mode-toggle"
          >
            {showPages ? '전체 보기' : '페이지로 보기'}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showPages && (
          <DocumentStructurePanel
            sections={sections}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {showPages && (
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                className="h-8 text-xs"
                disabled={activeIndex <= 0}
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                data-testid="document-page-prev"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                이전
              </Button>
              <p className="truncate text-sm font-medium text-slate-800">
                {active?.title ?? '문서'}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="h-8 text-xs"
                disabled={activeIndex >= sections.length - 1}
                onClick={() => setActiveIndex((i) => Math.min(sections.length - 1, i + 1))}
                data-testid="document-page-next"
              >
                다음
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <DocumentPaperFrame>
              {children ? (
                children
              ) : showPages ? (
                <DocumentRenderer
                  docType={docType}
                  value={active?.body ?? ''}
                  onChange={handlePageChange}
                  readOnly={readOnly}
                />
              ) : (
                <DocumentRenderer
                  docType={docType}
                  value={content}
                  onChange={onChange}
                  readOnly={readOnly}
                />
              )}
            </DocumentPaperFrame>
          </div>
        </div>
      </div>
    </div>
  )
}
