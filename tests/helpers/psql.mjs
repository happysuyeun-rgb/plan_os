// psql seed runner for the disposable local stack.
// The SQL text travels over stdin, never through command-line arguments,
// so no argument can be tampered with and no PATH lookup is needed when
// an absolute executable is provided.
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

export function runPsqlSeed(statements, { dbPort } = {}) {
  const list = Array.isArray(statements) ? statements : [String(statements)]
  const sql = list.map((statement) => statement.trim().replace(/;?$/, ';')).join('\n')
  execFileSync(resolvePsqlExecutable(), ['-X', '-v', 'ON_ERROR_STOP=1', '-q'], {
    input: sql,
    env: {
      ...process.env,
      PGHOST: '127.0.0.1',
      PGPORT: String(dbPort ?? process.env.PLANOS_LOCAL_DB_PORT ?? '55322'),
      PGUSER: 'postgres',
      PGPASSWORD: 'postgres',
      PGDATABASE: 'postgres',
      PGSSLMODE: 'disable',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
  })
}
