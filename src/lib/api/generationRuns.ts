import type { DocumentType, GenerationRun, GenerationRunStatus } from '../../types'
import { supabase } from '../supabase'
import { throwIfError, unwrap } from '../supabaseHelpers'

export async function startGenerationRun(
  projectId: string,
  interviewAnswers: Record<string, string>,
): Promise<GenerationRun> {
  const { data, error } = await supabase
    .from('generation_runs')
    .insert({
      project_id: projectId,
      status: 'running',
      completed_steps: [],
      interview_answers: interviewAnswers,
    })
    .select()
    .single()
  return unwrap(data, error)
}

export async function finishGenerationRun(
  runId: string,
  status: Exclude<GenerationRunStatus, 'running'>,
  completedSteps: DocumentType[],
): Promise<GenerationRun> {
  const { data, error } = await supabase
    .from('generation_runs')
    .update({
      status,
      completed_steps: completedSteps,
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .select()
    .single()
  return unwrap(data, error)
}

export async function fetchGenerationRuns(projectId: string): Promise<GenerationRun[]> {
  const { data, error } = await supabase
    .from('generation_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
  throwIfError(error)
  return data ?? []
}
