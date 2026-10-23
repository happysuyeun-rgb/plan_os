// psql seed runner for the disposable local stack.
// The SQL text travels over stdin, never through command-line arguments,
// so no argument can be tampered with and no PATH lookup is needed when
// an absolute executable is provided.
<<<<<<< HEAD
=======
// `runPsqlStatements` keeps the same stdin discipline for short scripts
// that do not need a return value (guards, updates, cleanup).
>>>>>>> origin/feat/planos-g1-integration-stage-a-20261021
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

<<<<<<< HEAD
=======
export function runPsqlStatements(statements, options = {}) {
  return runPsqlSeed(statements, options)
}

// Runs one read-only scalar query over stdin and returns the trimmed value.
// Used by suites that must verify the disposable stack's schema preconditions
// (for example: a table must not expose an UPDATE policy) before trusting
// their HTTP-level denials.
export function queryPsqlScalar(sql, { dbPort } = {}) {
  const out = execFileSync(resolvePsqlExecutable(), ['-X', '-t', '-A', '-q', '-v', 'ON_ERROR_STOP=1'], {
    input: String(sql).trim().replace(/;?$/, ';'),
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
    timeout: 30000,
  })
  return out.trim()
}

>>>>>>> origin/feat/planos-g1-integration-stage-a-20261021
export function runPsqlSeed(statements, { dbPort } = {}) {
  const list = Array.isArray(statements) ? statements : [String(statements)]
  const sql = list.map((statement) => statement.trim().replace(/;?$/, ';')).join('\n')
  execFileSync(resolvePsqlExecutable(), ['-X', '-v', 'ON_ERROR_STOP=1', '-q'], {
    input: sql,
    env: {
      ...process.env,
      PGHOST: '127.0.0.1',
<<<<<<< HEAD
      PGPORT: String(dbPort ?? process.env.PLANOS_LOCAL_DB_PORT ?? '55322'),
=======
      // 54322 is the stack default (and the CI runner value); local runs
      // that remap the stack port set PLANOS_LOCAL_DB_PORT explicitly.
      PGPORT: String(dbPort ?? process.env.PLANOS_LOCAL_DB_PORT ?? '54322'),
>>>>>>> origin/feat/planos-g1-integration-stage-a-20261021
      PGUSER: 'postgres',
      PGPASSWORD: 'postgres',
      PGDATABASE: 'postgres',
      PGSSLMODE: 'disable',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
  })
}
