// Isolated F-401 Chromium smoke: synthetic client fixture only, no hosted Supabase.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ headless: true })
const base = 'http://127.0.0.1:5173'
const user = {
  id: 'local-dev-user',
  email: 'f401-qa@example.invalid',
  name: 'Synthetic F401 QA',
  avatar_url: '',
  plan: 'pro',
  ai_generations_this_month: 0,
  onboarding_completed: true,
  created_at: new Date(0).toISOString(),
}
async function open(projectId, authenticated = true) {
  const context = await browser.newContext()
  if (authenticated) {
    await context.addInitScript((value) => {
      sessionStorage.setItem('planos-local-dev-user', JSON.stringify(value))
    }, user)
  }
  const page = await context.newPage()
  page.setDefaultTimeout(12000)
  await page.goto(base + `/projects/${projectId}/plans/new`)
  return { context, page }
}
try {
  // Owner: invalid request -> valid draft; never persisted or approved.
  let { context, page } = await open('f401-fixture-owner')
  await page.getByRole('heading', { name: '업무 계획 초안 작성' }).waitFor()
  await page.getByText('AI 생성·서버 저장·승인·업무 실행은 지원하지 않습니다.', { exact: false }).waitFor()
  await page.getByRole('button', { name: '계획 초안 검토' }).click()
  await page.getByRole('alert').getByText('목표는 10~1000자로 입력하세요.').waitFor()
  await page.getByRole('textbox', { name: '업무 목표' }).fill('기획 검수 기능의 누락을 찾고 검증 가능한 개발 계획을 만든다.')
  await page.getByRole('textbox', { name: '단계 제목' }).fill('현재 요구사항 분석')
  await page.getByRole('textbox', { name: '완료 기준' }).fill('요구사항의 누락 항목을 기록한다.')
  await page.getByRole('button', { name: '계획 초안 검토' }).click()
  await page.getByRole('heading', { name: '사람 작성 계획 초안' }).waitFor()
  await page.getByText('상태: draft · 미저장 · 미승인 · 실행 불가').waitFor()
  assert.equal(await page.getByRole('button', { name: '실행' }).count(), 0)

  // Editing after preview invalidates the preview and no stale plan is submitted.
  await page.getByRole('button', { name: '+ 단계 추가' }).click()
  assert.equal(await page.getByRole('heading', { name: '사람 작성 계획 초안' }).count(), 0)
  await page.getByRole('textbox', { name: '단계 제목' }).nth(1).fill('QA 확인')
  await page.getByRole('textbox', { name: '완료 기준' }).nth(1).fill('테스트 목록과 기대 결과가 작성되었다.')
  await page.getByLabel('선행 단계').nth(1).selectOption({ index: 1 })
  await page.getByRole('button', { name: '계획 초안 검토' }).click()
  await page.getByRole('heading', { name: '사람 작성 계획 초안' }).waitFor()
  await page.getByText('선행 단계: 1').waitFor()

  await page.getByRole('button', { name: '검토 취소' }).click()
  assert.equal(await page.getByRole('heading', { name: '사람 작성 계획 초안' }).count(), 0)
  await page.getByRole('button', { name: '초기화' }).click()
  assert.equal(await page.getByRole('textbox', { name: '업무 목표' }).inputValue(), '')
  assert.equal(await page.getByRole('textbox', { name: '단계 제목' }).count(), 1)
  await page.getByRole('textbox', { name: '업무 목표' }).fill('새로고침하면 남지 않아야 하는 계획 초안 내용이다.')
  await page.reload()
  await page.getByRole('heading', { name: '업무 계획 초안 작성' }).waitFor()
  assert.equal(await page.getByRole('textbox', { name: '업무 목표' }).inputValue(), '')
  assert.equal(await page.getByRole('heading', { name: '사람 작성 계획 초안' }).count(), 0)
  await context.close()

  // Non-owner, soft-deleted, nonexistent, and anonymous guard (UI, not JWT/RLS).
  ;({ context, page } = await open('f401-fixture-viewer'))
  await page.getByRole('alert').getByText('프로젝트 소유자만 계획 초안을 작성할 수 있습니다.').waitFor()
  assert.equal(await page.getByRole('button', { name: '계획 초안 검토' }).count(), 0)
  await context.close()

  ;({ context, page } = await open('f401-fixture-deleted'))
  await page.getByRole('alert').getByText('프로젝트 소유자만 계획 초안을 작성할 수 있습니다.').waitFor()
  await context.close()

  ;({ context, page } = await open('f401-fixture-missing'))
  await page.getByRole('alert').getByText('프로젝트 소유자만 계획 초안을 작성할 수 있습니다.').waitFor()
  await context.close()

  ;({ context, page } = await open('f401-fixture-owner', false))
  await page.waitForURL(/\/login\?redirect=/)
  await context.close()

  console.log('F401 Chromium E2E PASS: owner validation/preview/dependency/clear/reload, viewer/deleted/missing/anonymous')
} finally {
  await browser.close()
}
