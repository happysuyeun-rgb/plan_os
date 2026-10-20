import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/lib/auditSourceSelection.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { validateAuditSourceSelection: validate } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const candidate = (id, patch={}) => ({
  id, projectId:'p1', type:'prd', revision:'v1', digest:'sha256:'+'a'.repeat(64),
  deleted:false,hasUnsavedChanges:false,...patch,
})
test('accepts exactly scoped clean sources with immutable snapshot metadata', () => {
  assert.equal(validate('p1',[candidate('a'),candidate('b')]).ok,true)
})
test('rejects insufficient, duplicated and cross-project sources', () => {
  assert.equal(validate('p1',[candidate('a')]).reason,'NEED_TWO_SOURCES')
  assert.equal(validate('p1',[candidate('a'),candidate('a')]).reason,'DUPLICATE_SOURCE')
  assert.equal(validate('p1',[candidate('a'),candidate('b',{projectId:'p2'})]).reason,'CROSS_PROJECT')
})
test('rejects deleted, unsaved, and unversioned sources', () => {
  assert.equal(validate('p1',[candidate('a'),candidate('b',{deleted:true})]).reason,'DELETED_SOURCE')
  assert.equal(validate('p1',[candidate('a'),candidate('b',{hasUnsavedChanges:true})]).reason,'UNSAVED_SOURCE')
  assert.equal(validate('p1',[candidate('a'),candidate('b',{digest:''})]).reason,'MISSING_SNAPSHOT')
})
