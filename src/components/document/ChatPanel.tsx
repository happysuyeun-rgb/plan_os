import { useRef, type ChangeEvent } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import type { DocumentType } from '../../types'
import { Button } from '../common/Button'
import { EditableChatTitle } from './EditableChatTitle'
import { RelatedDocsNotice } from './RelatedDocsNotice'
import { useChatStore } from '../../store/chatStore'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'

interface ChatPanelProps {
  projectId: string
  documentId: string
  docType: DocumentType
  chatTitle: string
  canEditTitle?: boolean
  onChatTitleSave: (title: string) => void | Promise<void>
  onMessageSent?: () => void
  disabled?: boolean
}

export function ChatPanel({
  projectId,
  documentId,
  docType,
  chatTitle,
  canEditTitle,
  onChatTitleSave,
  onMessageSent,
  disabled,
}: ChatPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const showToast = useUIStore((s) => s.showToast)
  const {
    messages,
    input,
    pendingAttachments,
    isStreaming,
    setInput,
    sendMessage,
    addAttachment,
    removeAttachment,
  } = useChatStore()

  const handleSend = async () => {
    try {
      const updated = await sendMessage(projectId, documentId)
      if (updated !== null) onMessageSent?.()
      // The document store has already updated and scheduled the exact document.
      // Do not enqueue the same content via the currently active editor tab.
    } catch {
      showToast('error', '채팅 요청을 문서에 반영하지 못했습니다. 문서 저장 상태를 확인해 주세요.')
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of files) {
      const error = addAttachment(file)
      if (error) showToast('error', error)
    }
    e.target.value = ''
  }

  const canSend = !disabled && !isStreaming && (input.trim() || pendingAttachments.length > 0)

  return (
    <aside className="flex w-[min(360px,30vw)] min-w-[280px] shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <EditableChatTitle
          title={chatTitle}
          canEdit={canEditTitle}
          onSave={onChatTitleSave}
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-400">
            문서 수정을 AI에게 요청하세요
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
              msg.role === 'user'
                ? 'ml-4 bg-brand-50 text-brand-900'
                : 'mr-4 bg-gray-100 text-gray-800',
            )}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="mb-2">
          <RelatedDocsNotice docType={docType} />
        </div>

        {pendingAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pendingAttachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2 pr-1 text-xs text-gray-700"
              >
                <span className="truncate">{att.file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  aria-label={`${att.file.name} 제거`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp,image/*,text/*"
          onChange={handleFileChange}
        />

        <div className="flex items-end gap-1.5">
          <button
            type="button"
            title="파일 첨부"
            disabled={disabled || isStreaming}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors',
              !disabled && !isStreaming && 'hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700',
              (disabled || isStreaming) && 'cursor-not-allowed opacity-50',
            )}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSend) void handleSend()
              }
            }}
            maxLength={1000}
            rows={2}
            disabled={disabled || isStreaming}
            placeholder="'@'를 입력해 채팅에 항목을 언급할 수 있어요."
            className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <Button
            onClick={handleSend}
            isLoading={isStreaming}
            disabled={!canSend}
            className="h-9 w-9 shrink-0 px-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-right text-[10px] text-gray-400 tabular-nums">
          {input.length}/1000
        </p>
      </div>
    </aside>
  )
}
