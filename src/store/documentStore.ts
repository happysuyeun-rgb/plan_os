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

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: {},
  activeDocType: 'prd',
  content: '',
  saveStatus: 'saved',
  isReadOnly: false,
  isLoading: false,

  fetchDocuments: async (projectId) => {
    set({ isLoading: true })
    const docs = await apiFetchDocuments(projectId)
    const map: Partial<Record<DocumentType, Document>> = {}
    for (const doc of docs) map[doc.type] = doc
    const { activeDocType } = get()
    const active = map[activeDocType]
    set({
      documents: map,
      content: active?.content ?? '',
      isLoading: false,
      saveStatus: 'saved',
    })
  },

  setActiveDocType: (type) => {
    const doc = get().documents[type]
    set({
      activeDocType: type,
      content: doc?.content ?? '',
      isReadOnly: false,
      saveStatus: 'saved',
    })
  },

  setContent: (content) => set({ content }),

  updateContent: (content) => {
    set({ content, saveStatus: 'saving' })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => get().autoSave(), 2000)
  },

  autoSave: async () => {
    const { documents, activeDocType, content, isReadOnly } = get()
    const doc = documents[activeDocType]
    if (!doc || isReadOnly) return

    try {
      const updated = await apiSaveDocumentContent(doc.id, content)
      set((s) => ({
        documents: { ...s.documents, [activeDocType]: updated },
        saveStatus: 'saved',
      }))
    } catch {
      set({ saveStatus: 'error' })
    }
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
