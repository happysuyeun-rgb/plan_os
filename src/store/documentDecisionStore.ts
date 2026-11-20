import { create } from 'zustand'
import type { DocumentType } from '../types'

export type DocumentDecision = 'pending' | 'approved' | 'rejected'

type DecisionMap = Record<string, DocumentDecision>

const STORAGE_KEY = 'planos_document_decisions_v1'

function load(): DecisionMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as DecisionMap
  } catch {
    return {}
  }
}

function persist(map: DecisionMap) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function key(projectId: string, docType: DocumentType) {
  return `${projectId}:${docType}`
}

interface DocumentDecisionState {
  decisions: DecisionMap
  getDecision: (projectId: string, docType: DocumentType) => DocumentDecision
  setDecision: (
    projectId: string,
    docType: DocumentType,
    decision: DocumentDecision,
  ) => void
}

export const useDocumentDecisionStore = create<DocumentDecisionState>((set, get) => ({
  decisions: typeof sessionStorage === 'undefined' ? {} : load(),

  getDecision: (projectId, docType) => {
    return get().decisions[key(projectId, docType)] ?? 'pending'
  },

  setDecision: (projectId, docType, decision) => {
    set((s) => {
      const next = { ...s.decisions, [key(projectId, docType)]: decision }
      persist(next)
      return { decisions: next }
    })
  },
}))
