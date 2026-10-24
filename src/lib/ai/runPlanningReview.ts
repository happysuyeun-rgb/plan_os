/**
 * Orchestrates Mock planning review → human queue (Phase D).
 * Persistence defaults to in-memory; 027 DRAFT is not applied.
 */

import { fetchDocuments } from '../api/documents'
import { createServerTask } from '../api/projectTasks'
import { prototypeTaskRepository } from '../taskPrototype'
import { runMockPlanningReview } from './MockPlanningReviewProvider'
import {
  acceptReviewAndOpenTask,
  createReviewJob,
  defaultReviewStore,
  rejectReview,
  submitFindingsForHumanReview,
  type ReviewJobStore,
  type ReviewPipelineResult,
} from './reviewPipeline'
import type { ReviewJob } from './reviewJob'

const useServerTasks = import.meta.env.VITE_S1_SERVER_TASKS === 'true'

export type PlanningReviewRun = {
  mode: 'mock'
  job: ReviewJob
  documentCount: number
  findingCount: number
}

export async function loadProjectReviewDocuments(projectId: string) {
  const docs = await fetchDocuments(projectId)
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    content: d.content ?? '',
  }))
}

export async function startMockPlanningReview(
  projectId: string,
  store: ReviewJobStore = defaultReviewStore,
  documentTypes?: string[],
): Promise<PlanningReviewRun> {
  let docs = await loadProjectReviewDocuments(projectId)
  if (documentTypes?.length) {
    const allow = new Set(documentTypes)
    docs = docs.filter((d) => allow.has(d.type))
  }
  if (docs.length === 0) {
    throw new Error('검수할 문서가 없습니다. 먼저 PRD 등 문서를 작성하세요.')
  }

  const mock = runMockPlanningReview(docs)
  const job = createReviewJob(projectId)
  const awaiting = await submitFindingsForHumanReview(store, job, mock.findings)
  return {
    mode: 'mock',
    job: awaiting,
    documentCount: docs.length,
    findingCount: mock.findings.length,
  }
}

export async function acceptFindingAsTask(
  store: ReviewJobStore,
  job: ReviewJob,
  opts: { findingId?: string; userId: string; requestReReview?: boolean } ,
): Promise<ReviewPipelineResult> {
  return acceptReviewAndOpenTask(store, job, {
    findingId: opts.findingId,
    requestReReview: opts.requestReReview,
    createTask: async ({ projectId, finding, reviewJobId }) => {
      const title = `[검수] ${finding.summary}`.slice(0, 120)
      const objective = [
        `AI 기획 검수(Mock) job=${reviewJobId}`,
        `severity=${finding.severity}`,
        `citation=${finding.citation.documentType} @${finding.citation.startOffset ?? 0}`,
        finding.citation.quote,
        finding.citation.rationale,
      ].join('\n')
      const acceptanceCriteria = [
        '인용 구간의 문서 불일치/누락을 해소한다',
        '수정 후 재검수를 요청한다',
      ]

      if (useServerTasks) {
        const task = await createServerTask(projectId, {
          title,
          objective,
          acceptanceCriteria,
          assigneeId: null,
        })
        return { taskId: task.id }
      }

      const stamp = new Date().toISOString()
      const local = {
        id: crypto.randomUUID(),
        projectId,
        title,
        objective,
        acceptanceCriteria,
        assigneeId: null as string | null,
        assigneeName: null as string | null,
        status: 'todo' as const,
        blockedReason: null as string | null,
        deletedAt: null as string | null,
        createdAt: stamp,
        updatedAt: stamp,
      }
      const existing = await prototypeTaskRepository.list(opts.userId, projectId)
      await prototypeTaskRepository.replace(opts.userId, projectId, [local, ...existing])
      return { taskId: local.id }
    },
  })
}

export async function requestReviewChanges(
  store: ReviewJobStore,
  job: ReviewJob,
  reason: string,
): Promise<ReviewJob> {
  return rejectReview(store, job, reason.trim() || '수정 요청')
}
