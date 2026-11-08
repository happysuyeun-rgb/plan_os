import type { Document, DocumentType, Project } from '../types'

const PROJECTS_KEY = 'planos-local-dev-projects'
const DOCS_KEY = 'planos-local-dev-documents'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  sessionStorage.setItem(key, JSON.stringify(value))
}

function nowIso() {
  return new Date().toISOString()
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function localListProjects(userId: string): Project[] {
  return readJson<Project[]>(PROJECTS_KEY, [])
    .filter((p) => p.user_id === userId && !p.deleted_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function localGetProject(id: string): Project | null {
  return readJson<Project[]>(PROJECTS_KEY, []).find((p) => p.id === id) ?? null
}

export function localCreateProject(
  input: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'deleted_by'> &
    Partial<Pick<Project, 'memory_summary' | 'chat_title'>>,
): Project {
  const stamp = nowIso()
  const project: Project = {
    id: newId('local-project'),
    user_id: input.user_id,
    title: input.title,
    description: input.description,
    service_type: input.service_type,
    target_user: input.target_user,
    memory_summary: input.memory_summary ?? '',
    chat_title: input.chat_title ?? input.title,
    interview_answers: input.interview_answers ?? {},
    deleted_at: null,
    deleted_by: null,
    created_at: stamp,
    updated_at: stamp,
  }
  writeJson(PROJECTS_KEY, [project, ...readJson<Project[]>(PROJECTS_KEY, [])])
  return project
}

export function localUpdateProject(id: string, data: Partial<Project>): Project {
  const all = readJson<Project[]>(PROJECTS_KEY, [])
  const index = all.findIndex((p) => p.id === id)
  if (index < 0) throw new Error('프로젝트를 찾을 수 없습니다')
  const { id: _id, created_at: _c, user_id: _u, ...patch } = data
  const updated: Project = { ...all[index], ...patch, updated_at: nowIso() }
  all[index] = updated
  writeJson(PROJECTS_KEY, all)
  return updated
}

export function localFetchDocuments(projectId: string): Document[] {
  return readJson<Document[]>(DOCS_KEY, [])
    .filter((d) => d.project_id === projectId)
    .sort((a, b) => a.type.localeCompare(b.type))
}

export function localInsertDocument(input: {
  id?: string
  project_id: string
  type: DocumentType
  content: string
}): Document {
  const all = readJson<Document[]>(DOCS_KEY, [])
  if (all.some((d) => d.project_id === input.project_id && d.type === input.type)) {
    throw new Error('문서가 이미 존재합니다')
  }
  const stamp = nowIso()
  const created: Document = {
    id: input.id ?? newId('local-doc'),
    project_id: input.project_id,
    type: input.type,
    content: input.content,
    content_revision: 1,
    created_at: stamp,
    updated_at: stamp,
  }
  writeJson(DOCS_KEY, [created, ...all])
  return created
}
