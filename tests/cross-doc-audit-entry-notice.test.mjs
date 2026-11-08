import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const notice = readFileSync(
  new URL('../src/components/common/CrossDocAuditEntryNotice.tsx', import.meta.url),
  'utf8',
)
const documentPage = readFileSync(new URL('../src/pages/DocumentPage.tsx', import.meta.url), 'utf8')

test('cross-doc audit entry requires 2+ doc types and unpaid Mock disclaimer', () => {
  assert.match(notice, /data-testid="cross-doc-audit-entry-notice"/)
  assert.match(notice, /docTypeCount < 2/)
  assert.match(notice, /자동 PASS/)
  assert.match(notice, /유료 결제/)
  assert.match(notice, /\/ai-review/)
  assert.match(notice, /data-testid="cross-doc-audit-entry-cta"/)
})

test('document page surfaces cross-doc audit entry and header CTA', () => {
  assert.match(documentPage, /CrossDocAuditEntryNotice/)
  assert.match(documentPage, /docTypeCount=\{availableTypes\.length\}/)
  assert.match(documentPage, /data-testid="cross-doc-audit-header-cta"/)
  assert.match(documentPage, /availableTypes\.length >= 2/)
})
