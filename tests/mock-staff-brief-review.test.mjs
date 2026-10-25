import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function transpile(relPath) {
  const text = readFileSync(new URL(relPath, import.meta.url), 'utf8')
  return ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
}

const reviewJobJs = transpile('../src/lib/ai/reviewJob.ts')
const reviewJobUrl = 'data:text/javascript;base64,' + Buffer.from(reviewJobJs).toString('base64')
const mockJs = transpile('../src/lib/ai/MockPlanningReviewProvider.ts').replace(
  /from ["']\.\/reviewJob["']/,
  `from "${reviewJobUrl}"`,
)
const { runMockPlanningReview } = await import(
  'data:text/javascript;base64,' + Buffer.from(mockJs).toString('base64')
)

const docs = [
  { id: 'd1', type: 'prd', content: '목표 사용자와 인증 흐름을 포함한 PRD 본문입니다.', revision: 1 },
  { id: 'd2', type: 'policy', content: '권한과 인증 정책을 정의합니다.', revision: 1 },
]

const brief = {
  roleId: 'requirements_auditor_v1',
  task: '기획 요구사항 문서의 누락 항목을 검토해 주세요.',
  acceptanceCriteria: '누락과 근거를 보고서로 정리',
  mockOnly: true,
}

test('without staffBrief Mock review stays unchanged shape', () => {
  const result = runMockPlanningReview(docs)
  assert.equal(result.mode, 'mock')
  assert.equal(result.insufficientInput, false)
  assert.ok(!result.findings.some((f) => f.summary.includes('채용 요청 완료기준')))
})

test('staffBrief prepends scoped info finding citing acceptance criteria', () => {
  const result = runMockPlanningReview(docs, { staffBrief: brief })
  assert.equal(result.findings[0].severity, 'info')
  assert.match(result.findings[0].summary, /채용 요청 완료기준/)
  assert.match(result.findings[0].citation.rationale, /누락과 근거를 보고서로 정리/)
  assert.equal(result.findings[0].reviewerState, 'proposed')
  assert.equal(result.mode, 'mock')
})

test('staffBrief without mockOnly is ignored', () => {
  const result = runMockPlanningReview(docs, {
    staffBrief: { ...brief, mockOnly: false },
  })
  assert.ok(!result.findings.some((f) => f.summary.includes('채용 요청 완료기준')))
})
