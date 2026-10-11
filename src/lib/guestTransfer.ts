import type { DocumentType } from '../types'
import { createProject } from './api/projects'
import { upsertDocument } from './api/documents'

import { DOCUMENT_TYPE_ORDER } from './documentTypes'

const DOC_TYPES: DocumentType[] = DOCUMENT_TYPE_ORDER

export interface GuestSessionData {
  idea: string
  interviewAnswers?: Record<string, string>
  generatedResults: Partial<Record<DocumentType, string>>
}

export function getGuestSession(): GuestSessionData | null {
  const idea = sessionStorage.getItem('planos_guest_idea')
  const resultRaw = sessionStorage.getItem('planos_guest_result')
  if (!idea || !resultRaw) return null

  const answersRaw = sessionStorage.getItem('planos_guest_interview')

  return {
    idea,
    generatedResults: JSON.parse(resultRaw) as Partial<Record<DocumentType, string>>,
    interviewAnswers: answersRaw
      ? (JSON.parse(answersRaw) as Record<string, string>)
      : undefined,
  }
}

export function hasGuestSession(): boolean {
  return getGuestSession() !== null
}

export function clearGuestSession(): void {
  sessionStorage.removeItem('planos_guest_idea')
  sessionStorage.removeItem('planos_guest_result')
  sessionStorage.removeItem('planos_guest_interview')
}

function inferServiceType(answers?: Record<string, string>): string {
  const q3 = answers?.q3 ?? ''
  if (q3.includes('모바일')) return '앱'
  if (q3.includes('SaaS')) return 'SaaS'
  return '웹'
}

export async function transferGuestToProject(userId: string): Promise<string | null> {
  const guest = getGuestSession()
  if (!guest) return null

  const project = await createProject({
    user_id: userId,
    title: guest.idea.slice(0, 50),
    description: guest.idea,
    service_type: inferServiceType(guest.interviewAnswers),
    target_user: guest.interviewAnswers?.q2 ?? '일반 사용자',
    interview_answers: guest.interviewAnswers ?? {},
    memory_summary: `${guest.idea.slice(0, 40)} | 게스트 체험 이관`,
  })

  for (const type of DOC_TYPES) {
    const content = guest.generatedResults[type]
    if (content) {
      await upsertDocument({
        id: `doc-guest-${type}-${project.id}`,
        project_id: project.id,
        type,
        content,
      })
    }
  }

  clearGuestSession()
  return project.id
}
