import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page = readFileSync(new URL('../src/pages/SpecialistRequestMockPage.tsx',import.meta.url),'utf8')
const app = readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
test('mock route is protected by application authentication',()=>{
 assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*?specialists\/request/)
})
test('request UI requires current project and user verification',()=>{
 assert.match(page, /verifiedProjectId === projectId/)
 assert.match(page, /verifiedUserId === userId/)
 assert.match(page, /currentProject\?\.user_id === userId/)
})
test('draft review is explicitly non-executable and cancellable',()=>{
 assert.match(page, /계약\/승인\/결제\/실행 불가/)
 assert.match(page, /setContractPreview\(null\)/)
 assert.match(page, /setDraft\(null\)/)
})
test('mock contract review can hand off to ai-review without claiming paid hire',()=>{
 assert.match(page, /writeSpecialistReviewHandoff/)
 assert.match(page, /Mock 기획 검수로 이어가기/)
 assert.match(page, /ai-review/)
})
