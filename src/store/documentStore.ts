import { create } from 'zustand'
import type { Document, DocumentType } from '../types'
import {
  fetchDocuments as apiFetchDocuments,
  saveDocumentContent as apiSaveDocumentContent,
} from '../lib/api/documents'
import {
  CASCADE_STEPS,
  regenerateDocument as apiRegenerateDocument,
} from '../lib/api/generation'
import { useAuthStore } from './authStore'
import { updateProject as apiUpdateProject } from '../lib/api/projects'
import { createDocumentAutosave } from '../lib/documentAutosave'
import { getUnsavedDraft, storeUnsavedDraft, clearUnsavedDraft } from '../lib/unsavedDraft'
import { commitChatDocumentRPC, type AtomicChatEditResult } from '../lib/api/chat'

interface DocumentState {
  documents: Partial<Record<DocumentType, Document>>
  activeDocType: DocumentType
  content: string
  saveStatus: 'saved' | 'saving' | 'error'
  isReadOnly: boolean
  isLoading: boolean
  chatWritingDocumentId: string | null

  fetchDocuments: (projectId: string) => Promise<void>
  setActiveDocType: (type: DocumentType) => void
  updateContent: (content: string) => void
  setContent: (content: string) => void
  autoSave: () => Promise<void>
  replaceDocumentContent: (documentId: string, write: () => Promise<Document>) => Promise<void>
  commitChatEdit: (projectId: string, documentId: string, message: string, operationId: string) => Promise<AtomicChatEditResult>
  regenerate: (projectId: string, type: DocumentType, title: string, targetUser: string) => Promise<void>
  regenerateCascade: (projectId: string, fromType: DocumentType, title: string, targetUser: string) => Promise<void>
  setReadOnly: (readOnly: boolean) => void
}

// The callbacks are invoked only after the store is initialized and edits occur.
const autosave = createDocumentAutosave<Document>({
  persist: apiSaveDocumentContent,
  onSaved: (documentId, savedContent, updated) => {
    const userId = useAuthStore.getState().user?.id
    if (userId) clearUnsavedDraft(userId, documentId, savedContent)
    useDocumentStore.setState((state) => {
      const entry = Object.entries(state.documents).find(([, doc]) => doc?.id === documentId)
      if (!entry) return state // e.g. user has switched projects
      const [type, local] = entry as [DocumentType, Document]
      return {
        documents: {
          ...state.documents,
          [type]: { ...updated, content: local.content },
        },
        saveStatus: state.activeDocType === type ? 'saved' : state.saveStatus,
      }
    })
  },
  onReplaced: (documentId, content) => {
    useDocumentStore.setState((state) => {
      const entry = Object.entries(state.documents).find(([, doc]) => doc?.id === documentId)
      if (!entry) return state
      const [type, doc] = entry as [DocumentType, Document]
      return {
        documents: {
          ...state.documents,
          [type]: { ...doc, content },
        },
        content: state.activeDocType === type && !state.isReadOnly ? content : state.content,
        saveStatus: state.activeDocType === type ? autosave.getStatus(documentId) : state.saveStatus,
      }
    })
  },
  onError: (documentId) => {
    useDocumentStore.setState((state) => {
      const active = state.documents[state.activeDocType]
      return active?.id === documentId ? { saveStatus: 'error' } : state
    })
  },
})

let fetchSequence = 0

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: {},
  activeDocType: 'prd',
  content: '',
  saveStatus: 'saved',
  isReadOnly: false,
  isLoading: false,
  chatWritingDocumentId: null,

  fetchDocuments: async (projectId) => {
    const sequence = ++fetchSequence
    set({ isLoading: true })
    try {
      const docs = await apiFetchDocuments(projectId)
      if (sequence !== fetchSequence) return // ignore an older project's response
      const map: Partial<Record<DocumentType, Document>> = {}
      const userId = useAuthStore.getState().user?.id
      for (const doc of docs) {
        const cached = get().documents[doc.type]
        if (cached?.id === doc.id && autosave.getStatus(doc.id) !== 'saved') {
          map[doc.type] = { ...doc, content: cached.content }
          continue
        }
        const draft = userId ? getUnsavedDraft(userId, doc.id) : null
        if (draft && draft.base === doc.content && draft.content !== doc.content) {
          // Recover only if another client has not modified the server baseline.
          map[doc.type] = { ...doc, content: draft.content }
          autosave.schedule(doc.id, draft.content)
        } else {
          map[doc.type] = doc
          if (draft && userId && draft.content === doc.content) {
            clearUnsavedDraft(userId, doc.id, doc.content)
          }
        }
      }
      const { activeDocType } = get()
      const active = map[activeDocType]
      set({
        documents: map,
        content: active?.content ?? '',
        isLoading: false,
        saveStatus: autosave.getStatus(active?.id),
      })
    } catch (error) {
      if (sequence === fetchSequence) set({ isLoading: false })
      throw error
    }
  },

  setActiveDocType: (type) => {
    const doc = get().documents[type]
    set({
      activeDocType: type,
      content: doc?.content ?? '',
      isReadOnly: false,
      saveStatus: autosave.getStatus(doc?.id),
    })
  },

  setContent: (content) => set({ content }),

  updateContent: (content) => {
    const { activeDocType, documents, isReadOnly, chatWritingDocumentId } = get()
    const doc = documents[activeDocType]
    if (!doc || isReadOnly || chatWritingDocumentId === doc.id) return
    // Keep the user's text with its original document while navigating tabs.
    set((state) => ({
      content,
      saveStatus: 'saving',
      documents: {
        ...state.documents,
        [activeDocType]: { ...doc, content },
      },
    }))
    const userId = useAuthStore.getState().user?.id
    if (userId) storeUnsavedDraft(userId, doc.id, doc.content, content)
    autosave.schedule(doc.id, content)
  },

  autoSave: async () => {
    const { documents, activeDocType, isReadOnly } = get()
    const doc = documents[activeDocType]
    if (!doc || isReadOnly) return
    await autosave.flush(doc.id)
  },

  replaceDocumentContent: async (documentId, write) => {
    await autosave.replace(documentId, async () => {
      const updated = await write()
      if (updated.id !== documentId) {
        throw new Error('Document ID changed during replacement')
      }
      return updated.content
    })
  },

  commitChatEdit: async (projectId, documentId, message, operationId) => {
    // The RPC is a server transaction, but the browser still owns an unsaved
    // editor buffer. Serialize behind that buffer, as for version restore.
    const current = Object.entries(get().documents).find(
      ([, doc]) => doc?.id === documentId && doc.project_id === projectId,
    )
    if (!current) throw new Error('Chat document no longer exists in the active project')
    if (get().chatWritingDocumentId) throw new Error('Another chat edit is already in progress')
    if (get().isReadOnly && get().activeDocType === current[0]) {
      throw new Error('Cannot edit a historical version through chat')
    }

    // Do not allow a new human edit of this document while its atomic RPC is
    // pending. Otherwise a later local autosave could overwrite the server
    // append with content based on a pre-chat buffer. Other tabs stay editable.
    set({ chatWritingDocumentId: documentId })
    let result: AtomicChatEditResult | null = null
    try {
      await autosave.replace(documentId, async () => {
        const stillCurrent = Object.values(get().documents).some(
          (doc) => doc?.id === documentId && doc.project_id === projectId,
        )
        if (!stillCurrent) throw new Error('Chat document changed before commit')
        result = await commitChatDocumentRPC(projectId, documentId, message, operationId)
        return result.updatedContent
      })
      if (!result) throw new Error('No committed chat transaction response')
      return result
    } finally {
      if (get().chatWritingDocumentId === documentId) {
        set({ chatWritingDocumentId: null })
      }
    }
  },

  regenerate: async (projectId, type, title, targetUser) => {
    const doc = get().documents[type]
    const write = () => apiRegenerateDocument(projectId, type, title, targetUser)
    const content = doc
      ? await autosave.replace(doc.id, write)
      : await write()
    useAuthStore.getState().incrementAiGeneration()
    if (!doc) {
      set((s) => ({
        content: s.activeDocType === type ? content : s.content,
      }))
    }
  },

  regenerateCascade: async (projectId, fromType, title, targetUser) => {
    // Each document must complete pending edits before its regeneration write.
    // Do not use the legacy unguarded regenerateCascade(), which upserts outside
    // the per-document lane and can be overwritten by delayed autosaves.
    for (const type of CASCADE_STEPS[fromType]) {
      const doc = get().documents[type]
      const write = () => apiRegenerateDocument(projectId, type, title, targetUser)
      if (doc) {
        await autosave.replace(doc.id, write)
      } else {
        await write()
      }
    }
    await apiUpdateProject(projectId, {
      memory_summary: `${title} | 연쇄 재생성 (${fromType})`,
    })
    useAuthStore.getState().incrementAiGeneration()
  },

  setReadOnly: (readOnly) => set({ isReadOnly: readOnly }),
}))
