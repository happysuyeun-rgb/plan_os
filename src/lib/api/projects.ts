import type { Project, TrashedProject } from '../../types'
import { deriveChatTitle } from '../chatTitle'
import { toTrashedProject } from '../projectTrash'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export interface CreateProjectInput {
  user_id: string
  title: string
  description: string
  service_type: string
  target_user: string
  memory_summary?: string
  interview_answers?: Record<string, string>
  chat_title?: string
}

export async function fetchProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  throwIfError(error)
  return data ?? []
}

export async function fetchTrashedProjects(userId: string): Promise<TrashedProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  throwIfError(error)
  return (data ?? []).map(toTrashedProject)
}

export async function fetchProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
  throwIfError(error)
  return data
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const chatTitle =
    input.chat_title?.trim() ||
    deriveChatTitle({
      title: input.title,
      description: input.description,
      interviewAnswers: input.interview_answers,
    })

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      user_id: input.user_id,
      title: input.title,
      description: input.description,
      service_type: input.service_type,
      target_user: input.target_user,
      memory_summary: input.memory_summary ?? '',
      interview_answers: input.interview_answers ?? {},
      chat_title: chatTitle,
    })
    .select()
    .single()
  const created = unwrap(project, error)

  const { data: owner } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', input.user_id)
    .maybeSingle()

  const { error: memberError } = await supabase.from('project_members').insert({
    project_id: created.id,
    user_id: input.user_id,
    email: owner?.email ?? '',
    name: owner?.name ?? '',
    role: 'owner',
    status: 'active',
  })
  throwIfError(memberError)

  return created
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  const { id: _id, created_at: _created, user_id: _user, ...patch } = data
  const { data: updated, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  return unwrap(updated, error)
}

export async function trashProject(id: string, userId: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq('id', id)
    .select()
    .single()
  return unwrap(data, error)
}

export async function restoreProject(id: string, _userId: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', id)
    .select()
    .single()
  return unwrap(data, error)
}

export async function purgeProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  throwIfError(error)
}

/** @deprecated purgeProject 사용 — 하위 호환 */
export async function deleteProject(id: string): Promise<void> {
  return purgeProject(id)
}
