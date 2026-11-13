import type { Document, DocumentType, MemberRole, Project, ProjectMember } from '../types'

const PROJECTS_KEY = 'planos-local-dev-projects'
const DOCS_KEY = 'planos-local-dev-documents'
const MEMBERS_KEY = 'planos-local-dev-members'

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

/** localDev 체험용 — AI 직원 채용/계약 없는 가상 프로젝트 1건 */
export const LOCAL_DEMO_NO_STAFF_MARKER = 'no_ai_staff'

export function ensureLocalDemoProjectWithoutStaff(userId: string): Project {
  const all = readJson<Project[]>(PROJECTS_KEY, [])
  const existing = all.find(
    (p) =>
      p.user_id === userId &&
      !p.deleted_at &&
      p.interview_answers?.local_demo === LOCAL_DEMO_NO_STAFF_MARKER,
  )
  if (existing) return existing

  const project = localCreateProject({
    user_id: userId,
    title: '카페 예약 앱 (체험)',
    description:
      '동네 카페 웨이팅·예약을 정리하는 체험용 가상 프로젝트입니다. AI 직원은 채용하지 않은 상태입니다.',
    service_type: '앱',
    target_user: '카페를 자주 가는 직장인',
    memory_summary: '체험용 가상 프로젝트 · AI 직원 미채용',
    chat_title: '카페 예약 앱 (체험)',
    interview_answers: { local_demo: LOCAL_DEMO_NO_STAFF_MARKER },
  })

  try {
    localInsertDocument({
      project_id: project.id,
      type: 'prd',
      content: [
        '# PRD (체험)',
        '',
        '## 개요',
        '카페 예약 앱 체험용 초안입니다.',
        '',
        '## 목표 사용자',
        '카페를 자주 가는 직장인',
        '',
        '## 핵심 기능',
        '- 웨이팅 등록',
        '- 예약 확인 알림',
        '',
        '## 참고',
        'AI 직원 채용 전 상태의 가상 프로젝트입니다. 실제 계약·과금·유료 LLM은 없습니다.',
        '',
      ].join('\n'),
    })
  } catch {
    // 문서가 이미 있으면 프로젝트만으로 충분
  }

  return project
}

export function localListProjects(userId: string): Project[] {
  ensureLocalDemoProjectWithoutStaff(userId)
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
  const patch = { ...data }
  delete patch.id
  delete patch.created_at
  delete patch.user_id
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

export function localFetchMembers(projectId: string): ProjectMember[] {
  return readJson<ProjectMember[]>(MEMBERS_KEY, [])
    .filter((m) => m.project_id === projectId)
    .sort((a, b) => a.invited_at.localeCompare(b.invited_at))
}

export function localInviteMember(input: {
  project_id: string
  email: string
  role: Exclude<MemberRole, 'owner'>
}): ProjectMember {
  const email = input.email.trim().toLowerCase()
  const all = readJson<ProjectMember[]>(MEMBERS_KEY, [])
  if (all.some((m) => m.project_id === input.project_id && m.email.toLowerCase() === email)) {
    throw new Error('이미 초대된 이메일입니다')
  }
  const member: ProjectMember = {
    id: newId('local-member'),
    project_id: input.project_id,
    user_id: null,
    email,
    name: email.split('@')[0] || email,
    role: input.role,
    status: 'pending',
    invited_at: nowIso(),
  }
  writeJson(MEMBERS_KEY, [...all, member])
  return member
}

export function localUpdateMemberRole(
  memberId: string,
  role: Exclude<MemberRole, 'owner'>,
): ProjectMember {
  const all = readJson<ProjectMember[]>(MEMBERS_KEY, [])
  const index = all.findIndex((m) => m.id === memberId)
  if (index < 0) throw new Error('멤버를 찾을 수 없습니다')
  const updated = { ...all[index], role }
  all[index] = updated
  writeJson(MEMBERS_KEY, all)
  return updated
}

export function localRemoveMember(memberId: string): void {
  writeJson(
    MEMBERS_KEY,
    readJson<ProjectMember[]>(MEMBERS_KEY, []).filter((m) => m.id !== memberId),
  )
}
