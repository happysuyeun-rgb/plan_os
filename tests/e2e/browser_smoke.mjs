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
assert(!variables.API_URL || /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(variables.API_URL))

const api='http://127.0.0.1:54321'
const site='http://127.0.0.1:5173'
const loginEmail='browser-smoke@example.test'
const loginPassword='Synthetic-browser-smoke-password-123!'
const projectId='77777777-7777-4777-8777-777777777777'

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
  '-f',process.cwd()+'/tests/e2e/seed_browser.sql',
],{
  env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'54322',
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

  // FAULT-01: Deliberately fail the second client-side REST write in a
  // restore. This reproducer MUST show how old code can leave a phantom
  // version when the version INSERT succeeded but document PATCH failed.
  // This is disposable local-browser synthetic data ONLY.
  await page.getByRole('button',{name:/^v2 \(B05-current\)$/}).first().click()
  await page.waitForFunction(expected=>
    document.querySelector('main textarea')?.value===expected,beforeRestore,{timeout:12000})
  let injectedFailures=0
  const simulateDocumentOutage=async route=>{
    if(route.request().method()==='PATCH' && injectedFailures++===0){
      await route.fulfill({
        status:503,contentType:'application/json',
        body:JSON.stringify({code:'LOCAL_SYNTHETIC_DB_OUTAGE',message:'Synthetic second-write failure'}),
      })
    }else{
      await route.continue()
    }
  }
  await page.route('**/rest/v1/documents?*',simulateDocumentOutage)
  const outageResponse=page.waitForResponse(response=>
    response.request().method()==='PATCH' &&
    response.url().includes('/rest/v1/documents') &&
    response.status()===503,{timeout:20000})
  const expectedErrorStart=errors.length
  await page.getByRole('button',{name:'이 버전으로 복원'}).click()
  await page.getByRole('dialog').getByRole('button',{name:'확인'}).click()
  await outageResponse
  await page.unroute('**/rest/v1/documents?*',simulateDocumentOutage)
  await page.waitForTimeout(600)
  assert.equal(injectedFailures,1,'Synthetic document failure was not injected exactly once')

  const brokenRowsResponse=await fetch(
    api+'/rest/v1/document_versions?select=version_number,content&document_id=eq.'+
    serverRows.find(row=>row.type==='prd')?.id+'&order=version_number.asc',{
      headers:{apikey:variables.SERVICE_ROLE_KEY,Authorization:'Bearer '+variables.SERVICE_ROLE_KEY},
      signal:AbortSignal.timeout(12000),
    })
  assert(brokenRowsResponse.ok)
  const brokenRows=await brokenRowsResponse.json()
  const inconsistentResponse=await fetch(
    api+'/rest/v1/documents?select=content&type=eq.prd&project_id=eq.'+projectId,{
      headers:{apikey:variables.SERVICE_ROLE_KEY,Authorization:'Bearer '+variables.SERVICE_ROLE_KEY},
      signal:AbortSignal.timeout(12000),
    })
  assert(inconsistentResponse.ok)
  const oldContent=(await inconsistentResponse.json())[0].content
  assert.equal(brokenRows.length,4,'Expected the uncommitted phantom restore snapshot in legacy flow')
  assert.equal(brokenRows[3].content,beforeRestore,'Legacy INSERT created wrong phantom target')
  assert.equal(oldContent,merged,'The rejected document UPDATE must not change current document')
  console.log('REPRODUCED FAULT-01: phantom restored version inserted even though document UPDATE failed')
  // The client currently throws on the deliberately injected 503. Remove
  // only the synthetic error from the runtime-error report for this negative test.
  const injectedErrors=errors.splice(expectedErrorStart)
  console.log('FAULT-01 expected client exception count:',injectedErrors.length)

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
