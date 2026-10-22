import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/lib/dashboardSummary.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { buildWorkSummaries, formatCompletionRate, sortDashboardRows, summarizeTotals } =
  await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

function rowsOf(projectId, counts) {
  const rows = []
  for (const [status, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) rows.push({ project_id: projectId, status })
  }
  return rows
}

// 수용 fixture (Issue #39): A 업무 10 (done 4, blocked 2, backlog 4), B 업무 2 (done 2), C 업무 0
const summaries = buildWorkSummaries(
  ['A', 'B', 'C'],
  [...rowsOf('A', { done: 4, blocked: 2, backlog: 4 }), ...rowsOf('B', { done: 2 })],
  new Map([['A', 1], ['B', 0]]),
)
const byId = new Map(summaries.map((s) => [s.projectId, s]))

test('프로젝트별 등록 업무 완료율과 업무 미등록 표시', () => {
  assert.equal(byId.get('A').total, 10)
  assert.equal(byId.get('A').completionRate, 40)
  assert.equal(formatCompletionRate(byId.get('A')), '4 / 10 · 40%')
  assert.equal(byId.get('B').completionRate, 100)
  assert.equal(formatCompletionRate(byId.get('B')), '2 / 2 · 100%')
  assert.equal(byId.get('C').total, 0)
  assert.equal(byId.get('C').completionRate, null)
  assert.equal(formatCompletionRate(byId.get('C')), '업무 미등록')
  assert.equal(byId.get('A').pendingApprovals, 1)
})

test('합계 6/12는 50%다 (삭제 업무는 조회 제외이므로 합계에 들어가지 않는다)', () => {
  const totals = summarizeTotals(summaries)
  assert.equal(totals.projectCount, 3)
  assert.equal(totals.doneTotal, 6)
  assert.equal(totals.taskTotal, 12)
  assert.equal(totals.blockedTotal, 2)
  assert.equal(totals.pendingApprovalsTotal, 1)
  assert.equal(totals.completionRate, 50)
})

test('차단 업무가 있는 프로젝트가 정렬에서 가장 앞에 온다', () => {
  const rows = sortDashboardRows([
    { projectId: 'C', title: 'C 프로젝트', serviceType: 'SaaS', updatedAt: '2026-10-22T09:00:00Z', summary: byId.get('C') },
    { projectId: 'B', title: 'B 프로젝트', serviceType: 'SaaS', updatedAt: '2026-10-22T10:00:00Z', summary: byId.get('B') },
    { projectId: 'A', title: 'A 프로젝트', serviceType: 'SaaS', updatedAt: '2026-10-21T10:00:00Z', summary: byId.get('A') },
  ])
  assert.deepEqual(rows.map((r) => r.projectId), ['A', 'B', 'C'])
})

test('다른 프로젝트의 업무 행은 집계에 섞이지 않는다', () => {
  const isolated = buildWorkSummaries(['X'], rowsOf('Y', { done: 3 }), new Map())
  assert.equal(isolated[0].total, 0)
  assert.equal(isolated[0].completionRate, null)
})
