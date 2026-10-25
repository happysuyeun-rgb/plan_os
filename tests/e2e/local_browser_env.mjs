// For the disposable CI runner only. Never fetch hosted Supabase credentials.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { readLocalSupabaseEnv } from '../helpers/supabaseStatus.mjs'

const dir = process.env.PLANOS_LOCAL_SUPABASE_DIR
assert(dir, 'Missing PLANOS_LOCAL_SUPABASE_DIR')
const env = readLocalSupabaseEnv(dir)
// Defaults match CI; local runs may override when 54321 is already taken.
const apiUrl = process.env.PLANOS_LOCAL_API_URL ?? 'http://127.0.0.1:54321'
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(apiUrl), 'Local API URL must be loopback')
assert(!env.API_URL || env.API_URL === apiUrl,
  'Remote Supabase address unexpectedly configured')
// Disposable CI fixes server store + 027; app default remains browser when unset.
const storeMode = process.env.VITE_AI_REVIEW_STORE || 'server'
assert(
  storeMode === 'server' || storeMode === 'browser',
  'VITE_AI_REVIEW_STORE must be server|browser',
)
// Server review jobs FK-link linked_task_id → project_tasks; local prototype IDs break accept.
const serverTasks =
  process.env.VITE_S1_SERVER_TASKS ||
  (storeMode === 'server' ? 'true' : 'false')
writeFileSync('.env.local',
  'VITE_SUPABASE_URL=' + apiUrl + '\n' +
  'VITE_SUPABASE_ANON_KEY=' + env.ANON_KEY + '\n' +
  'VITE_ENABLE_DEV_LOGIN=true\n' +
  'VITE_AI_REVIEW_STORE=' + storeMode + '\n' +
  'VITE_S1_SERVER_TASKS=' + serverTasks + '\n',
  { mode: 0o600 },
)
console.log(
  'Created local-only Vite configuration for disposable Supabase (keys not logged); store=' +
    storeMode +
    ' s1=' +
    serverTasks,
)
