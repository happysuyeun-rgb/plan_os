import { useRef, type ChangeEvent } from 'react'
import { Loader2, Paperclip, Send, X } from 'lucide-react'
import type { DocumentType } from '../../types'
import { DOCUMENT_TYPE_LABELS } from '../../types'
import { EditableChatTitle } from './EditableChatTitle'
import { RelatedDocsNotice } from './RelatedDocsNotice'
import { parseContinueIntent } from '../../lib/generationContinueIntent'
import { useChatStore } from '../../store/chatStore'
import { useGenerationStore } from '../../store/generationStore'
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
    localMessagesByProject,
    input,
    pendingAttachments,
    isStreaming,
    setInput,
    sendMessage,
    addAttachment,
    removeAttachment,
  } = useChatStore()
  const awaitingUserContinue = useGenerationStore((s) => s.awaitingUserContinue)
  const pipelineGenerating = useGenerationStore((s) => s.isGenerating)
  const nextStep = useGenerationStore((s) => s.nextStep)
  const currentStep = useGenerationStore((s) => s.currentStep)
  const continuePipeline = useGenerationStore((s) => s.continuePipeline)
  const pausePipeline = useGenerationStore((s) => s.pausePipeline)
  const pipelineProjectId = useGenerationStore((s) => s.pipelineInput?.projectId)

  const pipelinePhase = useGenerationStore((s) => s.phase)
  const guidedActive =
    pipelineProjectId === projectId &&
    (awaitingUserContinue ||
      pipelineGenerating ||
      pipelinePhase === 'awaiting' ||
      pipelinePhase === 'paused')
  const showContinueCta = Boolean(
    nextStep &&
      (awaitingUserContinue || pipelinePhase === 'awaiting' || pipelinePhase === 'paused') &&
      (!pipelineProjectId || pipelineProjectId === projectId),
  )
  const localMessages = localMessagesByProject[projectId] ?? []
  const displayMessages = [...localMessages, ...messages]

  const handleSend = async () => {
    const trimmed = input.trim()

    if (guidedActive && awaitingUserContinue && pipelineProjectId === projectId) {
      if (!trimmed) return
      const intent = parseContinueIntent(trimmed, {
        nextStepLabel: nextStep ? DOCUMENT_TYPE_LABELS[nextStep] : null,
      })
      setInput('')
      useChatStore.getState().appendLocalUserMessage(projectId, trimmed)
      if (intent === 'continue') {
        void continuePipeline()
        return
      }
      if (intent === 'pause') {
        pausePipeline()
        return
      }
      useChatStore
        .getState()
        .appendLocalAssistantMessage(
          projectId,
          nextStep
            ? `「진행해줘」 또는 「${DOCUMENT_TYPE_LABELS[nextStep]} 작성해줘」라고 답해 주세요. 지금은 ${DOCUMENT_TYPE_LABELS[nextStep]} 진행 여부만 확인할 수 있습니다.`
            : '「진행해줘」 또는 「아직」으로 답해 주세요.',
        )
      return
    }

    if (guidedActive && pipelineGenerating) {
      showToast('info', '문서 작성 중입니다. 잠시만 기다려 주세요.')
      return
    }

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

  const pipelineBusy = guidedActive && pipelineGenerating
  // Parent may disable CAS chat before the first doc exists; still allow continue/pause.
  const guidedReplyAllowed = guidedActive && awaitingUserContinue
  const canSend =
    (!disabled || guidedReplyAllowed) &&
    !isStreaming &&
    !pipelineBusy &&
    (input.trim() || (!awaitingUserContinue && pendingAttachments.length > 0))

  const placeholder = awaitingUserContinue
    ? '「진행해줘」 또는 「아직」'
    : pipelineBusy
      ? '문서 작성 중…'
      : "'@'를 입력해 채팅에 항목을 언급할 수 있어요."

  return (
    <aside className="flex w-[min(360px,30vw)] min-w-[280px] shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <EditableChatTitle
          title={chatTitle}
          canEdit={canEditTitle && !guidedActive}
          onSave={onChatTitleSave}
        />
        {guidedActive && (
          <p className="mt-1 text-[11px] text-slate-500" data-testid="pipeline-chat-status">
            {pipelineBusy
              ? `${DOCUMENT_TYPE_LABELS[currentStep ?? docType]} 작성 중`
              : nextStep
                ? `다음: ${DOCUMENT_TYPE_LABELS[nextStep]} — 진행할까요?`
                : '산출물 순차 작성'}
          </p>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {displayMessages.length === 0 && (
          <p className="text-center text-xs text-gray-400">
            문서 수정을 AI에게 요청하세요
          </p>
        )}
        {displayMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
              msg.role === 'user'
                ? 'ml-4 bg-brand-50 text-brand-900'
                : 'mr-4 bg-gray-100 text-gray-800',
            )}
            data-testid={msg.id.startsWith('local-') ? 'pipeline-chat-message' : undefined}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/80 p-3">
        {!showContinueCta && (
          <div className="mb-2">
            <RelatedDocsNotice docType={docType} />
          </div>
        )}

        {showContinueCta && nextStep && (
          <div className="mb-3 grid grid-cols-2 gap-2" data-testid="pipeline-continue-cta">
            <button
              type="button"
              onClick={() => {
                useChatStore
                  .getState()
                  .appendLocalUserMessage(
                    projectId,
                    `${DOCUMENT_TYPE_LABELS[nextStep]} 작성해줘`,
                  )
                void continuePipeline()
              }}
              disabled={pipelineBusy}
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-lg bg-brand-600 px-2 text-xs font-semibold text-white transition-colors',
                'hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300',
              )}
            >
              {DOCUMENT_TYPE_LABELS[nextStep]} 작성
            </button>
            <button
              type="button"
              onClick={() => {
                useChatStore.getState().appendLocalUserMessage(projectId, '아직')
                pausePipeline()
              }}
              disabled={pipelineBusy}
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 transition-colors',
                'hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              아직
            </button>
          </div>
        )}

        {pendingAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pendingAttachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white py-1 pl-2 pr-1 text-xs text-slate-700"
              >
                <span className="truncate">{att.file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={`${att.file.name} 제거`}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
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

        <div className="flex items-end gap-2">
          <button
            type="button"
            title="파일 첨부"
            aria-label="파일 첨부"
            disabled={disabled || isStreaming || guidedActive}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors',
              !disabled &&
                !isStreaming &&
                !guidedActive &&
                'hover:border-slate-400 hover:bg-white hover:text-slate-900',
              (disabled || isStreaming || guidedActive) && 'cursor-not-allowed opacity-40',
            )}
          >
            <Paperclip className="h-4 w-4" strokeWidth={2} />
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
            disabled={(!guidedReplyAllowed && disabled) || isStreaming || pipelineBusy}
            placeholder={placeholder}
            className={cn(
              'min-h-10 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-5 text-slate-900 outline-none',
              'placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
              'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
            )}
            data-testid="pipeline-chat-input"
          />
          <button
            type="button"
            title="전송"
            aria-label="전송"
            onClick={() => void handleSend()}
            disabled={!canSend || isStreaming}
            className={cn(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
              canSend && !isStreaming
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'cursor-not-allowed bg-slate-200 text-slate-400',
            )}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-right text-[11px] text-slate-400 tabular-nums">
          {input.length}/1000
        </p>
      </div>
    </aside>
  )
}
