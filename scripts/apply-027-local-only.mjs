/**
 * Apply supabase/local_only/027_ai_review_jobs.sql to disposable LOCAL Postgres only.
 * Refuses non-loopback hosts and common hosted env vars.
 *
 * Security (Sonar S4036/S5443): binaries are absolute paths (or PLANOS_* overrides),
 * PATH is a fixed unwriteable set, and SQL is piped on stdin (no /tmp copies).
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const sqlPath = path.join(root, 'supabase', 'local_only', '027_ai_review_jobs.sql')
assert(existsSync(sqlPath), 'missing ' + sqlPath)
const sql = readFileSync(sqlPath, 'utf8')
assert.match(sql, /create table if not exists public\.ai_review_jobs/)
assert.match(sql, /cas_ai_review_job/)
assert.doesNotMatch(sql, /planos\.supabase\.co|amazonaws/i)

function resolveAbsoluteBin(envKey, candidates) {
  const override = process.env[envKey]
  if (override) {
    assert(path.isAbsolute(override), envKey + ' must be an absolute path')
    assert(existsSync(override), envKey + ' does not exist: ' + override)
    return override
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0]
}

const FIXED_PATH = process.platform === 'win32'
  ? 'C:\\Windows\\System32;C:\\Windows'
  : '/usr/bin:/bin'

const psqlBin = resolveAbsoluteBin(
  'PLANOS_PSQL_PATH',
  process.platform === 'win32'
    ? ['C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe', 'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe']
    : ['/usr/bin/psql', '/bin/psql'],
)

const dockerBin = resolveAbsoluteBin(
  'PLANOS_DOCKER_PATH',
  process.platform === 'win32'
    ? ['C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe', 'C:\\Program Files\\Docker\\Docker\\resources\\docker.exe']
    : ['/usr/bin/docker', '/bin/docker'],
)

function spawnTool(bin, args, opts = {}) {
  return spawnSync(bin, args, {
    encoding: 'utf8',
    env: {
      PATH: FIXED_PATH,
      PGHOST: host,
      PGPORT: String(port),
      PGUSER: process.env.PGUSER ?? 'postgres',
      PGPASSWORD: process.env.PGPASSWORD ?? 'postgres',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
      PGSSLMODE: 'disable',
      SystemRoot: process.env.SystemRoot,
      USERPROFILE: process.env.USERPROFILE,
      HOME: process.env.HOME,
    },
    ...opts,
  })
}

let result = spawnTool(psqlBin, ['-X', '-v', 'ON_ERROR_STOP=1', '-f', sqlPath])
if (result.error && result.error.code === 'ENOENT') {
  const container =
    process.env.PLANOS_LOCAL_DB_CONTAINER ?? 'supabase_db_planos-ai-review-supabase'
  console.log(`psql missing at ${psqlBin}; piping SQL via docker exec ${container}`)
  // stdin pipe — never write SQL into a world-writable container path
  result = spawnTool(
    dockerBin,
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql },
  )
}

if (result.status !== 0) {
  console.error(result.stdout)
  console.error(result.stderr || result.error)
  process.exit(result.status ?? 1)
}
console.log(`PASS applied ${sqlPath} to local-only ${host}:${port}`)
