// Disposable browser smoke test for the *integrated* Phase 0 branch.
// Uses LOCAL Supabase Auth + PostgREST and the REAL Vite frontend.
// Does not connect to live Plan OS or deploy anything.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const localDir=process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(localDir,'PLANOS_LOCAL_SUPABASE_DIR is required')
for(const key of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_URL','SUPABASE_DB_PASSWORD']){
  assert(!process.env[key],'Hosted Supabase credentials are not allowed')
}
const raw=execFileSync('supabase',['status','-o','env'],{
  cwd:localDir,encoding:'utf8',timeout:30000,
})
const variables=Object.fromEntries(raw.split('\n').flatMap(line=>{
  const match=line.match(/^([A-Z_]+)=(.*)$/)
  return match?[[match[1],match[2].replace(/^["']|["']$/g,'')]]:[]
}))
assert(variables.SERVICE_ROLE_KEY && variables.ANON_KEY)
// Defaults match CI; local runs may override when 54321/54322 are taken.
const api=process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
const dbPort=process.env.PLANOS_LOCAL_DB_PORT ?? '54322'
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api), 'Local API URL must be loopback')
assert(!variables.API_URL || variables.API_URL===api, 'Unexpected nonlocal API URL')
const site='http://127.0.0.1:5173'
const runId=Date.now()
const loginEmail=`browser-smoke-${runId}@example.test`
const loginPassword='Synthetic-browser-smoke-password-123!'
import { randomUUID } from 'node:crypto'

const projectId=randomUUID()

async function localAdmin(path,method,body){
  const r=await fetch(api+path,{
    method,headers:{
      apikey:variables.SERVICE_ROLE_KEY,
      Authorization:'Bearer '+variables.SERVICE_ROLE_KEY,
      'Content-Type':'application/json',
    },body:JSON.stringify(body),signal:AbortSignal.timeout(15000),
  })
  const result=await r.json()
  assert(r.ok,'Local admin auth operation failed HTTP '+r.status)
  return result
}
const created=await localAdmin('/auth/v1/admin/users','POST',{
  email:loginEmail,password:loginPassword,email_confirm:true,
  user_metadata:{full_name:'E2E Test User'},
})
assert(created.id,'Local Auth synthetic account could not be created')
execFileSync('psql',[
  '-X','-v','ON_ERROR_STOP=1','-v','user_id='+created.id,
  '-v','project_id='+projectId,
  '-f',process.cwd()+'/tests/e2e/seed_browser.sql',
],{
  env:{...process.env,PGHOST:'127.0.0.1',PGPORT:dbPort,
    PGUSER:'postgres',PGPASSWORD:'postgres',PGDATABASE:'postgres',PGSSLMODE:'disable'},
  stdio:['ignore','pipe','pipe'],timeout:30000,
})
console.log('PASS local Auth synthetic user and private browser QA project seeded')

let browser
let page
const errors=[]
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']})
  page=await browser.newPage({viewport:{width:1366,height:900}})
  page.on('pageerror',err=>errors.push(err.message))
  await page.goto(site+'/login',{waitUntil:'domcontentloaded',timeout:30000})
  await page.locator('input[type=email]').fill(loginEmail)
  await page.locator('input[type=password]').fill(loginPassword)
  await page.getByRole('button',{name:'임시 로그인'}).click()
  await page.waitForURL(url=>url.pathname==='/dashboard',{timeout:30000})
  console.log('PASS real browser login through local Supabase Auth JWT')

  await page.getByText('Phase0 E2E Smoke Project',{exact:false}).first()
    .waitFor({state:'visible',timeout:25000})
  console.log('PASS dashboard loads authorized synthetic project')

  await page.goto(site+'/projects/'+projectId+'/prd',{waitUntil:'domcontentloaded'})
  await page.getByText('Phase0 E2E Document',{exact:false}).first()
    .waitFor({state:'visible',timeout:30000})
  console.log('PASS document route displays seeded PRD in integrated frontend')
  await page.reload({waitUntil:'domcontentloaded'})
  await page.getByText('Phase0 E2E Document',{exact:false}).first()
    .waitFor({state:'visible',timeout:30000})
  console.log('PASS project document visible after full browser reload')

  // B-01: Edit PRD, switch immediately to IA and edit IA. The two debounced
  // writes must be scoped to their original document IDs, not the active tab.
  const mainEditor=page.locator('main textarea')
  const prdContent='# Phase0 E2E Document\\n\\nPRD-PENDING-B01-'+created.id
  const iaContent='# Phase0 IA Fixture\\n\\nIA-PENDING-B01-'+created.id
  await mainEditor.fill(prdContent)
  await page.getByRole('navigation',{name:'산출물 탭'})
    .getByRole('button',{name:/기능명세서/}).click()
  await page.waitForURL(url=>url.pathname.endsWith('/ia'),{timeout:15000})
  await mainEditor.fill(iaContent)
  await page.getByText('저장됨',{exact:true}).waitFor({state:'visible',timeout:20000})
  await page.reload({waitUntil:'domcontentloaded'})
  await page.waitForURL(url=>url.pathname.endsWith('/ia'),{timeout:15000})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  assert.equal(await mainEditor.inputValue(),iaContent,'B-01 IA autosave was lost')
  await page.getByRole('navigation',{name:'산출물 탭'})
    .getByRole('button',{name:/PRD/}).click()
  await page.waitForURL(url=>url.pathname.endsWith('/prd'),{timeout:15000})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  assert.equal(await mainEditor.inputValue(),prdContent,'B-01 PRD draft overwritten after switching to IA')
  console.log('PASS B-01 rapid PRD to IA tab switch keeps both independent saved drafts')

  // B-02: Multiple edits inside debounce window keep only final text.
  // A content-only edit must not issue new comment-thread GETs. A comment
  // fetch should depend on document ID or filter changes, not every keystroke.
  await page.waitForTimeout(250)
  let repeatedCommentGets=0
  const countCommentGets=request=>{
    if(request.method()==='GET' && request.url().includes('/rest/v1/project_comments')){
      repeatedCommentGets+=1
    }
  }
  page.on('request',countCommentGets)
  let last=prdContent
  for(let i=1;i<=5;i++){
    last=prdContent+'\\nLAST-REVISION-B02-'+i
    await mainEditor.fill(last)
  }
  await page.getByText('저장됨',{exact:true}).waitFor({state:'visible',timeout:20000})
  page.off('request',countCommentGets)
  assert.equal(repeatedCommentGets,0,'B-02 content edits triggered unnecessary comment thread refetches')
  console.log('PASS B-02 content edits do not refetch comment threads')
  await page.reload({waitUntil:'domcontentloaded'})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  assert.equal(await mainEditor.inputValue(),last,'B-02 a stale intermediate revision reached UI after reload')
  console.log('PASS B-02 five successive edits persist final revision after reload')

  // C-01: Chat send while PRD has an unsaved draft must append to that draft,
  // not to a stale server fetch. Chat is currently a placeholder append.
  const unsaved=last+'\\nUNSAVED-HUMAN-DRAFT-C01'
  await mainEditor.fill(unsaved)
  const chatInput=page.locator('aside textarea[placeholder*="@"]')
  await chatInput.fill('CHAT-REQUEST-C01')
  await chatInput.press('Enter')
  await page.getByText('요청하신 내용을 문서에 반영했습니다.',{exact:true})
    .waitFor({state:'visible',timeout:25000})
  await page.getByText('저장됨',{exact:true}).waitFor({state:'visible',timeout:20000})
  const merged=await mainEditor.inputValue()
  assert(merged.includes('UNSAVED-HUMAN-DRAFT-C01'),'C-01 lost unsaved human text')
  assert(merged.includes('CHAT-REQUEST-C01'),'C-01 missing chat placeholder edit')
  await page.reload({waitUntil:'domcontentloaded'})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  const reloaded=await mainEditor.inputValue()
  assert.equal(reloaded,merged,'C-01 merged draft/chat content was not persisted')
  console.log('PASS C-01 pending human edit plus chat request merged and persisted after reload')

  // Ensure these are real persisted server values, not only client drafts.
  const serverResponse=await fetch(api+'/rest/v1/documents?select=id,type,content&project_id=eq.'+projectId,{
    headers:{apikey:variables.SERVICE_ROLE_KEY,Authorization:'Bearer '+variables.SERVICE_ROLE_KEY},
    signal:AbortSignal.timeout(12000),
  })
  assert(serverResponse.ok,'Could not inspect synthetic local documents in disposable DB')
  const serverRows=await serverResponse.json()
  assert.equal(serverRows.find(row=>row.type==='prd')?.content,merged)
  assert.equal(serverRows.find(row=>row.type==='ia')?.content,iaContent)
  console.log('PASS persisted local PostgREST PRD/IA contents match final browser edits')

  // B-05: A historical snapshot can be previewed in read-only mode,
  // restored as a new snapshot, and the prior current snapshot remains
  // readable/unchanged. Verify BOTH browser and durable local DB rows.
  await page.getByRole('button',{name:'버전 저장',exact:true}).click()
  const versionDialog=page.getByRole('dialog')
  await versionDialog.locator('input').fill('B05-old')
  await versionDialog.getByRole('button',{name:'저장',exact:true}).click()
  await page.getByRole('button',{name:/^v1 \(B05-old\)$/}).first()
    .waitFor({state:'visible',timeout:20000})
  console.log('PASS B-05 initial historical snapshot created')

  const beforeRestore=merged+'\\nB05-CURRENT-MUST-BE-PRESERVED'
  await mainEditor.fill(beforeRestore)
  await page.getByText('저장됨',{exact:true}).waitFor({state:'visible',timeout:20000})
  await page.getByRole('button',{name:'버전 저장',exact:true}).click()
  const currentVersionDialog=page.getByRole('dialog')
  await currentVersionDialog.locator('input').fill('B05-current')
  await currentVersionDialog.getByRole('button',{name:'저장',exact:true}).click()
  await page.getByRole('button',{name:/^v2 \(B05-current\)$/}).first()
    .waitFor({state:'visible',timeout:20000})

  await page.getByRole('button',{name:/^v1 \(B05-old\)$/}).first().click()
  await page.waitForFunction(expected=>
    document.querySelector('main textarea')?.value===expected,merged,{timeout:12000})
  assert.notEqual(await mainEditor.getAttribute('readonly'),null,'B-05 historical version is editable')
  await page.getByRole('button',{name:'이 버전으로 복원'}).click()
  const restoreDialog=page.getByRole('dialog')
  await restoreDialog.getByRole('button',{name:'확인'}).click()
  await page.getByRole('button',{name:/^v3 \(복원\)$/}).first()
    .waitFor({state:'visible',timeout:20000})
  await page.waitForFunction(expected=>
    document.querySelector('main textarea')?.value===expected,merged,{timeout:12000})
  assert.equal(await mainEditor.inputValue(),merged,'B-05 restore did not put old snapshot into current editor')
  assert.equal(await mainEditor.getAttribute('readonly'),null,'B-05 current editor remains read-only after restore')

  await page.reload({waitUntil:'domcontentloaded'})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  assert.equal(await mainEditor.inputValue(),merged,'B-05 restored content did not survive reload')

  const getVersionResponse=await fetch(
    api+'/rest/v1/document_versions?select=version_number,version_name,content&document_id=eq.'+
    serverRows.find(row=>row.type==='prd')?.id+'&order=version_number.asc',{
      headers:{apikey:variables.SERVICE_ROLE_KEY,Authorization:'Bearer '+variables.SERVICE_ROLE_KEY},
      signal:AbortSignal.timeout(12000),
    }
  )
  assert(getVersionResponse.ok,'B-05 local version history cannot be read')
  const vrows=await getVersionResponse.json()
  assert.equal(vrows.length,3,'B-05 expected 2 saved historical versions + restored version')
  assert.deepEqual(vrows.map(v=>v.version_number),[1,2,3])
  assert.deepEqual(vrows.map(v=>v.version_name),['B05-old','B05-current','복원'])
  assert.deepEqual(vrows.map(v=>v.content),[merged,beforeRestore,merged],
    'B-05 historic/current snapshot was overwritten or restore produced wrong version')
  const restoredDocResponse=await fetch(
    api+'/rest/v1/documents?select=content&type=eq.prd&project_id=eq.'+projectId,{
      headers:{apikey:variables.SERVICE_ROLE_KEY,Authorization:'Bearer '+variables.SERVICE_ROLE_KEY},
      signal:AbortSignal.timeout(12000),
    })
  assert(restoredDocResponse.ok)
  assert.equal((await restoredDocResponse.json())[0].content,merged,
    'B-05 durable document did not match restored history')
  console.log('PASS B-05 historical preview is read-only; restore creates v3; v1/v2 remain intact')
  console.log('PASS B-05 latest restored document survives reload and matches local DB')

  // FAULT-01: Failure INSIDE the server RPC, after version INSERT and before
  // document UPDATE, must roll back all writes (not leave phantom history).
  execFileSync('psql',[
    '-X','-v','ON_ERROR_STOP=1',
    '-f',process.cwd()+'/tests/e2e/inject_restore_update_failure.sql',
  ],{
    env:{...process.env,PGHOST:'127.0.0.1',PGPORT:dbPort,
      PGUSER:'postgres',PGPASSWORD:'postgres',PGDATABASE:'postgres',PGSSLMODE:'disable'},
    stdio:['ignore','pipe','pipe'],timeout:30000,
  })
  await page.getByRole('button',{name:/^v2 \(B05-current\)$/}).first().click()
  await page.waitForFunction(expected=>
    document.querySelector('main textarea')?.value===expected,beforeRestore,{timeout:12000})
  const errorResult=page.waitForResponse(response=>
    response.request().method()==='POST' &&
    response.url().includes('/rest/v1/rpc/restore_document_version') &&
    !response.ok(),{timeout:22000})
  await page.getByRole('button',{name:'이 버전으로 복원'}).click()
  await page.getByRole('dialog').getByRole('button',{name:'확인'}).click()
  await errorResult
  await page.getByText('복원 결과를 확인하지 못했습니다.',{exact:false})
    .waitFor({state:'visible',timeout:15000})

  async function readLocalRows(table,select,query){
    const response=await fetch(api+'/rest/v1/'+table+'?select='+select+'&'+query,{
      headers:{apikey:variables.SERVICE_ROLE_KEY,
        Authorization:'Bearer '+variables.SERVICE_ROLE_KEY},
      signal:AbortSignal.timeout(12000),
    })
    assert(response.ok,'Cannot query isolated local '+table+' response')
    return response.json()
  }
  const documentId=serverRows.find(row=>row.type==='prd')?.id
  const queryVersions='document_id=eq.'+documentId+'&order=version_number.asc'
  const afterErrorVersions=await readLocalRows(
    'document_versions','id,version_number,version_name,content',queryVersions)
  assert.deepEqual(afterErrorVersions.map(v=>v.version_number),[1,2,3],
    'FAULT-01 created phantom version despite atomic RPC failure')
  const afterErrorDoc=await readLocalRows('documents','content',
    'project_id=eq.'+projectId+'&type=eq.prd')
  assert.equal(afterErrorDoc[0].content,merged,
    'FAULT-01 changed current document despite injected RPC error')
  const noOperations=await readLocalRows('document_restore_operations','id',
    'document_id=eq.'+documentId)
  assert.equal(noOperations.length,1,
    'FAULT-01 must roll back failed operation entry, retaining only prior v3 restore')
  console.log('PASS FAULT-01: injected server UPDATE failure rolls back snapshot, document and operation')

  // Drop the ONLY-LOCAL fault trigger, then retry the same modal confirmation.
  // The store must retain the operation UUID after the ambiguous error.
  execFileSync('psql',[
    '-X','-v','ON_ERROR_STOP=1',
    '-c','drop trigger qa_reject_document_restore on public.documents',
  ],{
    env:{...process.env,PGHOST:'127.0.0.1',PGPORT:dbPort,
      PGUSER:'postgres',PGPASSWORD:'postgres',PGDATABASE:'postgres',PGSSLMODE:'disable'},
    stdio:['ignore','pipe','pipe'],timeout:30000,
  })
  const retryRpcResponse=page.waitForResponse(response=>
    response.request().method()==='POST' &&
    response.url().includes('/rest/v1/rpc/restore_document_version'),{
      timeout:20000,
    })
  await page.getByRole('dialog').getByRole('button',{name:'확인'}).click()
  const retryReply=await retryRpcResponse
  const retryRows=await readLocalRows(
    'document_versions','id,version_number,version_name,content',queryVersions)
  const retryDoc=await readLocalRows('documents','content',
    'project_id=eq.'+projectId+'&type=eq.prd')
  console.log('RETRY DIAGNOSTIC',JSON.stringify({
    status:retryReply.status(),
    versions:retryRows.map(v=>({number:v.version_number,name:v.version_name})),
    documentIsRestored:retryDoc[0].content===beforeRestore,
    runtimeErrors:errors.length,
  }))
  assert(retryReply.ok(),'Atomic restore retry failed with HTTP '+retryReply.status())
  await page.getByRole('button',{name:/^v4 \(복원\)$/}).first()
    .waitFor({state:'visible',timeout:16000})
  assert.equal(await mainEditor.inputValue(),beforeRestore,
    'FAULT-01 retry did not restore correct target version')
  const retriedHistory=await readLocalRows(
    'document_versions','id,version_number,version_name,content',queryVersions)
  assert.deepEqual(retriedHistory.map(v=>v.version_number),[1,2,3,4],
    'Retry created extra or missing history snapshots')
  assert.equal(retriedHistory[3].content,beforeRestore)
  const appliedOps=await readLocalRows('document_restore_operations',
    'id,source_version_id,document_id','document_id=eq.'+documentId+
    '&order=created_at.asc')
  assert.equal(appliedOps.length,2,'Prior successful restore plus retry must create only two operations')
  console.log('PASS FAULT-01 retry: same historical snapshot applied once after removing injected error')

  // Replay the successful retry operation ID with an actual Auth JWT.
  // This must not create another historical version or overwrite later edits.
  const tokenResponse=await fetch(api+'/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{apikey:variables.ANON_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email:loginEmail,password:loginPassword}),
    signal:AbortSignal.timeout(12000),
  })
  assert(tokenResponse.ok)
  const userToken=(await tokenResponse.json()).access_token
  const idempotentResponse=await fetch(api+'/rest/v1/rpc/restore_document_version',{
    method:'POST',
    headers:{apikey:variables.ANON_KEY,Authorization:'Bearer '+userToken,
      'Content-Type':'application/json'},
    body:JSON.stringify({p_document_id:documentId,
      p_version_id:retriedHistory[1].id,
      p_operation_id:appliedOps[1].id}),
    signal:AbortSignal.timeout(12000),
  })
  assert(idempotentResponse.ok,'Idempotent replay unexpectedly denied')
  assert.equal((await readLocalRows('document_versions','id',queryVersions)).length,4,
    'Repeated operation ID created duplicate version')
  console.log('PASS IDEMPOTENCY-01: retry UUID replay leaves historical version count unchanged')

  // B-05 DRAFT: Current edited text that the user has NOT manually saved as
  // a version MUST be checkpointed before restoring an older snapshot.
  const unsnapshotted=beforeRestore+'\\nB05-UNSNAPSHOTTED-PRE-RESTORE'
  await mainEditor.fill(unsnapshotted)
  await page.getByText('저장됨',{exact:true}).waitFor({state:'visible',timeout:20000})
  await page.getByRole('button',{name:/^v1 \(B05-old\)$/}).first().click()
  await page.getByRole('button',{name:'이 버전으로 복원'}).click()
  await page.getByRole('dialog').getByRole('button',{name:'확인'}).click()
  await page.getByRole('button',{name:/^v6 \(복원\)$/}).first()
    .waitFor({state:'visible',timeout:20000})
  await page.reload({waitUntil:'domcontentloaded'})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  assert.equal(await mainEditor.inputValue(),merged,
    'Unsnapshotted-current restore did not produce original historical target')

  const preserved=await readLocalRows('document_versions',
    'version_number,version_name,content',queryVersions)
  assert.deepEqual(preserved.map(v=>v.version_number),[1,2,3,4,5,6])
  assert.equal(preserved[4].version_name,'복원 전 자동 보관')
  assert.equal(preserved[4].content,unsnapshotted,
    'Unsnapshotted current text not checkpointed prior to restoration')
  assert.equal(preserved[5].content,merged)
  assert.equal((await readLocalRows('documents','content',
    'project_id=eq.'+projectId+'&type=eq.prd'))[0].content,merged)
  console.log('PASS B-05 DRAFT: unsnapshotted current revision saved automatically as v5 before v6 restoration')

  // AUTHZ-01: RPC runs with SECURITY DEFINER, so caller permissions must be
  // checked explicitly. Neither an authenticated viewer nor anonymous client
  // may restore. The source version must belong to the requested document.
  const viewerEmail=`viewer-restoration-${runId}@example.test`
  const viewerPassword='Synthetic-viewer-test-password-123!'
  const viewer=await localAdmin('/auth/v1/admin/users','POST',{
    email:viewerEmail,password:viewerPassword,email_confirm:true,
  })
  assert(viewer.id,'Synthetic viewer user not created')
  const addViewerResponse=await fetch(api+'/rest/v1/project_members',{
    method:'POST',
    headers:{apikey:variables.SERVICE_ROLE_KEY,
      Authorization:'Bearer '+variables.SERVICE_ROLE_KEY,
      'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify({project_id:projectId,user_id:viewer.id,
      email:viewerEmail,name:'Synthetic viewer',role:'viewer',status:'active'}),
    signal:AbortSignal.timeout(12000),
  })
  assert(addViewerResponse.ok,'Local synthetic project viewer could not be linked')
  const viewerTokenResponse=await fetch(api+'/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{apikey:variables.ANON_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email:viewerEmail,password:viewerPassword}),
    signal:AbortSignal.timeout(12000),
  })
  assert(viewerTokenResponse.ok)
  const viewerToken=(await viewerTokenResponse.json()).access_token
  const authzBody=JSON.stringify({p_document_id:documentId,
    p_version_id:retriedHistory[0].id,
    p_operation_id:randomUUID()})
  const viewerDenied=await fetch(api+'/rest/v1/rpc/restore_document_version',{
    method:'POST',
    headers:{apikey:variables.ANON_KEY,Authorization:'Bearer '+viewerToken,
      'Content-Type':'application/json'},
    body:authzBody,signal:AbortSignal.timeout(12000),
  })
  assert(!viewerDenied.ok,'AUTHZ-01 viewer unexpectedly restored document')
  const anonDenied=await fetch(api+'/rest/v1/rpc/restore_document_version',{
    method:'POST',
    headers:{apikey:variables.ANON_KEY,
      Authorization:'Bearer '+variables.ANON_KEY,
      'Content-Type':'application/json'},
    body:authzBody,signal:AbortSignal.timeout(12000),
  })
  assert(!anonDenied.ok,'AUTHZ-01 anonymous client unexpectedly restored document')

  const iaDocument=serverRows.find(row=>row.type==='ia')?.id
  const foreignSnapshotResponse=await fetch(api+'/rest/v1/document_versions',{
    method:'POST',
    headers:{apikey:variables.SERVICE_ROLE_KEY,
      Authorization:'Bearer '+variables.SERVICE_ROLE_KEY,
      'Content-Type':'application/json',Prefer:'return=representation'},
    body:JSON.stringify({document_id:iaDocument,version_number:1,
      version_name:'foreign-document',content:'Wrong project document'}),
    signal:AbortSignal.timeout(12000),
  })
  assert(foreignSnapshotResponse.ok)
  const foreignSnapshot=(await foreignSnapshotResponse.json())[0]
  const invalidVersionResponse=await fetch(
    api+'/rest/v1/rpc/restore_document_version',{
      method:'POST',
      headers:{apikey:variables.ANON_KEY,Authorization:'Bearer '+userToken,
        'Content-Type':'application/json'},
      body:JSON.stringify({p_document_id:documentId,
        p_version_id:foreignSnapshot.id,
        p_operation_id:randomUUID()}),
      signal:AbortSignal.timeout(12000),
    })
  assert(!invalidVersionResponse.ok,
    'AUTHZ-01 allowed cross-document historical version restoration')
  assert.equal((await readLocalRows('document_versions','id',queryVersions)).length,6)
  console.log('PASS AUTHZ-01: viewer/anon and cross-document restore attempts denied')

  // CONC-01: Two authenticated restores with separate IDs must serialize on
  // the parent document row without version-number collisions.
  const competingOperations=[randomUUID(),randomUUID()]
  const concurrentReplies=await Promise.all(competingOperations.map(operationId=>
    fetch(api+'/rest/v1/rpc/restore_document_version',{
      method:'POST',
      headers:{apikey:variables.ANON_KEY,Authorization:'Bearer '+userToken,
        'Content-Type':'application/json'},
      body:JSON.stringify({p_document_id:documentId,
        p_version_id:retriedHistory[0].id,p_operation_id:operationId}),
      signal:AbortSignal.timeout(15000),
    }),
  ))
  assert(concurrentReplies.every(reply=>reply.ok),
    'CONC-01 simultaneous restore lost transaction or collided on version number')
  const afterConcurrent=await readLocalRows('document_versions',
    'version_number,version_name,content',queryVersions)
  assert.deepEqual(afterConcurrent.map(v=>v.version_number),[1,2,3,4,5,6,7,8])
  assert(afterConcurrent.slice(-2).every(v=>v.content===merged))
  console.log('PASS CONC-01: two concurrent restore transactions serialized as v7 and v8')


  // B-03: A delayed PRD autosave completion must not switch the IA editor
  // back to PRD, replace its draft, or corrupt either persisted document.
  let startSlowSave
  let releaseSlowSave
  const slowSaveStarted=new Promise(resolve=>{startSlowSave=resolve})
  const slowSaveGate=new Promise(resolve=>{releaseSlowSave=resolve})
  let slowSaveIntercepted=false
  // Autosave writes through the Revision CAS RPC since C-02; intercept it.
  await page.route('**/rest/v1/rpc/save_document_content_cas*',async route=>{
    if(route.request().method()==='POST' && !slowSaveIntercepted){
      slowSaveIntercepted=true
      startSlowSave()
      await slowSaveGate
    }
    await route.continue()
  })
  const b03Prd=merged+'\nB03-PRD-DELAYED-'+created.id
  const b03Ia=iaContent+'\nB03-IA-WHILE-PRD-PENDING'
  await mainEditor.fill(b03Prd)
  await Promise.race([
    slowSaveStarted,
    page.waitForTimeout(14000).then(()=>{throw Error('B-03 PRD CAS save never started')}),
  ])
  await page.getByRole('navigation',{name:'산출물 탭'})
    .getByRole('button',{name:/기능명세서/}).click()
  await page.waitForURL(url=>url.pathname.endsWith('/ia'),{timeout:15000})
  await mainEditor.fill(b03Ia)
  releaseSlowSave()
  await page.getByText('저장됨',{exact:true}).waitFor({state:'visible',timeout:20000})
  assert.equal(await mainEditor.inputValue(),b03Ia,'B-03 delayed PRD response contaminated IA')
  await page.unrouteAll({behavior:'wait'})
  await page.reload({waitUntil:'domcontentloaded'})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  assert.equal(await mainEditor.inputValue(),b03Ia,'B-03 IA value was lost after reload')
  await page.getByRole('navigation',{name:'산출물 탭'})
    .getByRole('button',{name:/PRD/}).click()
  await page.waitForURL(url=>url.pathname.endsWith('/prd'),{timeout:15000})
  assert.equal(await mainEditor.inputValue(),b03Prd,'B-03 delayed PRD save did not persist')
  console.log('PASS B-03: slow PRD save finished after IA switch without cross-document corruption')

  // B-04: A failed CAS save shows an error and retains the user's draft
  // after tab switch; a new edit following network recovery persists it.
  let failedSaveInjected=0
  await page.route('**/rest/v1/rpc/save_document_content_cas*',async route=>{
    if(route.request().method()==='POST' && failedSaveInjected===0){
      failedSaveInjected++
      await route.fulfill({
        status:503,contentType:'application/json',
        body:JSON.stringify({code:'B04_DISPOSABLE_FAULT',message:'offline simulation'}),
      })
    }else await route.continue()
  })
  const b04Draft=b03Prd+'\nB04-UNSAVED-ON-503'
  await mainEditor.fill(b04Draft)
  await page.getByText('저장 실패',{exact:true}).waitFor({state:'visible',timeout:22000})
  assert.equal(failedSaveInjected,1,'B-04 did not inject CAS failure')
  await page.unrouteAll({behavior:'wait'})
  await page.getByRole('navigation',{name:'산출물 탭'})
    .getByRole('button',{name:/기능명세서/}).click()
  await page.waitForURL(url=>url.pathname.endsWith('/ia'),{timeout:15000})
  assert.equal(await mainEditor.inputValue(),b03Ia)
  await page.getByRole('navigation',{name:'산출물 탭'})
    .getByRole('button',{name:/PRD/}).click()
  await page.waitForURL(url=>url.pathname.endsWith('/prd'),{timeout:15000})
  assert.equal(await mainEditor.inputValue(),b04Draft,'B-04 failed-save draft was discarded on tab return')
  await page.getByText('저장 실패',{exact:true}).waitFor({state:'visible',timeout:5000})
  const b04Recovered=b04Draft+'\nB04-RETRY-AFTER-RECOVERY'
  await mainEditor.fill(b04Recovered)
  await page.getByText('저장됨',{exact:true}).waitFor({state:'visible',timeout:22000})
  await page.reload({waitUntil:'domcontentloaded'})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  assert.equal(await mainEditor.inputValue(),b04Recovered,'B-04 recovered content missing after reload')
  console.log('PASS B-04: 503 save error visible; tab return preserves draft; reedit recovers after network resumes')

  // C-03: Delay the atomic chat RPC while switching from PRD to IA.
  // The eventual chat/document write must target PRD only, not the active IA.
  let startSlowChat
  let releaseSlowChat
  const slowChatStarted=new Promise(resolve=>{startSlowChat=resolve})
  const slowChatGate=new Promise(resolve=>{releaseSlowChat=resolve})
  let slowChatIntercepted=false
  await page.route('**/rest/v1/rpc/commit_chat_document_edit',async route=>{
    if(route.request().method()==='POST' && !slowChatIntercepted){
      slowChatIntercepted=true
      startSlowChat()
      await slowChatGate
    }
    await route.continue()
  })
  const c03Marker='CHAT-LATE-C03-'+created.id
  const chatForC03=page.locator('aside textarea[placeholder*="@"]')
  await chatForC03.fill(c03Marker)
  await chatForC03.press('Enter')
  await Promise.race([
    slowChatStarted,
    page.waitForTimeout(14000).then(()=>{throw Error('C-03 chat RPC never started')}),
  ])
  await page.getByRole('navigation',{name:'산출물 탭'})
    .getByRole('button',{name:/기능명세서/}).click()
  await page.waitForURL(url=>url.pathname.endsWith('/ia'),{timeout:15000})
  releaseSlowChat()
  await page.unrouteAll({behavior:'wait'})
  // Wait for the document-specific debounce and response, then inspect DB.
  let c03Written=false
  for(let attempt=0;attempt<28;attempt++){
    const docResponse=await fetch(
      api+'/rest/v1/documents?select=type,content&project_id=eq.'+projectId,{
        headers:{apikey:variables.SERVICE_ROLE_KEY,
          Authorization:'Bearer '+variables.SERVICE_ROLE_KEY},
        signal:AbortSignal.timeout(12000),
      })
    assert(docResponse.ok,'C-03 could not read disposable DB')
    const docs=await docResponse.json()
    const prd=docs.find(doc=>doc.type==='prd')?.content??''
    assert.equal(docs.find(doc=>doc.type==='ia')?.content,b03Ia,
      'C-03 changed IA server content while PRD chat was pending')
    if(prd.includes(c03Marker)){c03Written=true;break}
    await page.waitForTimeout(500)
  }
  assert(c03Written,'C-03 delayed PRD chat was never persisted')
  assert.equal(await mainEditor.inputValue(),b03Ia,
    'C-03 late chat edited currently active IA')
  assert.equal(await page.locator('aside .whitespace-pre-wrap')
    .filter({hasText:c03Marker}).count(),0,
    'C-03 PRD chat bubble leaked into IA conversation')
  assert.equal(await page.locator('aside textarea[placeholder*="@"]').inputValue(),'',
    'C-03 pending PRD input leaked into active IA chat input')
  const c03ChatResponse=await fetch(
    api+'/rest/v1/chat_messages?select=document_id,content&project_id=eq.'+projectId,{
      headers:{apikey:variables.SERVICE_ROLE_KEY,
        Authorization:'Bearer '+variables.SERVICE_ROLE_KEY},
      signal:AbortSignal.timeout(12000),
    })
  assert(c03ChatResponse.ok,'C-03 cannot inspect isolated chat rows')
  const c03ChatRows=await c03ChatResponse.json()
  assert(c03ChatRows.some(row=>
      row.document_id===serverRows.find(doc=>doc.type==='prd')?.id &&
      row.content.includes(c03Marker)),
    'C-03 delayed PRD chat was not saved to its owning conversation')
  assert(!c03ChatRows.some(row=>
      row.document_id===serverRows.find(doc=>doc.type==='ia')?.id &&
      row.content.includes(c03Marker)),
    'C-03 delayed PRD chat was misattributed to the IA document in DB')
  await page.getByRole('navigation',{name:'산출물 탭'})
    .getByRole('button',{name:/PRD/}).click()
  await page.waitForURL(url=>url.pathname.endsWith('/prd'),{timeout:15000})
  await page.waitForFunction(marker=>
    document.querySelector('main textarea')?.value.includes(marker),c03Marker,{timeout:14000})
  await page.reload({waitUntil:'domcontentloaded'})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  assert((await mainEditor.inputValue()).includes(c03Marker),
    'C-03 PRD chat update lost after reload')
  console.log('PASS C-03: delayed PRD chat edits only PRD; IA content and conversation remain isolated')


  // C-10: Atomic DB transaction with fault AFTER chat user INSERT but during
  // documents UPDATE. The entire transaction must roll back all rows.
  const c10DocId=serverRows.find(row=>row.type==='prd')?.id
  async function c10Read(table,fields,query){
    const reply=await fetch(api+'/rest/v1/'+table+'?select='+fields+'&'+query,{
      headers:{apikey:variables.SERVICE_ROLE_KEY,
        Authorization:'Bearer '+variables.SERVICE_ROLE_KEY},
      signal:AbortSignal.timeout(12000),
    })
    assert(reply.ok,'C-10 cannot inspect local '+table+' DB')
    return reply.json()
  }
  const c10ChatQuery='document_id=eq.'+c10DocId+'&order=created_at.asc'
  const c10BeforeRows=await c10Read('chat_messages','id,role,content',c10ChatQuery)
  const c10BeforeDoc=(await c10Read('documents','content','id=eq.'+c10DocId))[0].content
  const c10OpsQuery='document_id=eq.'+c10DocId
  const c10BeforeOps=await c10Read('document_chat_operations','id',c10OpsQuery)
  execFileSync('psql',['-X','-v','ON_ERROR_STOP=1',
    '-f',process.cwd()+'/tests/e2e/inject_chat_update_failure.sql'],{
    env:{...process.env,PGHOST:'127.0.0.1',PGPORT:dbPort,
      PGUSER:'postgres',PGPASSWORD:'postgres',PGDATABASE:'postgres',PGSSLMODE:'disable'},
    stdio:['ignore','pipe','pipe'],timeout:30000,
  })
  const c10Marker='C10-ATOMIC-FAULT-'+created.id
  const c10ChatInput=page.locator('aside textarea[placeholder*="@"]')
  const c10FailedRpc=page.waitForResponse(reply=>
    reply.url().includes('/rest/v1/rpc/commit_chat_document_edit') &&
    !reply.ok(),{timeout:25000})
  await c10ChatInput.fill(c10Marker)
  await c10ChatInput.press('Enter')
  await c10FailedRpc
  await page.getByText('채팅 요청을 문서에 반영하지 못했습니다.',{exact:false})
    .waitFor({state:'visible',timeout:15000})
  const c10RolledBack=await c10Read('chat_messages','id,role,content',c10ChatQuery)
  const c10RolledBackDoc=(await c10Read('documents','content','id=eq.'+c10DocId))[0].content
  const c10RolledBackOps=await c10Read('document_chat_operations','id',c10OpsQuery)
  assert.equal(c10RolledBack.length,c10BeforeRows.length,
    'C-10 left orphan chat INSERT after server document UPDATE fault')
  assert.equal(c10RolledBackDoc,c10BeforeDoc,'C-10 modified document despite DB rollback')
  assert.equal(c10RolledBackOps.length,c10BeforeOps.length,
    'C-10 left operation record after failed transaction')
  console.log('PASS C-10 FAULT: injected DB UPDATE failure rolls back user/assistant messages, document and request log')

  execFileSync('psql',['-X','-v','ON_ERROR_STOP=1',
    '-c','drop trigger qa_fail_chat_document_update on public.documents'],{
    env:{...process.env,PGHOST:'127.0.0.1',PGPORT:dbPort,
      PGUSER:'postgres',PGPASSWORD:'postgres',PGDATABASE:'postgres',PGSSLMODE:'disable'},
    stdio:['ignore','pipe','pipe'],timeout:30000,
  })
  // A retry with the unchanged input must reuse its original operation UUID.
  await c10ChatInput.press('Enter')
  await page.waitForFunction(marker=>
    document.querySelector('main textarea')?.value.includes(marker),
    c10Marker,{timeout:20000})
  const c10RetryRows=await c10Read('chat_messages','id,role,content',c10ChatQuery)
  const c10RetryOps=await c10Read('document_chat_operations',
    'id,input_content,user_message_id,assistant_message_id',c10OpsQuery)
  assert.equal(c10RetryRows.length,c10BeforeRows.length+2,
    'C-10 retry did not commit exactly one paired user/assistant chat')
  assert.equal(c10RetryOps.length,c10BeforeOps.length+1,
    'C-10 retry did not create exactly one request UUID')
  assert.equal(c10RetryOps.at(-1).input_content,c10Marker)
  assert.equal(c10RetryRows.filter(row=>row.content===c10Marker).length,1)
  const c10RetriedDoc=(await c10Read('documents','content','id=eq.'+c10DocId))[0].content
  assert.equal(c10RetriedDoc.split(c10Marker).length-1,1,
    'C-10 retry appended the same chat multiple times')
  console.log('PASS C-10 RETRY: one user+assistant pair, one document append, one operation')

  // Ambiguous transport: the DB commits but the first HTTP response is lost.
  // Replaying the exact UUID must return the original messages without a
  // second append or overwriting any newer durable editor revision.
  const c10AmbiguousMarker='C10-LOST-RESPONSE-'+created.id
  let c10ResponseSwallowed=0
  await page.route('**/rest/v1/rpc/commit_chat_document_edit',async route=>{
    if(c10ResponseSwallowed++===0){
      const realReply=await route.fetch()
      assert(realReply.ok(),'C-10 lost-response fixture did not commit')
      await route.fulfill({status:503,contentType:'application/json',
        body:JSON.stringify({code:'C10_LOST_RESPONSE',message:'synthetic response loss'})})
    }else await route.continue()
  })
  await c10ChatInput.fill(c10AmbiguousMarker)
  await c10ChatInput.press('Enter')
  await page.getByText('채팅 요청을 문서에 반영하지 못했습니다.',{exact:false})
    .waitFor({state:'visible',timeout:18000})
  await page.unrouteAll({behavior:'wait'})
  assert.equal(c10ResponseSwallowed,1,'C-10 did not inject ambiguous transport response')
  const c10AfterLostRows=await c10Read('chat_messages','id,role,content',c10ChatQuery)
  assert.equal(c10AfterLostRows.length,c10BeforeRows.length+4,
    'C-10 ambiguous response did not commit exactly two server rows')
  const c10AfterLostDoc=(await c10Read('documents','content','id=eq.'+c10DocId))[0].content
  assert.equal(c10AfterLostDoc.split(c10AmbiguousMarker).length-1,1)
  await c10ChatInput.press('Enter')
  await page.waitForFunction(marker=>
    document.querySelector('main textarea')?.value.includes(marker),
    c10AmbiguousMarker,{timeout:20000})
  const c10FinalRows=await c10Read('chat_messages','id,role,content',c10ChatQuery)
  const c10FinalDoc=(await c10Read('documents','content','id=eq.'+c10DocId))[0].content
  assert.equal(c10FinalRows.length,c10AfterLostRows.length,
    'C-10 ambiguous response retry duplicated chat rows')
  assert.equal(c10FinalDoc,c10AfterLostDoc,'C-10 replay duplicated or reverted document')
  console.log('PASS C-10 IDEMPOTENCY: committed-but-lost HTTP response replay does not duplicate content or chat')

  // Auth/JWT checks: SECURITY DEFINER must never make viewer, anon, or a
  // mismatching project-document pair able to alter protected data.
  const c10AuthBody={
    p_project_id:projectId,p_document_id:c10DocId,
    p_content:'C10-UNAUTHORIZED',
    p_operation_id:randomUUID(),
  }
  async function c10RpcAs(token,body){
    return fetch(api+'/rest/v1/rpc/commit_chat_document_edit',{
      method:'POST',headers:{apikey:variables.ANON_KEY,
        Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(12000),
    })
  }
  const c10Viewer=await c10RpcAs(viewerToken,c10AuthBody)
  assert(!c10Viewer.ok,'C-10 viewer could edit via SECURITY DEFINER')
  const c10Anon=await c10RpcAs(variables.ANON_KEY,c10AuthBody)
  assert(!c10Anon.ok,'C-10 anonymous could write chat document')
  const c10Cross=await c10RpcAs(userToken,{
    ...c10AuthBody,p_project_id:randomUUID(),
    p_operation_id:randomUUID(),
  })
  assert(!c10Cross.ok,'C-10 accepted mismatched document/project')
  const c10ReplayCollision=await c10RpcAs(userToken,{
    ...c10AuthBody,p_content:'C10-REUSED-UUID-CHANGED-MESSAGE',
    p_operation_id:c10RetryOps.at(-1).id,
  })
  assert(!c10ReplayCollision.ok,'C-10 replay UUID was accepted for changed content')
  assert.equal((await c10Read('chat_messages','id',c10ChatQuery)).length,
    c10FinalRows.length,'C-10 unauthorized calls wrote chat rows')
  console.log('PASS C-10 AUTHZ: viewer, anon, cross-project and altered-content UUID replay denied')

  await page.reload({waitUntil:'domcontentloaded'})
  await mainEditor.waitFor({state:'visible',timeout:20000})
  assert.equal(await mainEditor.inputValue(),c10FinalDoc,
    'C-10 atomic/retried content did not survive browser reload')
  console.log('PASS C-10 durability: final document matches local DB after full reload')

  assert.deepEqual(errors,[],'Unexpected browser runtime exception(s)')
  console.log('SUCCESS local browser smoke and B-01/B-02/C-01 document regressions on integrated PR #15')
}catch(error){
  console.error('Browser smoke failed:',error?.message ?? String(error))
  if(page){
    mkdirSync('artifacts/browser-qa',{recursive:true})
    await page.screenshot({path:'artifacts/browser-qa/smoke-failure.png',fullPage:true})
  }
  process.exitCode=1
}finally{
  if(browser)await browser.close()
}
