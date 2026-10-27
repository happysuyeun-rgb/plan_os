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
test('approved server contract can run Mock worker, accept report, and hand off without paid hire',()=>{
 assert.match(page, /enqueueAndProcessMockRun/)
 assert.match(page, /Mock worker 서버 실행/)
 assert.match(page, /publishAiArtifactFromRun/)
 assert.match(page, /decideAiArtifact/)
 assert.match(page, /결과 수락 · S1 연결/)
 assert.match(page, /writeSpecialistReviewHandoff/)
 assert.match(page, /Mock 기획 검수로 이어가기/)
 assert.match(page, /ai-review/)
 assert.match(page, /유료 LLM/)
})
