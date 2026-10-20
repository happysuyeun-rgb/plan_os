import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const text=readFileSync(new URL('../src/lib/mockSpecialistRequest.ts',import.meta.url),'utf8')
const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const { MOCK_SPECIALIST, createMockDraft, validateMockRequest } = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const good={roleId:MOCK_SPECIALIST.id,projectId:'p1',task:'기획 문서 세 개를 검수해 주세요.',acceptanceCriteria:'누락 항목과 근거를 정리'}
test('a valid request remains an unexecuted local draft',()=>{const d=createMockDraft(good);assert.equal(d.status,'draft');assert.equal(d.projectId,'p1');assert.equal(d.roleId,'requirements_auditor_v1')})
test('invalid role, project or short text must be rejected',()=>{assert.ok(validateMockRequest({...good,roleId:'fantasy'}));assert.ok(validateMockRequest({...good,projectId:''}));assert.ok(validateMockRequest({...good,task:'짧다'}));assert.ok(validateMockRequest({...good,acceptanceCriteria:'짧아'}))})
test('no tool execution or invented price in mock role contract',()=>{assert.deepEqual(MOCK_SPECIALIST.tools,[]);assert.equal(typeof MOCK_SPECIALIST.capability,'string')})
test('draft creation rejects invalid inputs',()=>assert.throws(()=>createMockDraft({...good,task:'no'})))
