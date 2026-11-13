import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const nav = readFileSync(
  new URL('../src/components/layout/GlobalNavBar.tsx', import.meta.url),
  'utf8',
)
const page = readFileSync(new URL('../src/pages/GuidePage.tsx', import.meta.url), 'utf8')

test('nav and route expose project usage guide', () => {
  assert.match(nav, /to: '\/guide'/)
  assert.match(nav, /이용 가이드/)
  assert.match(app, /path="\/guide"/)
  assert.match(app, /GuidePage/)
})

test('guide page covers project usage sections', () => {
  assert.match(page, /data-testid="guide-page"/)
  assert.match(page, /프로젝트 이용 가이드/)
  assert.match(page, /문서 작업/)
  assert.match(page, /멤버 초대/)
  assert.match(page, /AI 직원/)
})
