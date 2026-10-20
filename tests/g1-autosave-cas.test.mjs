import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const source=readFileSync(new URL('../src/lib/documentAutosave.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {createDocumentAutosave}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))

test('server CAS rejects stale writer and preserves editor draft for retry',async()=>{
 let server='v2'
 let acknowledged='v1'
 const errors=[]
 const lane=createDocumentAutosave({
   delayMs:100000,
   persist:async(id,content)=>{if(acknowledged!==server)throw new Error('stale');server=content;return {content}},
   onSaved:(id,content)=>{acknowledged=content},
   onReplaced:()=>{},
   onError:(id)=>errors.push(id),
 })
 lane.schedule('d','local-draft')
 await lane.flush('d')
 assert.equal(server,'v2')
 assert.equal(lane.getStatus('d'),'error')
 assert.deepEqual(errors,['d'])
})
test('acknowledgement of older in-flight revision advances baseline for newer queued edit',async()=>{
 let server='start',acknowledged='start'
 let release
 const gate=new Promise(r=>release=r)
 const commits=[]
 const lane=createDocumentAutosave({
  delayMs:100000,
  persist:async(id,content)=>{if(acknowledged!==server)throw new Error('stale');if(content==='edit-1')await gate;server=content;return {content}},
  onSaved:(id,content)=>{acknowledged=content;commits.push(content)},
  onReplaced:()=>{},
  onError:()=>{throw new Error('unexpected save failure')},
 })
 lane.schedule('d','edit-1')
 const first=lane.flush('d')
 lane.schedule('d','edit-2')
 const second=lane.flush('d')
 release()
 await Promise.all([first,second])
 assert.equal(server,'edit-2')
 assert.equal(lane.getStatus('d'),'saved')
 assert.deepEqual(commits,['edit-1','edit-2'])
})
test('explicit replacement updates baseline without replacing later edits',async()=>{
 let replacementShown=false,committed=null
 const lane=createDocumentAutosave({
  delayMs:100000,
  persist:async()=>({}),
  onSaved:()=>{},
  onCommitted:(id,content)=>{committed=content},
  onReplaced:()=>{replacementShown=true},
  onError:()=>{},
 })
 let release
 const gate=new Promise(r=>release=r)
 const replacing=lane.replace('d',async()=>{await gate;return 'server-version'})
 lane.schedule('d','newer-draft')
 release()
 await replacing
 assert.equal(committed,'server-version')
 assert.equal(replacementShown,false)
})
