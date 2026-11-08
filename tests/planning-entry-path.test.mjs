import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helper = readFileSync(new URL('../src/lib/planningEntryPath.ts', import.meta.url), 'utf8')
const picker = readFileSync(
  new URL('../src/components/project/PlanningEntryPathPicker.tsx', import.meta.url),
  'utf8',
)
const createPage = readFileSync(new URL('../src/pages/ProjectCreatePage.tsx', import.meta.url), 'utf8')
const dualDoc = readFileSync(
  new URL('../docs/product/DUAL_ENTRY_CONTINUOUS_AI_STAFFING_2026-10-21.md', import.meta.url),
  'utf8',
)

test('planning entry helper encodes UX-only dual paths without billing', () => {
  assert.match(helper, /export type PlanningEntryPath = 'direct' \| 'with_pm'/)
  assert.match(helper, /_planning_entry_path/)
  assert.match(helper, /not a mode lock/)
  assert.match(helper, /postCreateDestination/)
  assert.match(helper, /\/plans/)
  assert.match(helper, /\/prd/)
  assert.doesNotMatch(helper, /allowPaidCalls|결제 시작/)
})

test('create page requires path picker before step1 next and persists entry', () => {
  assert.match(createPage, /PlanningEntryPathPicker/)
  assert.match(createPage, /기획 시작 경로를 선택해주세요/)
  assert.match(createPage, /withPlanningEntryPath/)
  assert.match(createPage, /postCreateDestination/)
})

test('picker presents both paths and unpaid disclaimer', () => {
  assert.match(picker, /data-testid="planning-entry-path-picker"/)
  assert.match(picker, /planning-entry-\$\{path\}/)
  assert.match(picker, /'direct', 'with_pm'/)
  assert.match(picker, /유료/)
  assert.match(picker, /같은 프로젝트/)
})

test('dual-entry doc marks E-01 as implemented for path picker', () => {
  assert.match(dualDoc, /E-01/)
  assert.match(dualDoc, /부분 구현\(2026-11-08\)/)
  assert.match(dualDoc, /_planning_entry_path/)
  assert.match(dualDoc, /선택 UI/)
})
