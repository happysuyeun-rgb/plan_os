import { create } from 'zustand'
import type { DocumentVersion, DocumentVersionSummary } from '../types'
import { useDocumentStore } from './documentStore'
import {
  createVersion as apiCreateVersion,
  fetchVersions as apiFetchVersions,
  restoreDocumentVersion as apiRestoreDocumentVersion,
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
  restoreVersion: (documentId: string, versionId: string) => Promise<void>
  reset: () => void
}

// A failed HTTP response can be ambiguous (the DB may have committed). Keep
// the operation UUID for the same document+target across a user retry.
const pendingRestoreIds = new Map<string, string>()

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

  restoreVersion: async (documentId, versionId) => {
    // Pending autosave must finish before starting the server transaction.
    // The locked server RPC creates a pre-restore checkpoint if the latest
    // saved version differs from the current durable document body.
    const operationKey = `${documentId}:${versionId}`
    const operationId = pendingRestoreIds.get(operationKey) ?? crypto.randomUUID()
    pendingRestoreIds.set(operationKey, operationId)
    await useDocumentStore.getState().replaceDocumentContent(documentId, () =>
      apiRestoreDocumentVersion(documentId, versionId, operationId),
    )

    // A refresh failure after a committed restore is safe to retry with the
    // *same* UUID. The server returns existing operation without duplicating.
    await get().fetchVersions(documentId)
    const summary = await apiFetchSummaries([documentId])
    set((s) => ({
      activeVersionId: null,
      isViewingPastVersion: false,
      summaries: { ...s.summaries, ...summary },
    }))
    pendingRestoreIds.delete(operationKey)
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
