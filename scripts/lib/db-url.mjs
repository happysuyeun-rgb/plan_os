import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

export function readEnvLocal() {
  const env = {}
  const content = readFileSync(join(root, '.env.local'), 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return env
}

export function normalizeDbUrl(raw) {
  const prefix = 'postgresql://'
  if (!raw.startsWith(prefix)) return raw

  const rest = raw.slice(prefix.length)
  const atIndex = rest.lastIndexOf('@')
  if (atIndex === -1) return raw

  const userPass = rest.slice(0, atIndex)
  const hostPart = rest.slice(atIndex + 1)
  const colonIndex = userPass.indexOf(':')
  if (colonIndex === -1) return raw

  const user = userPass.slice(0, colonIndex)
  let password = userPass.slice(colonIndex + 1)
  if (password.startsWith('[') && password.endsWith(']')) {
    password = password.slice(1, -1)
  }

  return `${prefix}${user}:${encodeURIComponent(password)}@${hostPart}`
}

function parseDbUrl(url) {
  const match = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^/]+)\/(.+)$/)
  if (!match) return null
  const [, user, password, host, database] = match
  const directMatch = host.match(/^db\.([^.]+)\.supabase\.co(?::(\d+))?$/)
  const poolerMatch = host.match(/^(aws-\d+)-([^.]+)\.pooler\.supabase\.com(?::(\d+))?$/)
  return { user, password, host, database, directMatch, poolerMatch }
}

function buildPoolerUrl({ user, password, projectRef, poolerPrefix, region, port, database }) {
  const poolerUser = user === 'postgres' ? `postgres.${projectRef}` : user
  return `postgresql://${poolerUser}:${password}@${poolerPrefix}-${region}.pooler.supabase.com:${port}/${database}`
}

function canConnect(url) {
  const result = spawnSync(
    'npx',
    ['supabase', 'db', 'push', '--db-url', url, '--dry-run', '--yes'],
    { cwd: root, encoding: 'utf8', shell: true },
  )
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return (
    !output.includes('failed to connect') &&
    !output.includes('Tenant or user not found') &&
    !output.includes('tenant/user') &&
    !output.includes('invalid userinfo')
  )
}

export function resolveDbUrl(raw) {
  const normalized = normalizeDbUrl(raw)
  const parsed = parseDbUrl(normalized)
  if (!parsed) return normalized

  const { user, password, host, database, directMatch, poolerMatch } = parsed

  if (poolerMatch && user.includes('.')) {
    return normalized
  }

  const projectRef = directMatch?.[1] ?? user.split('.').pop()
  const port = directMatch?.[2] ?? poolerMatch?.[3] ?? '5432'

  const poolerPrefixes = ['aws-1', 'aws-0']
  const regions = [
    'ap-southeast-1',
    'ap-northeast-2',
    'ap-northeast-1',
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'eu-west-1',
    'eu-central-1',
    'ap-south-1',
    'sa-east-1',
  ]

  for (const poolerPrefix of poolerPrefixes) {
    for (const region of regions) {
      const candidate = buildPoolerUrl({
        user,
        password,
        projectRef,
        poolerPrefix,
        region,
        port,
        database,
      })
      if (canConnect(candidate)) return candidate
    }
  }

  return normalized
}
