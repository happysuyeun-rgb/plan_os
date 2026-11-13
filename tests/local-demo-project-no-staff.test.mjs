import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const localDevData = readFileSync(new URL('../src/lib/localDevData.ts', import.meta.url), 'utf8')

test('localDev seeds one demo project without AI staff hire', () => {
  assert.match(localDevData, /LOCAL_DEMO_NO_STAFF_MARKER = 'no_ai_staff'/)
  assert.match(localDevData, /export function ensureLocalDemoProjectWithoutStaff/)
  assert.match(localDevData, /카페 예약 앱 \(체험\)/)
  assert.match(localDevData, /AI 직원은 채용하지 않은 상태/)
  assert.match(localDevData, /local_demo: LOCAL_DEMO_NO_STAFF_MARKER/)
  assert.match(localDevData, /ensureLocalDemoProjectWithoutStaff\(userId\)/)
  assert.doesNotMatch(localDevData, /hire|contract|specialist.*assign/i)
})
