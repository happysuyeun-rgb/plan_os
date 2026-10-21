import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../src/lib/humanPmPlanDraft.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {createHumanPlanDraft,validateHumanPlan}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const base={projectId:'p1',objective:'사용자가 직접 계획을 작성하고 검토한다.',status:'draft',steps:[{id:'1',title:'요구사항 확인',acceptanceCriteria:'요구사항 정리 완료',dependsOn:null},{id:'2',title:'기획 검수',acceptanceCriteria:'누락 사항을 점검',dependsOn:'1'}]}
test('human PM plan remains draft with valid dependency',()=>{const x=createHumanPlanDraft(base);assert.equal(x.status,'draft');assert.equal(x.steps[1].dependsOn,'1')})
test('future dependency and unknown dependency are rejected',()=>{assert.ok(validateHumanPlan({...base,steps:[{...base.steps[0],dependsOn:'2'},base.steps[1]]}));assert.ok(validateHumanPlan({...base,steps:[base.steps[0],{...base.steps[1],dependsOn:'missing'}]}))})
test('duplicate IDs and missing acceptance criteria rejected',()=>{assert.ok(validateHumanPlan({...base,steps:[base.steps[0],{...base.steps[1],id:'1'}]}));assert.ok(validateHumanPlan({...base,steps:[{...base.steps[0],acceptanceCriteria:'x'}]}))})
test('too many steps and empty objective rejected',()=>{assert.ok(validateHumanPlan({...base,steps:Array.from({length:21},(_,i)=>({...base.steps[0],id:String(i)}))}));assert.ok(validateHumanPlan({...base,objective:' '}))})
