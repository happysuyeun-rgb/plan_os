/**
 * Apply supabase/local_only/027_ai_review_jobs.sql to disposable LOCAL Postgres only.
 * Refuses non-loopback hosts and common hosted env vars.
 * Uses host `psql` when available; otherwise docker exec into PLANOS_LOCAL_DB_CONTAINER.
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

for (const name of [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_URL',
  'SUPABASE_DB_PASSWORD',
  'DATABASE_URL',
]) {
  if (process.env[name]) {
    console.error(`Refusing: hosted credential env ${name} is set`)
    process.exit(2)
  }
}

const host = process.env.PGHOST ?? '127.0.0.1'
const port = process.env.PGPORT ?? process.env.PLANOS_LOCAL_DB_PORT ?? '54322'
assert(
  host === '127.0.0.1' || host === 'localhost',
  `Refusing non-loopback PGHOST=${host}`,
)

const sqlPath = 'supabase/local_only/027_ai_review_jobs.sql'
assert(existsSync(sqlPath), 'missing ' + sqlPath)
const sql = readFileSync(sqlPath, 'utf8')
assert.match(sql, /create table if not exists public\.ai_review_jobs/)
assert.match(sql, /cas_ai_review_job/)
assert.doesNotMatch(sql, /planos\.supabase\.co|amazonaws/i)

function runPsql(args, opts = {}) {
  return spawnSync('psql', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: host,
      PGPORT: String(port),
      PGUSER: process.env.PGUSER ?? 'postgres',
      PGPASSWORD: process.env.PGPASSWORD ?? 'postgres',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
      PGSSLMODE: 'disable',
    },
    ...opts,
  })
}

let result = runPsql(['-X', '-v', 'ON_ERROR_STOP=1', '-f', sqlPath])
if (result.error && result.error.code === 'ENOENT') {
  const container =
    process.env.PLANOS_LOCAL_DB_CONTAINER ?? 'supabase_db_planos-ai-review-supabase'
  console.log(`psql not on PATH; using docker exec ${container}`)
  const cp = spawnSync('docker', ['cp', sqlPath, `${container}:/tmp/027_ai_review_jobs.sql`], {
    encoding: 'utf8',
  })
  if (cp.status !== 0) {
    console.error(cp.stderr)
    process.exit(cp.status ?? 1)
  }
  result = spawnSync(
    'docker',
    ['exec', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/027_ai_review_jobs.sql'],
    { encoding: 'utf8' },
  )
}

if (result.status !== 0) {
  console.error(result.stdout)
  console.error(result.stderr)
  process.exit(result.status ?? 1)
}
console.log(`PASS applied ${sqlPath} to local-only ${host}:${port}`)
