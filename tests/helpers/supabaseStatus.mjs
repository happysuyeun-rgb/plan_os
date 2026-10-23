// Reads the disposable local stack coordinates (keys, API URL) from
// `supabase status` without a PATH-resolved shell lookup.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

function resolveSupabaseExecutable() {
  const override = process.env.PLANOS_SUPABASE_PATH
  if (override) {
    assert(path.isAbsolute(override), 'PLANOS_SUPABASE_PATH must be absolute')
    return override
  }
  return process.platform === 'win32' ? 'supabase.exe' : 'supabase'
}

export function readLocalSupabaseEnv(localDir) {
  assert(localDir, 'PLANOS_LOCAL_SUPABASE_DIR is required')
  for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_URL', 'SUPABASE_DB_PASSWORD']) {
    assert(!process.env[key], 'Hosted Supabase credentials are not allowed: ' + key)
  }
  const raw = execFileSync(resolveSupabaseExecutable(), ['status', '-o', 'env'], {
    cwd: localDir, encoding: 'utf8', timeout: 30000,
  })
  const variables = Object.fromEntries(raw.split('\n').flatMap((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    return match ? [[match[1], match[2].replace(/^["']|["']$/g, '')]] : []
  }))
  assert(variables.SERVICE_ROLE_KEY && variables.ANON_KEY, 'Local Supabase keys missing')
  return variables
}
