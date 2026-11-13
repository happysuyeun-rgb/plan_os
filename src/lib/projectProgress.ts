import type { ProjectWorkSummary } from './dashboardSummary'
import {
  readPrototypeTasks,
  writePrototypeTasks,
  type PrototypeTask,
} from './taskPrototype'

export type ProgressSource = 'server' | 'local_mock' | 'unlinked'

export type ProjectProgress = {
  completionRate: number | null
  done: number
  total: number
  blocked: number
  source: ProgressSource
}

function rate(done: number, total: number): number | null {
  return total > 0 ? Math.round((done / total) * 100) : null
}

export function progressFromWorkSummary(
  summary: ProjectWorkSummary,
): ProjectProgress {
  return {
    completionRate: summary.completionRate,
    done: summary.done,
    total: summary.total,
    blocked: summary.blocked,
    source: 'server',
  }
}

export function progressFromPrototypeTasks(
  userId: string,
  projectId: string,
): ProjectProgress {
  const tasks = readPrototypeTasks(userId, projectId).filter((t) => !t.deletedAt)
  const done = tasks.filter((t) => t.status === 'done').length
  const blocked = tasks.filter((t) => t.status === 'blocked').length
  return {
    completionRate: rate(done, tasks.length),
    done,
    total: tasks.length,
    blocked,
    source: 'local_mock',
  }
}

export function unlinkedProgress(): ProjectProgress {
  return {
    completionRate: null,
    done: 0,
    total: 0,
    blocked: 0,
    source: 'unlinked',
  }
}

/** localDev 체험용: 업무가 없으면 완료율 샘플 업무를 한 번 시드한다. */
export function ensureLocalMockProgressTasks(
  userId: string,
  projectId: string,
): ProjectProgress {
  const existing = readPrototypeTasks(userId, projectId).filter((t) => !t.deletedAt)
  if (existing.length > 0) return progressFromPrototypeTasks(userId, projectId)

  const stamp = new Date().toISOString()
  const seed: PrototypeTask[] = [
    {
      id: `local-task-${projectId}-1`,
      projectId,
      title: '웨이팅 등록 흐름 정리',
      objective: '카페 웨이팅 UX 초안',
      acceptanceCriteria: ['플로우 문서화'],
      assigneeName: null,
      assigneeId: null,
      deletedAt: null,
      status: 'done',
      blockedReason: null,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: `local-task-${projectId}-2`,
      projectId,
      title: '예약 확인 알림 초안',
      objective: '알림 카피 초안',
      acceptanceCriteria: ['문구 3안'],
      assigneeName: null,
      assigneeId: null,
      deletedAt: null,
      status: 'done',
      blockedReason: null,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: `local-task-${projectId}-3`,
      projectId,
      title: '매장 선택 화면 스케치',
      objective: '화면 와이어',
      acceptanceCriteria: ['주요 상태 3종'],
      assigneeName: null,
      assigneeId: null,
      deletedAt: null,
      status: 'in_progress',
      blockedReason: null,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: `local-task-${projectId}-4`,
      projectId,
      title: '결제 연동 조사',
      objective: 'PG 후보 비교',
      acceptanceCriteria: ['비교표'],
      assigneeName: null,
      assigneeId: null,
      deletedAt: null,
      status: 'blocked',
      blockedReason: '외부 견적 대기',
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: `local-task-${projectId}-5`,
      projectId,
      title: '리뷰 정책 초안',
      objective: '리뷰 노출 규칙',
      acceptanceCriteria: ['정책 1페이지'],
      assigneeName: null,
      assigneeId: null,
      deletedAt: null,
      status: 'todo',
      blockedReason: null,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]
  writePrototypeTasks(userId, projectId, seed)
  return progressFromPrototypeTasks(userId, projectId)
}

export function progressLabel(progress: ProjectProgress): string {
  if (progress.source === 'unlinked') return '서버 업무 미연결'
  if (progress.total === 0) return '업무 미등록'
  return `${progress.completionRate}%`
}

export function progressCaption(progress: ProjectProgress): string {
  if (progress.source === 'server') {
    if (progress.total === 0) return '등록 업무 기준'
    return `등록 업무 ${progress.done}/${progress.total}`
  }
  if (progress.source === 'local_mock') {
    if (progress.total === 0) return '로컬 추정 · 업무 없음'
    return `로컬 추정 ${progress.done}/${progress.total}`
  }
  return '서버 업무 모드 필요'
}

/**
 * 카드 완료율 해석:
 * - 서버 업무 ON + summary → 서버 집계
 * - 서버 업무 ON + summary 없음 → 아직 로딩(undefined)
 * - localDev → prototype 업무 기반 로컬 추정(없으면 시드)
 * - 그 외 → 서버 업무 미연결
 */
export function resolveCardProgress(opts: {
  userId: string
  projectId: string
  serverTasksEnabled: boolean
  serverSummary?: ProjectWorkSummary | null
  localDev: boolean
}): ProjectProgress | undefined {
  if (opts.serverTasksEnabled) {
    if (!opts.serverSummary) return undefined
    return progressFromWorkSummary(opts.serverSummary)
  }
  if (opts.localDev) {
    return progressFromPrototypeTasks(opts.userId, opts.projectId)
  }
  return unlinkedProgress()
}
