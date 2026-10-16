import { create } from 'zustand'
import type { Document, DocumentType } from '../types'
import {
  fetchDocuments as apiFetchDocuments,
  saveDocumentContent as apiSaveDocumentContent,
} from '../lib/api/documents'
import {
  regenerateCascade as apiRegenerateCascade,
  regenerateDocument as apiRegenerateDocument,
} from '../lib/api/generation'
import { useAuthStore } from './authStore'
import { createDocumentAutosave } from '../lib/documentAutosave'

interface DocumentState {
  documents: Partial<Record<DocumentType, Document>>
  activeDocType: DocumentType
  content: string
  saveStatus: 'saved' | 'saving' | 'error'
  isReadOnly: boolean
  isLoading: boolean

  fetchDocuments: (projectId: string) => Promise<void>
  setActiveDocType: (type: DocumentType) => void
  updateContent: (content: string) => void
  setContent: (content: string) => void
  autoSave: () => Promise<void>
  regenerate: (projectId: string, type: DocumentType, title: string, targetUser: string) => Promise<void>
  regenerateCascade: (projectId: string, fromType: DocumentType, title: string, targetUser: string) => Promise<void>
  setReadOnly: (readOnly: boolean) => void
}

// The callbacks are invoked only after the store is initialized and edits occur.
const autosave = createDocumentAutosave<Document>({
  persist: apiSaveDocumentContent,
  onSaved: (documentId, _content, updated) => {
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

  fetchDocuments: async (projectId) => {
    const sequence = ++fetchSequence
    set({ isLoading: true })
    try {
      const docs = await apiFetchDocuments(projectId)
      if (sequence !== fetchSequence) return // ignore an older project's response
      const map: Partial<Record<DocumentType, Document>> = {}
      for (const doc of docs) {
        const cached = get().documents[doc.type]
        map[doc.type] =
          cached?.id === doc.id && autosave.getStatus(doc.id) !== 'saved'
            ? { ...doc, content: cached.content } // do not wipe unsaved edits
            : doc
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
    const { activeDocType, documents, isReadOnly } = get()
    if (isReadOnly) return
    const doc = documents[activeDocType]
    if (!doc) return
    // Keep the user's text with its original document while navigating tabs.
    set((state) => ({
      content,
      saveStatus: 'saving',
      documents: {
        ...state.documents,
        [activeDocType]: { ...doc, content },
      },
    }))
    autosave.schedule(doc.id, content)
  },

  autoSave: async () => {
    const { documents, activeDocType, isReadOnly } = get()
    const doc = documents[activeDocType]
    if (!doc || isReadOnly) return
    await autosave.flush(doc.id)
  },

  regenerate: async (projectId, type, title, targetUser) => {
    const content = await apiRegenerateDocument(projectId, type, title, targetUser)
    useAuthStore.getState().incrementAiGeneration()
    set((s) => {
      const doc = s.documents[type]
      if (!doc) return s
      return {
        documents: { ...s.documents, [type]: { ...doc, content } },
        content: s.activeDocType === type ? content : s.content,
      }
    })
  },

  regenerateCascade: async (projectId, fromType, title, targetUser) => {
    const results = await apiRegenerateCascade(projectId, fromType, title, targetUser)
    useAuthStore.getState().incrementAiGeneration()
    set((s) => {
      const updatedDocs = { ...s.documents }
      for (const [type, content] of Object.entries(results)) {
        const docType = type as DocumentType
        const doc = updatedDocs[docType]
        if (doc && content) {
          updatedDocs[docType] = { ...doc, content }
        }
      }
      const activeContent = results[s.activeDocType]
      return {
        documents: updatedDocs,
        content: activeContent ?? s.content,
      }
    })
  },

  setReadOnly: (readOnly) => set({ isReadOnly: readOnly }),
}))
