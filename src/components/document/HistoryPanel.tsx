import { useState } from 'react'
import type { DocumentVersion, ProjectActivity } from '../../types'
import type { ChatMessage } from '../../types'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { VersionPills } from './VersionPills'
import { ActivityTimeline } from './ActivityTimeline'
import { cn } from '../../lib/utils'

type Tab = 'versions' | 'chat' | 'activity'

interface HistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  versions: DocumentVersion[]
  activeVersionId: string | null
  onSelectVersion: (id: string | null) => void
  onExportVersion?: (version: DocumentVersion) => void
  messages: ChatMessage[]
  activities: ProjectActivity[]
  isLoading: boolean
}

export function HistoryPanel({
  isOpen,
  onClose,
  versions,
  activeVersionId,
  onSelectVersion,
  onExportVersion,
  messages,
  activities,
  isLoading,
}: HistoryPanelProps) {
  const [tab, setTab] = useState<Tab>('versions')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="히스토리" className="max-w-lg">
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {(['versions', 'chat', 'activity'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-xs font-medium transition',
              tab === t ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600',
            )}
          >
            {t === 'versions' ? '버전' : t === 'chat' ? '채팅' : '활동'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-8" />
      ) : (
        <>
          {tab === 'versions' && (
            <div className="space-y-4">
              <VersionPills
                versions={versions}
                activeVersionId={activeVersionId}
                onSelect={onSelectVersion}
              />
              <ul className="max-h-60 space-y-2 overflow-y-auto">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">v{v.version_number}</span>
                      {v.version_name && (
                        <span className="ml-2 text-gray-500">{v.version_name}</span>
                      )}
                      <p className="text-xs text-gray-400">
                        {new Date(v.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    {onExportVersion && (
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => onExportVersion(v)}
                      >
                        MD
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === 'chat' && (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">채팅 기록 없음</p>
              ) : (
                messages.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm',
                      m.role === 'user' ? 'bg-brand-50' : 'bg-gray-50',
                    )}
                  >
                    <span className="text-xs font-medium text-gray-500">
                      {m.role === 'user' ? '나' : 'AI'}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
                  </li>
                ))
              )}
            </ul>
          )}
          {tab === 'activity' && (
            <div className="max-h-72 overflow-y-auto">
              <ActivityTimeline activities={activities} />
            </div>
          )}
        </>
      )}

      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}
