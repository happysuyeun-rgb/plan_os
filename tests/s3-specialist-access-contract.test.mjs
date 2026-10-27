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
test('server contract draft requires consent and can be cancelled locally',()=>{
 assert.match(page, /createAgentContractDraft/)
 assert.match(page, /acceptAgentContract/)
 assert.match(page, /setContractPreview\(null\)/)
 assert.match(page, /setDraft\(null\)/)
 assert.match(page, /AGENT_CONTRACT_CONSENT_STATEMENT/)
})
test('approved server contract can hand off to ai-review without claiming paid hire',()=>{
 assert.match(page, /writeSpecialistReviewHandoff/)
 assert.match(page, /승인된 계약으로 Mock 검수 이어가기/)
 assert.match(page, /ai-review\?contract=/)
 assert.match(page, /유료 LLM/)
})
