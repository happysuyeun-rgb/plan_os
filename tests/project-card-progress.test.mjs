import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const progressSrc = readFileSync(
  new URL('../src/lib/projectProgress.ts', import.meta.url),
  'utf8',
)
const card = readFileSync(
  new URL('../src/components/project/ProjectCard.tsx', import.meta.url),
  'utf8',
)
const cardItem = readFileSync(
  new URL('../src/components/project/ProjectCardItem.tsx', import.meta.url),
  'utf8',
)
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8')
const projectList = readFileSync(
  new URL('../src/pages/ProjectListPage.tsx', import.meta.url),
  'utf8',
)

test('projectProgress exposes server / local_mock / unlinked paths', () => {
  assert.match(progressSrc, /source: 'server'/)
  assert.match(progressSrc, /source: 'local_mock'/)
  assert.match(progressSrc, /source: 'unlinked'/)
  assert.match(progressSrc, /ensureLocalMockProgressTasks/)
  assert.match(progressSrc, /resolveCardProgress/)
  assert.match(progressSrc, /서버 업무 미연결/)
  assert.match(progressSrc, /로컬 추정/)
})

test('ProjectCard renders progress label and bar', () => {
  assert.match(card, /project-card-progress/)
  assert.match(card, /progressLabel/)
  assert.match(card, /progressCaption/)
  assert.match(card, /role="progressbar"/)
  assert.match(cardItem, /progress\?: ProjectProgress/)
  assert.match(cardItem, /progress=\{progress\}/)
})

test('dashboard and project list wire card progress', () => {
  assert.match(dashboard, /progressByProject/)
  assert.match(dashboard, /resolveCardProgress/)
  assert.match(dashboard, /progress=\{progressByProject\[project\.id\]\}/)
  assert.match(projectList, /progressByProject/)
  assert.match(projectList, /resolveCardProgress/)
  assert.match(projectList, /progress=\{progressByProject\[project\.id\]\}/)
})

test('progress labels: 40% local mock seed math and unlinked copy', async () => {
  // taskPrototype import를 stub 해서 순수 라벨·서버 변환만 검증한다.
  const stubbed = progressSrc
    .replace(
      /import type \{ ProjectWorkSummary \} from '\.\/dashboardSummary'/,
      'type ProjectWorkSummary = { projectId: string; total: number; done: number; inProgress: number; inReview: number; blocked: number; pendingApprovals: number; completionRate: number | null }',
    )
    .replace(
      /import \{[\s\S]*?\} from '\.\/taskPrototype'/,
      `
      const store = new Map()
      function readPrototypeTasks(userId, projectId) {
        return store.get(userId + ':' + projectId) ?? []
      }
      function writePrototypeTasks(userId, projectId, tasks) {
        store.set(userId + ':' + projectId, tasks)
        return true
      }
      `,
    )
  const js = ts.transpileModule(stubbed, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mod = await import(
    'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
  )

  const seeded = mod.ensureLocalMockProgressTasks('u1', 'p1')
  assert.equal(seeded.source, 'local_mock')
  assert.equal(seeded.total, 5)
  assert.equal(seeded.done, 2)
  assert.equal(seeded.blocked, 1)
  assert.equal(seeded.completionRate, 40)
  assert.equal(mod.progressLabel(seeded), '40%')
  assert.match(mod.progressCaption(seeded), /로컬 추정 2\/5/)

  const again = mod.ensureLocalMockProgressTasks('u1', 'p1')
  assert.equal(again.total, 5)

  const unlinked = mod.unlinkedProgress()
  assert.equal(mod.progressLabel(unlinked), '서버 업무 미연결')

  const server = mod.progressFromWorkSummary({
    projectId: 'p2',
    total: 10,
    done: 4,
    inProgress: 2,
    inReview: 2,
    blocked: 2,
    pendingApprovals: 0,
    completionRate: 40,
  })
  assert.equal(server.source, 'server')
  assert.equal(mod.progressLabel(server), '40%')
  assert.equal(mod.progressCaption(server), '등록 업무 4/10')

  assert.equal(
    mod.resolveCardProgress({
      userId: 'u1',
      projectId: 'p9',
      serverTasksEnabled: true,
      serverSummary: null,
      localDev: false,
    }),
    undefined,
  )
  assert.equal(
    mod.resolveCardProgress({
      userId: 'u1',
      projectId: 'p-new',
      serverTasksEnabled: false,
      localDev: false,
    }).source,
    'unlinked',
  )
  const seededLocal = mod.ensureLocalMockProgressTasks('u1', 'p-local')
  assert.equal(seededLocal.completionRate, 40)
  assert.equal(
    mod.resolveCardProgress({
      userId: 'u1',
      projectId: 'p-local',
      serverTasksEnabled: false,
      localDev: true,
    }).completionRate,
    40,
  )
  assert.equal(
    mod.resolveCardProgress({
      userId: 'u1',
      projectId: 'p-empty',
      serverTasksEnabled: false,
      localDev: true,
    }).total,
    0,
  )
})
