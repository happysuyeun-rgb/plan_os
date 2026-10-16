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
  replaceDocumentContent: (documentId: string, write: () => Promise<Document>) => Promise<void>
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

  replaceDocumentContent: async (documentId, write) => {
    await autosave.replace(documentId, async () => {
      const updated = await write()
      if (updated.id !== documentId) {
        throw new Error('Document ID changed during replacement')
      }
      return updated.content
    })
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
