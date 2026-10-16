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

  assert.deepEqual(errors,[],'Unexpected browser runtime exception(s)')
  console.log('SUCCESS local browser login/dashboard/document smoke on integrated PR #15')
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
