/**
 * Server-backed ReviewJobStore (migration 027 tables).
 * Use only when VITE_AI_REVIEW_STORE=server and 027 is applied on the target DB
 * (disposable local / approved Preview — never ops without approval).
 */

import { supabase } from '../supabase'
import type {
  ReviewFinding,
  ReviewFindingCategory,
  ReviewerState,
  ReviewJob,
  ReviewJobStatus,
  SourceManifestEntry,
} from './reviewJob'
import { ReviewJobConflictError, type ReviewJobStoreBag } from './browserReviewJobStore'

type JobRow = {
  id: string
  project_id: string
  status: ReviewJobStatus
  linked_task_id: string | null
  parent_review_job_id: string | null
  source_task_id: string | null
  accepted_finding_task_ids: Record<string, string> | null
  source_manifest: SourceManifestEntry[] | null
  insufficient_input: boolean | null
  row_version: number
  error_message: string | null
  created_at: string
  updated_at: string
}

type FindingRow = {
  id: string
  job_id: string
  severity: ReviewFinding['severity']
  category: ReviewFindingCategory | null
  reviewer_state: ReviewerState | null
  summary: string
  document_id: string
  document_type: string
  version_number: number | null
  start_offset: number | null
  end_offset: number | null
  quote: string
  rationale: string
}

function rowToJob(row: JobRow, findings: ReviewFinding[]): ReviewJob {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    findings,
    sourceManifest: row.source_manifest ?? undefined,
    insufficientInput: row.insufficient_input ?? undefined,
    linkedTaskId: row.linked_task_id ?? undefined,
    parentReviewJobId: row.parent_review_job_id ?? undefined,
    sourceTaskId: row.source_task_id ?? undefined,
    acceptedFindingTaskIds: row.accepted_finding_task_ids ?? {},
    version: row.row_version,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function findingToRow(jobId: string, f: ReviewFinding): Omit<FindingRow, 'job_id'> & { job_id: string } {
  return {
    id: f.id,
    job_id: jobId,
    severity: f.severity,
    category: f.category,
    reviewer_state: f.reviewerState,
    summary: f.summary,
    document_id: f.citation.documentId,
    document_type: f.citation.documentType,
    version_number: f.citation.versionNumber ?? null,
    start_offset: f.citation.startOffset ?? null,
    end_offset: f.citation.endOffset ?? null,
    quote: f.citation.quote,
    rationale: f.citation.rationale,
  }
}

function rowToFinding(row: FindingRow): ReviewFinding {
  return {
    id: row.id,
    severity: row.severity,
    category: row.category ?? 'missing',
    reviewerState: row.reviewer_state ?? 'proposed',
    summary: row.summary,
    citation: {
      documentId: row.document_id,
      documentType: row.document_type,
      versionNumber: row.version_number ?? undefined,
      startOffset: row.start_offset ?? undefined,
      endOffset: row.end_offset ?? undefined,
      quote: row.quote,
      rationale: row.rationale,
    },
  }
}

async function loadFindings(jobId: string): Promise<ReviewFinding[]> {
  const { data, error } = await supabase
    .from('ai_review_findings')
    .select('*')
    .eq('job_id', jobId)
  if (error) throw error
  return (data as FindingRow[] | null)?.map(rowToFinding) ?? []
}

export class ServerReviewJobStore implements ReviewJobStoreBag {
  async put(job: ReviewJob): Promise<ReviewJob> {
    const expected = typeof job.version === 'number' ? job.version : 0
    if (expected === 0) {
      return this.insertNew(job)
    }
    return this.putCas(job, expected)
  }

  async putCas(job: ReviewJob, expectedVersion: number): Promise<ReviewJob> {
    // Keep RPC args compatible with both pre/post-MVP CAS signatures (PostgREST cache).
    // Manifest fields are patched via table UPDATE after CAS.
    const { data, error } = await supabase.rpc('cas_ai_review_job', {
      p_id: job.id,
      p_expected_version: expectedVersion,
      p_status: job.status,
      p_linked_task_id: job.linkedTaskId ?? null,
      p_parent_review_job_id: job.parentReviewJobId ?? null,
      p_source_task_id: job.sourceTaskId ?? null,
      p_accepted_finding_task_ids: job.acceptedFindingTaskIds ?? {},
      p_error_message: job.errorMessage ?? null,
    })
    if (error) {
      if (error.code === 'P4001' || /AI_REVIEW_VERSION_CONFLICT/i.test(error.message)) {
        throw new ReviewJobConflictError(error.message)
      }
      throw error
    }
    await this.patchJobMeta(job)
    // Findings are written once at awaiting_human; re-insert on accept would PK-conflict
    // (027 revokes UPDATE, so upsert-update is unavailable).
    if (job.status === 'awaiting_human' && job.findings.length > 0) {
      await this.replaceFindings(job.id, job.findings)
    }
    const findings = await loadFindings(job.id)
    const fresh = await this.get(job.id)
    if (!fresh) {
      return rowToJob(data as JobRow, findings)
    }
    return { ...fresh, findings }
  }

  private async patchJobMeta(job: ReviewJob): Promise<void> {
    if (job.sourceManifest === undefined && job.insufficientInput === undefined) return
    const patch: Record<string, unknown> = {}
    if (job.sourceManifest !== undefined) patch.source_manifest = job.sourceManifest
    if (job.insufficientInput !== undefined) patch.insufficient_input = job.insufficientInput
    const { error } = await supabase.from('ai_review_jobs').update(patch).eq('id', job.id)
    if (error) throw error
  }

  private async insertNew(job: ReviewJob): Promise<ReviewJob> {
    // Insert classic columns only — MVP meta patched after (PostgREST schema-cache safe).
    const { data, error } = await supabase
      .from('ai_review_jobs')
      .insert({
        id: job.id,
        project_id: job.projectId,
        status: job.status,
        linked_task_id: job.linkedTaskId ?? null,
        parent_review_job_id: job.parentReviewJobId ?? null,
        source_task_id: job.sourceTaskId ?? null,
        accepted_finding_task_ids: job.acceptedFindingTaskIds ?? {},
        row_version: 1,
        error_message: job.errorMessage ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    await this.patchJobMeta(job)
    if (job.status === 'awaiting_human' && job.findings.length > 0) {
      await this.replaceFindings(job.id, job.findings)
    }
    const findings = await loadFindings(job.id)
    const fresh = await this.get(job.id)
    return fresh ?? rowToJob(data as JobRow, findings)
  }

  private async replaceFindings(jobId: string, findings: ReviewFinding[]): Promise<void> {
    // INSERT only — 027 revokes UPDATE on findings, so upsert(ON CONFLICT DO UPDATE) fails.
    const rows = findings.map((f) => findingToRow(jobId, f))
    const { error } = await supabase
      .from('ai_review_findings')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }

  async get(id: string): Promise<ReviewJob | undefined> {
    const { data, error } = await supabase
      .from('ai_review_jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return undefined
    const findings = await loadFindings(id)
    return rowToJob(data as JobRow, findings)
  }

  async listByProject(projectId: string): Promise<ReviewJob[]> {
    const { data, error } = await supabase
      .from('ai_review_jobs')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    const rows = (data as JobRow[] | null) ?? []
    const jobs: ReviewJob[] = []
    for (const row of rows) {
      jobs.push(rowToJob(row, await loadFindings(row.id)))
    }
    return jobs
  }

  /** Idempotent finding→task bind via 027 RPC. */
  async bindFindingTask(jobId: string, findingId: string, taskId: string): Promise<string> {
    const { data, error } = await supabase.rpc('bind_ai_review_finding_task', {
      p_job_id: jobId,
      p_finding_id: findingId,
      p_task_id: taskId,
    })
    if (error) throw error
    return (data as { task_id: string }).task_id
  }
}

export const REVIEW_STORE_MODE_SERVER = 'SERVER_027' as const
