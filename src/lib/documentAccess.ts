import type { Document, DocumentType } from '../types'
import { DOCUMENT_TYPE_PATHS } from '../types'
import { DOCUMENT_TYPE_ORDER } from './documentTypes'
import { getLastDocType } from './sessionStorage'

export function getAvailableDocTypes(
  documents: Partial<Record<DocumentType, Document | null>>,
): DocumentType[] {
  return DOCUMENT_TYPE_ORDER.filter((type) => !!documents[type])
}

export function resolveDocType(params: {
  pathType: DocumentType | null
  projectId: string
  availableTypes: DocumentType[]
  unlockAll: boolean
}): DocumentType | null {
  const { pathType, projectId, availableTypes, unlockAll } = params

  if (unlockAll) {
    return pathType ?? getLastDocType(projectId) ?? availableTypes[0] ?? 'prd'
  }

  if (availableTypes.length === 0) return null

  if (pathType && availableTypes.includes(pathType)) return pathType

  const lastType = getLastDocType(projectId)
  if (lastType && availableTypes.includes(lastType)) return lastType

  return availableTypes[0]
}

export function getDocPathForType(type: DocumentType): string {
  return DOCUMENT_TYPE_PATHS[type]
}
