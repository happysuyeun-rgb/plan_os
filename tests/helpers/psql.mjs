// psql seed runner for the disposable local stack.
// The SQL text travels over stdin, never through command-line arguments,
// so no argument can be tampered with and no PATH lookup is needed when
// an absolute executable is provided.
// Falls back to `docker exec` into PLANOS_LOCAL_DB_CONTAINER when host psql
// is missing (common on Windows without Postgres client tools).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

function resolvePsqlExecutable() {
  const override = process.env.PLANOS_PSQL_PATH
  if (override) {
    assert(path.isAbsolute(override), 'PLANOS_PSQL_PATH must be absolute')
    return override
  }
  return process.platform === 'win32' ? 'psql.exe' : 'psql'
}

function dbContainer() {
  return process.env.PLANOS_LOCAL_DB_CONTAINER ?? 'supabase_db_planos-ai-review-supabase'
}

function runViaDocker(psqlArgs, sql) {
  const container = dbContainer()
  return execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', ...psqlArgs],
    {
      input: sql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    },
  )
}

function runPsql(psqlArgs, sql, { dbPort } = {}) {
  try {
    return execFileSync(resolvePsqlExecutable(), ['-X', '-v', 'ON_ERROR_STOP=1', ...psqlArgs], {
      input: sql,
      env: {
        ...process.env,
        PGHOST: '127.0.0.1',
        PGPORT: String(dbPort ?? process.env.PLANOS_LOCAL_DB_PORT ?? '54322'),
        PGUSER: 'postgres',
        PGPASSWORD: 'postgres',
        PGDATABASE: 'postgres',
        PGSSLMODE: 'disable',
      },
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
