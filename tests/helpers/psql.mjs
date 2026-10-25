// psql seed runner for the disposable local stack.
// The SQL text travels over stdin, never through command-line arguments.
// Binaries resolve to absolute paths (PLANOS_* overrides or fixed candidates)
// and PATH is limited to fixed unwriteable directories (Sonar S4036).
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const FIXED_PATH = process.platform === 'win32'
  ? 'C:\\Windows\\System32;C:\\Windows'
  : '/usr/bin:/bin'

function resolveAbsoluteBin(envKey, candidates) {
  const override = process.env[envKey]
  if (override) {
    assert(path.isAbsolute(override), envKey + ' must be absolute')
    assert(existsSync(override), envKey + ' does not exist: ' + override)
    return override
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0]
}

function resolvePsqlExecutable() {
  return resolveAbsoluteBin(
    'PLANOS_PSQL_PATH',
    process.platform === 'win32'
      ? ['C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe', 'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe']
      : ['/usr/bin/psql', '/bin/psql'],
  )
}

function resolveDockerExecutable() {
  return resolveAbsoluteBin(
    'PLANOS_DOCKER_PATH',
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
          'C:\\Program Files\\Docker\\Docker\\resources\\docker.exe',
        ]
      : ['/usr/bin/docker', '/bin/docker'],
  )
}

function dbContainer() {
  return process.env.PLANOS_LOCAL_DB_CONTAINER ?? 'supabase_db_planos-ai-review-supabase'
}

function pgEnv(dbPort) {
  return {
    PATH: FIXED_PATH,
    PGHOST: '127.0.0.1',
    PGPORT: String(dbPort ?? process.env.PLANOS_LOCAL_DB_PORT ?? '54322'),
    PGUSER: 'postgres',
    PGPASSWORD: 'postgres',
    PGDATABASE: 'postgres',
    PGSSLMODE: 'disable',
    SystemRoot: process.env.SystemRoot,
    USERPROFILE: process.env.USERPROFILE,
    HOME: process.env.HOME,
  }
}

function runViaDocker(psqlArgs, sql) {
  const container = dbContainer()
  return execFileSync(
    resolveDockerExecutable(),
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', ...psqlArgs],
    {
      input: sql,
      encoding: 'utf8',
      env: pgEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    },
  )
}

function runPsql(psqlArgs, sql, { dbPort } = {}) {
  try {
    return execFileSync(resolvePsqlExecutable(), ['-X', '-v', 'ON_ERROR_STOP=1', ...psqlArgs], {
      input: sql,
      env: pgEnv(dbPort),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    })
  } catch (err) {
    if (err?.code !== 'ENOENT' && err?.error?.code !== 'ENOENT') throw err
    return runViaDocker(psqlArgs, sql)
  }
}

export function runPsqlStatements(statements, options = {}) {
  return runPsqlSeed(statements, options)
}

// Runs one read-only scalar query over stdin and returns the trimmed value.
// Used by suites that must verify the disposable stack's schema preconditions
// (for example: a table must not expose an UPDATE policy) before trusting
// their HTTP-level denials.
export function queryPsqlScalar(sql, { dbPort } = {}) {
  const out = runPsql(['-t', '-A', '-q'], String(sql).trim().replace(/;?$/, ';'), { dbPort })
  return out.trim()
}

export function runPsqlSeed(statements, { dbPort } = {}) {
  const list = Array.isArray(statements) ? statements : [String(statements)]
  const sql = list.map((statement) => statement.trim().replace(/;?$/, ';')).join('\n')
  runPsql(['-q'], sql, { dbPort })
}
