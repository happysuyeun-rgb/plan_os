import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const browser = await chromium.launch({ headless: true })
const base = 'http://127.0.0.1:5173'
const localUser = {
  id: 'local-dev-user', email: 'qa@example.invalid', name: 'QA',
  avatar_url: '', plan: 'pro', ai_generations_this_month: 0,
  onboarding_completed: true, created_at: new Date(0).toISOString(),
}
async function open(path, authenticated = true) {
  const context = await browser.newContext()
  if (authenticated) {
    await context.addInitScript((user) => {
      sessionStorage.setItem('planos-local-dev-user', JSON.stringify(user))
    }, localUser)
  }
  const page = await context.newPage()
  await page.goto(base + path)
  return { page, context }
}
try {
  let { page, context } = await open('/projects/fixture-owner/specialists/request')
  await page.getByText('요구사항 검수 전문가').waitFor()
  await page.getByRole('button', { name: '요청 초안 미리보기' }).click()
  await page.getByRole('alert').getByText('업무 요청은 10~1000자로 작성해 주세요.').waitFor()
  await page.getByPlaceholder('검수할 범위와 원하는 결과를 10자 이상 작성하세요.').fill('기획 요구사항 문서의 누락 항목을 검토해 주세요.')
  await page.getByPlaceholder('어떤 결과면 완료인지 5자 이상 작성하세요.').fill('누락과 근거를 보고서로 정리')
  await page.getByRole('button', { name: '요청 초안 미리보기' }).click()
  await page.getByText('요청 초안 생성됨').waitFor()
  assert.equal(await page.getByRole('button', { name: '계약 조건 모의 검토' }).isDisabled(), true)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '계약 조건 모의 검토' }).click()
  await page.getByText('검토 상태: review_only', { exact: false }).waitFor()
  await page.getByText('예상 비용: 산정 불가', { exact: false }).waitFor()
  await page.getByText('최대 청구금액: 미정', { exact: false }).waitFor()
  await page.getByRole('button', { name: '초안 취소' }).click()
  assert.equal(await page.getByText('검토 상태: review_only', { exact: false }).count(), 0)
  await page.reload()
  assert.equal(await page.getByText('요청 초안 생성됨').count(), 0)
  await context.close()

  ;({page,context} = await open('/projects/fixture-viewer/specialists/request'))
  await page.getByText('프로젝트 소유자만 작성할 수 있습니다.', {exact:false}).waitFor()
  assert.equal(await page.getByRole('button', {name:'요청 초안 미리보기'}).count(),0)
  await context.close()

  ;({page,context} = await open('/projects/fixture-deleted/specialists/request'))
  await page.getByText('프로젝트에 접근할 수 없거나 삭제된 프로젝트입니다.').waitFor()
  await context.close()

  ;({page,context} = await open('/projects/fixture-missing/specialists/request'))
  await page.getByText('프로젝트에 접근할 수 없거나 삭제된 프로젝트입니다.').waitFor()
  await context.close()

  ;({page,context} = await open('/projects/fixture-owner/specialists/request', false))
  await page.waitForURL(/\/login\?redirect=/)
  await context.close()
  console.log('S3 browser E2E PASS: owner draft/review/cancel/reload, viewer, deleted, missing, unauthenticated')
} finally {
  await browser.close()
}
