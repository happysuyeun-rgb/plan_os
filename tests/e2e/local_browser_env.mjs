// For the disposable CI runner only. Never fetch hosted Supabase credentials.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const dir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(dir, 'Missing PLANOS_LOCAL_SUPABASE_DIR')
for (const secret of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_DB_URL']) {
  assert(!process.env[secret], 'Hosted Supabase configuration is not permitted')
}
const raw = execFileSync('supabase', ['status','-o','env'], {
  cwd: dir, encoding: 'utf8', timeout: 30000,
})
const env = Object.fromEntries(raw.split('\n').flatMap(line => {
  const m=line.match(/^([A-Z_]+)=(.*)$/)
  return m ? [[m[1],m[2].replace(/^["']|["']$/g,'')]] : []
}))
assert(env.ANON_KEY && env.SERVICE_ROLE_KEY, 'Local Supabase keys were not returned')
assert(!env.API_URL || /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(env.API_URL),
  'Remote Supabase address unexpectedly configured')
writeFileSync('.env.local',
  'VITE_SUPABASE_URL=http://127.0.0.1:54321\n'+
  'VITE_SUPABASE_ANON_KEY='+env.ANON_KEY+'\n'+
  'VITE_ENABLE_DEV_LOGIN=true\n',
  {mode:0o600},
)
console.log('Created local-only Vite configuration for disposable Supabase (keys not logged)')
