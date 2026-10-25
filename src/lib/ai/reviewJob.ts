/** First AI staff vertical: planning-document review (Phase D foundation). */

export type ReviewJobStatus =
  | 'queued'
  | 'running'
  | 'awaiting_human'
  | 'accepted'
  | 'rejected'
  | 'failed'

export type DocumentCitation = {
  documentId: string
  documentType: string
  versionNumber?: number
  startOffset?: number
  endOffset?: number
  quote: string
  rationale: string
}

/** Aligns with FIRST_SPECIALIST finding categories (Mock + future report). */
export type ReviewFindingCategory =
  | 'missing'
  | 'inconsistent'
  | 'untestable'
  | 'permission_or_approval'
  | 'failure_recovery'

export type ReviewerState =
  | 'proposed'
  | 'source_validated'
  | 'human_confirmed'
  | 'human_rejected'
  | 'needs_review'

export type SourceManifestEntry = {
  documentId: string
  documentType: string
  revisionOrVersion?: number
}

export type ReviewFinding = {
  id: string
  severity: 'info' | 'warning' | 'blocker'
  category: ReviewFindingCategory
  summary: string
  citation: DocumentCitation
  /** AI proposal vs human/source validation — never claim “accepted” from Mock alone. */
  reviewerState: ReviewerState
}

/** Session staffing brief snapshot on a Mock review job (not a paid hire/contract). */
export type StaffBrief = {
  roleId: string
  task: string
  acceptanceCriteria: string
  mockOnly: true
}

export type ReviewJob = {
  id: string
  projectId: string
  status: ReviewJobStatus
  findings: ReviewFinding[]
  /** Documents actually read for this run (Mock manifest). */
  sourceManifest?: SourceManifestEntry[]
  /** True when input docs were insufficient for a full audit. */
  insufficientInput?: boolean
  /** Optional S3 hire-mock brief carried into this Mock run (browser snapshot). */
  staffBrief?: StaffBrief
  linkedTaskId?: string
  /** findingId → taskId; prevents duplicate S1 tasks on re-accept / double-click. */
  acceptedFindingTaskIds?: Record<string, string>
  /** Parent review job when this is a re-review enqueue. */
  parentReviewJobId?: string
  /** S1 task that triggered / is tied to this re-review (fix-complete loop). */
  sourceTaskId?: string
  /** Monotonic CAS version for concurrent writers (browser/local store). */
  version?: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

const TERMINAL: ReadonlySet<ReviewJobStatus> = new Set(['accepted', 'rejected', 'failed'])

const ALLOWED: Record<ReviewJobStatus, ReadonlySet<ReviewJobStatus>> = {
  queued: new Set(['running', 'failed']),
  running: new Set(['awaiting_human', 'failed']),
  awaiting_human: new Set(['accepted', 'rejected', 'failed']),
  accepted: new Set(),
  rejected: new Set(),
  failed: new Set(),
}

export function assertReviewTransition(from: ReviewJobStatus, to: ReviewJobStatus): void {
  if (from === to) return
  if (TERMINAL.has(from)) {
    throw new Error(`Review job already terminal (${from}); cannot move to ${to}`)
  }
  if (!ALLOWED[from].has(to)) {
    throw new Error(`Illegal review transition ${from} → ${to}`)
  }
}

export function transitionReviewJob(job: ReviewJob, to: ReviewJobStatus, patch: Partial<ReviewJob> = {}): ReviewJob {
  assertReviewTransition(job.status, to)
  return {
    ...job,
    ...patch,
    status: to,
    updatedAt: new Date().toISOString(),
  }
}

/** In-memory store for local/Preview experiments — not a production table. */
export class InMemoryReviewJobStore {
  private readonly jobs = new Map<string, ReviewJob>()

  put(job: ReviewJob): ReviewJob {
    this.jobs.set(job.id, job)
    return job
  }

  get(id: string): ReviewJob | undefined {
    return this.jobs.get(id)
  }

  listByProject(projectId: string): ReviewJob[] {
    return [...this.jobs.values()].filter((job) => job.projectId === projectId)
  }
}
