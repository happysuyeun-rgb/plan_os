import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const notice = readFileSync(
  new URL('../src/components/common/StaffingDigestGateNotice.tsx', import.meta.url),
  'utf8',
)
const review = readFileSync(new URL('../src/pages/ProjectAiReviewPage.tsx', import.meta.url), 'utf8')
const specialist = readFileSync(
  new URL('../src/pages/SpecialistRequestMockPage.tsx', import.meta.url),
  'utf8',
)

test('digest gate notice requires S2 snapshot and unpaid disclaimer (E-06 Mock)', () => {
  assert.match(notice, /data-testid="staffing-digest-gate-notice"/)
  assert.match(notice, /문서 snapshot\(digest\)을 고정하세요/)
  assert.match(notice, /stale/)
  assert.match(notice, /유료 실행이 시작되지 않습니다/)
  assert.match(notice, /audits\/new/)
  assert.match(notice, /hasManifest/)
})

test('ai-review and specialist request pages surface digest gate notice', () => {
  assert.match(review, /StaffingDigestGateNotice/)
  assert.match(review, /hasManifest=\{Boolean\(auditManifestId\)\}/)
  assert.match(specialist, /StaffingDigestGateNotice/)
  assert.match(specialist, /hasManifest=\{Boolean\(manifestId\)\}/)
})
