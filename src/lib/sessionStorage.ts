import type { DocumentType } from '../types'
import { DOCUMENT_TYPE_PATHS } from '../types'

const LAST_DOC_KEY = (projectId: string) => `planos_last_doc_type:${projectId}`

export function saveLastDocType(projectId: string, docType: DocumentType): void {
  sessionStorage.setItem(LAST_DOC_KEY(projectId), docType)
}

export function getLastDocType(projectId: string): DocumentType | null {
  const value = sessionStorage.getItem(LAST_DOC_KEY(projectId))
  if (!value) return null
  const valid = Object.keys(DOCUMENT_TYPE_PATHS) as DocumentType[]
  return valid.includes(value as DocumentType) ? (value as DocumentType) : null
}

export function getLastDocPath(projectId: string): string {
  const type = getLastDocType(projectId) ?? 'prd'
  return DOCUMENT_TYPE_PATHS[type]
}
