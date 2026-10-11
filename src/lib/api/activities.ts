import type { ActivityAction, ProjectActivity } from '../../types'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export interface LogActivityInput {
  project_id: string
  document_id?: string
  action: ActivityAction
  meta?: Record<string, unknown>
}

export async function fetchProjectActivities(
  projectId: string,
  documentId?: string,
): Promise<ProjectActivity[]> {
  let query = supabase
    .from('project_activities')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (documentId) {
    query = query.eq('document_id', documentId)
  }

  const { data, error } = await query
  throwIfError(error)
  return data ?? []
}

export async function logProjectActivity(input: LogActivityInput): Promise<ProjectActivity> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) {
    throw new Error('로그인이 필요합니다')
  }

  const { data, error } = await supabase
    .from('project_activities')
    .insert({
      project_id: input.project_id,
      document_id: input.document_id ?? null,
      user_id: userId,
      action: input.action,
      meta: input.meta ?? {},
    })
    .select()
    .single()
  return unwrap(data, error)
}
