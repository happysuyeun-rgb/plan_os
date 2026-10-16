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
  input: string
  pendingAttachments: PendingChatAttachment[]
  isStreaming: boolean
  activeContext: string | null

  fetchMessages: (projectId: string, documentId?: string) => Promise<void>
  sendMessage: (projectId: string, documentId: string) => Promise<string | null>
  setInput: (input: string) => void
  clearInput: () => void
  addAttachment: (file: File) => string | null
  removeAttachment: (id: string) => void
  clearAttachments: () => void
  reset: () => void
}

function clearAllAttachmentPreviews(attachments: PendingChatAttachment[]) {
  for (const a of attachments) revokeAttachmentPreview(a)
}

// Prevent an old request's finally block from resetting a newer chat's spinner.
let sendSequence = 0

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  input: '',
  pendingAttachments: [],
  isStreaming: false,
  activeContext: null,

  fetchMessages: async (projectId, documentId) => {
    const context = `${projectId}:${documentId ?? ''}`
    set({ activeContext: context, messages: [] })
    const messages = await apiFetchChatMessages(projectId, documentId)
    if (get().activeContext === context) set({ messages })
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

      const result = await apiSendChatMessage(
        projectId,
        documentId,
        content,
        (targetProjectId, targetDocumentId, message) =>
          useDocumentStore.getState().applyChatEdit(targetProjectId, targetDocumentId, message),
      )
      useAuthStore.getState().incrementAiGeneration()
      clearAllAttachmentPreviews(pendingAttachments)
      set((s) => ({
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

  setInput: (input) => set({ input }),
  clearInput: () => set({ input: '' }),

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
    set({ messages: [], input: '', pendingAttachments: [], isStreaming: false, activeContext: null })
  },
}))
