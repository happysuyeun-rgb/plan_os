import JSZip from 'jszip'
import type { Document, DocumentType, Project } from '../../types'
import { DOCUMENT_TYPE_PATHS } from '../../types'
import { buildReadmeMarkdown, buildSingleMarkdown } from './buildMarkdown'

import { DOCUMENT_TYPE_ORDER } from '../documentTypes'

const ALL_TYPES: DocumentType[] = DOCUMENT_TYPE_ORDER

export async function buildProjectZip(
  project: Project,
  documents: Partial<Record<DocumentType, Document>>,
): Promise<Blob> {
  const zip = new JSZip()
  const included: DocumentType[] = []

  for (const type of ALL_TYPES) {
    const doc = documents[type]
    if (!doc?.content) continue
    included.push(type)
    zip.file(
      `${DOCUMENT_TYPE_PATHS[type]}.md`,
      buildSingleMarkdown(project, type, doc.content),
    )
  }

  zip.file('README.md', buildReadmeMarkdown(project, included))
  return zip.generateAsync({ type: 'blob' })
}

export async function buildGuestPreviewZip(
  title: string,
  results: Partial<Record<DocumentType, string>>,
): Promise<Blob> {
  const zip = new JSZip()
  const stubProject: Project = {
    id: 'guest',
    user_id: '',
    title: title.slice(0, 50),
    description: title,
    service_type: '체험',
    target_user: '일반 사용자',
    memory_summary: '',
    chat_title: '',
    interview_answers: {},
    deleted_at: null,
    deleted_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const included: DocumentType[] = []
  for (const type of ALL_TYPES) {
    const content = results[type]
    if (!content) continue
    included.push(type)
    zip.file(
      `${DOCUMENT_TYPE_PATHS[type]}.md`,
      buildSingleMarkdown(stubProject, type, content),
    )
  }

  zip.file('README.md', buildReadmeMarkdown(stubProject, included))
  return zip.generateAsync({ type: 'blob' })
}
