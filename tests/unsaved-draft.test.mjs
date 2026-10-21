import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const source=readFileSync(new URL('../src/lib/unsavedDraft.ts',import.meta.url),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {getUnsavedDraft,storeUnsavedDraft,acknowledgeSavedDraft,clearUnsavedDraft,unsavedDraftKey}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const items=new Map()
globalThis.localStorage={
 getItem:(k)=>items.get(k)??null,
 setItem:(k,v)=>items.set(k,v),
 removeItem:(k)=>items.delete(k),
}
test('unsaved edits survive reload and keep original baseline',()=>{
 items.clear()
 storeUnsavedDraft('alice','doc1','original','first')
 storeUnsavedDraft('alice','doc1','new-incorrect-base','second')
 assert.deepEqual([getUnsavedDraft('alice','doc1').base,getUnsavedDraft('alice','doc1').content],['original','second'])
})
test('server acknowledgment preserves newer local edits and rebases safely',()=>{
 items.clear()
 storeUnsavedDraft('alice','doc1','original','first')
 storeUnsavedDraft('alice','doc1','original','second')
 acknowledgeSavedDraft('alice','doc1','first')
 assert.deepEqual([getUnsavedDraft('alice','doc1').base,getUnsavedDraft('alice','doc1').content],['first','second'])
 clearUnsavedDraft('alice','doc1','first')
 assert.equal(getUnsavedDraft('alice','doc1').content,'second')
})
test('old acknowledgment cannot erase more recent edits',()=>{
 items.clear()
 storeUnsavedDraft('alice','doc1','original','newest')
 clearUnsavedDraft('alice','doc1','older')
 assert.equal(getUnsavedDraft('alice','doc1').content,'newest')
 acknowledgeSavedDraft('alice','doc1','newest')
 assert.equal(getUnsavedDraft('alice','doc1'),null)
})
test('drafts are isolated by user and document identity',()=>{
 items.clear()
 storeUnsavedDraft('alice','doc1','old','secret')
 assert.equal(getUnsavedDraft('bob','doc1'),null)
 assert.equal(getUnsavedDraft('alice','doc2'),null)
 assert.notEqual(unsavedDraftKey('alice','doc1'),unsavedDraftKey('bob','doc1'))
})
