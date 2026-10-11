import type { MemberRole, ProjectMember } from '../../types'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export interface InviteMemberInput {
  project_id: string
  email: string
  role: Exclude<MemberRole, 'owner'>
}

export async function fetchProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('invited_at', { ascending: true })
  throwIfError(error)
  return data ?? []
}

export async function inviteProjectMember(input: InviteMemberInput): Promise<ProjectMember> {
  const name = input.email.split('@')[0]
  const { data, error } = await supabase
    .from('project_members')
    .insert({
      project_id: input.project_id,
      email: input.email,
      name,
      role: input.role,
      status: 'pending',
    })
    .select()
    .single()
  return unwrap(data, error)
}

export async function updateProjectMemberRole(
  memberId: string,
  role: Exclude<MemberRole, 'owner'>,
): Promise<ProjectMember> {
  const { data, error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single()
  return unwrap(data, error)
}

export async function removeProjectMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('project_members').delete().eq('id', memberId)
  throwIfError(error)
}
