import type { ReactNode } from 'react'
import { EditableProjectTitle } from '../project/EditableProjectTitle'

interface DocumentLayoutProps {
  projectTitle: string
  canEditProjectTitle?: boolean
  onProjectTitleSave?: (title: string) => void | Promise<void>
  onBack: () => void
  headerActions?: ReactNode
  docTabs?: ReactNode
  leftPanel?: ReactNode
  toolbar: ReactNode
  editor: ReactNode
  rightPanel?: ReactNode
}

export function DocumentLayout({
  projectTitle,
  canEditProjectTitle,
  onProjectTitleSave,
  onBack,
  headerActions,
  docTabs,
  leftPanel,
  toolbar,
  editor,
  rightPanel,
}: DocumentLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <div className="flex h-12 items-center gap-3 px-4">
          <div className="flex min-w-0 shrink-0 items-center">
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 text-sm text-gray-500 hover:text-gray-900"
            >
              ← 대시보드
            </button>
            <EditableProjectTitle
              title={projectTitle}
              canEdit={canEditProjectTitle && !!onProjectTitleSave}
              onSave={onProjectTitleSave ?? (async () => {})}
              className="ml-4 max-w-[200px] sm:max-w-xs"
            />
          </div>

          {docTabs && (
            <div className="flex min-w-0 flex-1 justify-center overflow-hidden">
              {docTabs}
            </div>
          )}

          {headerActions && <div className="shrink-0">{headerActions}</div>}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {leftPanel}
        <main className="flex min-w-[400px] flex-1 flex-col overflow-hidden">
          {toolbar}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">{editor}</div>
        </main>
        {rightPanel}
      </div>
    </div>
  )
}
