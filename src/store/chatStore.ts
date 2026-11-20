import { create } from 'zustand'
import type { ChatMessage } from '../types'
import {
  buildAttachmentContent,
  createPendingAttachment,
  revokeAttachmentPreview,
  validateChatAttachment,
  type PendingChatAttachment,
} from '../lib/chatAttachments'
import { fetchChatMessages as apiFetchChatMessages, sendChatMessage as apiSendChatMessage } from '../lib/api/chat'
import { useAuthStore } from './authStore'
import { useDocumentStore } from './documentStore'

interface ChatState {
  messages: ChatMessage[]
  /** Pipeline narration (not persisted / not CAS). Keyed by projectId. */
  localMessagesByProject: Record<string, ChatMessage[]>
  input: string
  // Keep unsent chat drafts scoped to their project/document identity.
  inputByContext: Record<string, string>
  pendingAttachments: PendingChatAttachment[]
  isStreaming: boolean
  activeContext: string | null

  fetchMessages: (projectId: string, documentId?: string) => Promise<void>
  sendMessage: (projectId: string, documentId: string) => Promise<string | null>
  appendLocalAssistantMessage: (projectId: string, content: string) => void
  appendLocalUserMessage: (projectId: string, content: string) => void
  clearLocalMessages: (projectId: string) => void
  setInput: (input: string) => void
  clearInput: () => void
  addAttachment: (file: File) => string | null
  removeAttachment: (id: string) => void
  clearAttachments: () => void
  reset: () => void
}

const LOCAL_CHAT_KEY = 'planos_local_chat_v1'

function loadLocalMessages(): Record<string, ChatMessage[]> {
  try {
    const raw = sessionStorage.getItem(LOCAL_CHAT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ChatMessage[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistLocalMessages(map: Record<string, ChatMessage[]>) {
  try {
    sessionStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function localMessage(
  projectId: string,
  role: 'user' | 'assistant',
  content: string,
): ChatMessage {
  return {
    id: `local-${role}-${crypto.randomUUID()}`,
    project_id: projectId,
    document_id: null,
    role,
    content,
    created_at: new Date().toISOString(),
  }
}

function clearAllAttachmentPreviews(attachments: PendingChatAttachment[]) {
  for (const a of attachments) revokeAttachmentPreview(a)
}

// A retry after an ambiguous HTTP error must reuse the same operation UUID.
// Include user ID in the key so accounts cannot share pending requests.
const pendingChatRequests = new Map<string, { content: string; operationId: string }>()
// Prevent an old request's finally block from resetting a newer chat's spinner.
let sendSequence = 0

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  localMessagesByProject: typeof sessionStorage === 'undefined' ? {} : loadLocalMessages(),
  input: '',
  inputByContext: {},
  pendingAttachments: [],
  isStreaming: false,
  activeContext: null,

  fetchMessages: async (projectId, documentId) => {
    const context = `${projectId}:${documentId ?? ''}`
    // Switching documents must not carry a pending/sent PRD prompt into IA.
    // Keep any unsent draft so returning to the original document can recover it.
    // Local pipeline narration is kept in localMessagesByProject (not cleared here).
    set((s) => ({ activeContext: context, messages: [], input: s.inputByContext[context] ?? '' }))
    const messages = await apiFetchChatMessages(projectId, documentId)
    if (get().activeContext === context) set({ messages })
  },

  appendLocalAssistantMessage: (projectId, content) => {
    const msg = localMessage(projectId, 'assistant', content)
    set((s) => {
      const localMessagesByProject = {
        ...s.localMessagesByProject,
        [projectId]: [...(s.localMessagesByProject[projectId] ?? []), msg],
      }
      persistLocalMessages(localMessagesByProject)
      return { localMessagesByProject }
    })
  },

  appendLocalUserMessage: (projectId, content) => {
    const msg = localMessage(projectId, 'user', content)
    set((s) => {
      const localMessagesByProject = {
        ...s.localMessagesByProject,
        [projectId]: [...(s.localMessagesByProject[projectId] ?? []), msg],
      }
      persistLocalMessages(localMessagesByProject)
      return { localMessagesByProject }
    })
  },

  clearLocalMessages: (projectId) => {
    set((s) => {
      const next = { ...s.localMessagesByProject }
      delete next[projectId]
      persistLocalMessages(next)
      return { localMessagesByProject: next }
    })
  },

  sendMessage: async (projectId, documentId) => {
    if (get().isStreaming) return null
    const requestSequence = ++sendSequence
    const { input, pendingAttachments } = get()
    const trimmed = input.trim()
    if (!trimmed && pendingAttachments.length === 0) return null

    set({ isStreaming: true })
    try {
      let content = trimmed
      if (pendingAttachments.length > 0) {
        const attachmentBlock = await buildAttachmentContent(pendingAttachments)
        content = content ? `${content}\n\n${attachmentBlock}` : attachmentBlock
      }

      const requestKey = `${useAuthStore.getState().user?.id ?? 'no-user'}:${projectId}:${documentId}`
      const previous = pendingChatRequests.get(requestKey)
      const operationId = previous?.content === content
        ? previous.operationId : crypto.randomUUID()
      pendingChatRequests.set(requestKey, { content, operationId })
      const result = await apiSendChatMessage(
        projectId,
        documentId,
        content,
        operationId,
        (targetProjectId, targetDocumentId, message, id) =>
          useDocumentStore.getState().commitChatEdit(targetProjectId, targetDocumentId, message, id),
      )
      pendingChatRequests.delete(requestKey)
      useAuthStore.getState().incrementAiGeneration()
      clearAllAttachmentPreviews(pendingAttachments)
      set((s) => ({
        // A successful send clears only its own saved draft, even if the user
        // has since opened another document with another unsent message.
        inputByContext: { ...s.inputByContext, [`${projectId}:${documentId}`]: '' },
        // A slow chat response must not enter a different document's conversation.
        messages:
          s.activeContext === `${projectId}:${documentId}`
            ? [...s.messages, result.userMessage, result.assistantMessage]
            : s.messages,
        input:
          s.activeContext === `${projectId}:${documentId}` ? '' : s.input,
        pendingAttachments:
          s.activeContext === `${projectId}:${documentId}` ? [] : s.pendingAttachments,
      }))
      return result.updatedContent
    } finally {
      if (requestSequence === sendSequence) set({ isStreaming: false })
    }
  },

  setInput: (input) => set((s) => ({
    input,
    inputByContext: s.activeContext
      ? { ...s.inputByContext, [s.activeContext]: input }
      : s.inputByContext,
  })),
  clearInput: () => set((s) => ({
    input: '',
    inputByContext: s.activeContext
      ? { ...s.inputByContext, [s.activeContext]: '' }
      : s.inputByContext,
  })),

  addAttachment: (file) => {
    const error = validateChatAttachment(file)
    if (error) return error
    const { pendingAttachments } = get()
    if (pendingAttachments.length >= 5) return '최대 5개까지 첨부할 수 있습니다'
    set({ pendingAttachments: [...pendingAttachments, createPendingAttachment(file)] })
    return null
  },

  removeAttachment: (id) => {
    const { pendingAttachments } = get()
    const target = pendingAttachments.find((a) => a.id === id)
    if (target) revokeAttachmentPreview(target)
    set({ pendingAttachments: pendingAttachments.filter((a) => a.id !== id) })
  },

  clearAttachments: () => {
    clearAllAttachmentPreviews(get().pendingAttachments)
    set({ pendingAttachments: [] })
  },

  reset: () => {
    sendSequence += 1
    clearAllAttachmentPreviews(get().pendingAttachments)
    // Keep localMessagesByProject — guided pipeline narration must survive
    // DocumentPage remounts when switching doc tabs.
    set({
      messages: [],
      input: '',
      inputByContext: {},
      pendingAttachments: [],
      isStreaming: false,
      activeContext: null,
    })
  },
}))
