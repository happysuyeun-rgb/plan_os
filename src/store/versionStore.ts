import { create } from 'zustand'
import type { DocumentVersion, DocumentVersionSummary } from '../types'
import { saveDocumentContent } from '../lib/api/documents'
import { useDocumentStore } from './documentStore'
import {
  createVersion as apiCreateVersion,
  fetchVersions as apiFetchVersions,
  fetchVersionSummaries as apiFetchSummaries,
} from '../lib/api/versions'

interface VersionState {
  versions: DocumentVersion[]
  summaries: Record<string, DocumentVersionSummary>
  activeVersionId: string | null
  isViewingPastVersion: boolean
  isLoading: boolean

  fetchVersions: (documentId: string) => Promise<void>
  fetchSummaries: (documentIds: string[]) => Promise<void>
  saveVersion: (documentId: string, content: string, name?: string) => Promise<void>
  selectVersion: (versionId: string | null) => void
  restoreVersion: (documentId: string, content: string) => Promise<void>
  reset: () => void
}

export const useVersionStore = create<VersionState>((set, get) => ({
  versions: [],
  summaries: {},
  activeVersionId: null,
  isViewingPastVersion: false,
  isLoading: false,

  fetchVersions: async (documentId) => {
    set({ isLoading: true })
    const versions = await apiFetchVersions(documentId)
    set({ versions, isLoading: false, activeVersionId: null, isViewingPastVersion: false })
  },

  fetchSummaries: async (documentIds) => {
    if (documentIds.length === 0) return
    const summaries = await apiFetchSummaries(documentIds)
    set({ summaries })
  },

  saveVersion: async (documentId, content, name) => {
    const version = await apiCreateVersion(documentId, content, name)
    const summary = await apiFetchSummaries([documentId])
    set((s) => ({
      versions: [version, ...s.versions],
      summaries: { ...s.summaries, ...summary },
      activeVersionId: null,
      isViewingPastVersion: false,
    }))
  },

  selectVersion: (versionId) => {
    set({
      activeVersionId: versionId,
      isViewingPastVersion: versionId !== null,
    })
  },

  restoreVersion: async (documentId, content) => {
    // Serialize the explicit restore after any pending autosave for this document.
    // Otherwise a delayed debounce can overwrite the restored version.
    await useDocumentStore.getState().replaceDocumentContent(documentId, async () => {
      await apiCreateVersion(documentId, content, '복원')
      return saveDocumentContent(documentId, content)
    })
    await get().fetchVersions(documentId)
    const summary = await apiFetchSummaries([documentId])
    set((s) => ({
      activeVersionId: null,
      isViewingPastVersion: false,
      summaries: { ...s.summaries, ...summary },
    }))
  },

  reset: () =>
    set({
      versions: [],
      summaries: {},
      activeVersionId: null,
      isViewingPastVersion: false,
      isLoading: false,
    }),
}))
