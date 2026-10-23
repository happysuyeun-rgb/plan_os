// Shared PostgREST helpers for the disposable-local-Supabase suites.
// URLs are built from a validated loopback origin only; every caller in
// this repository talks to the throwaway stack, never to a hosted one.
import assert from 'node:assert/strict'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertUuid(value, label) {
  assert(UUID_PATTERN.test(String(value)), `${label} must be a UUID`)
  return String(value)
}

export function loopbackUrl(apiUrl, path) {
  const base = new URL(apiUrl)
  assert(
    base.protocol === 'http:' && (base.hostname === '127.0.0.1' || base.hostname === 'localhost'),
    'Refusing non-loopback API URL: ' + apiUrl,
  )
  const url = new URL(path, base)
  assert(url.origin === base.origin, 'Refusing cross-origin request path')
  return url
}

/**
 * Returns { rest, rpc } bound to per-role bearer tokens.
 * roles: Record<string, { access_token: string }>
 */
export function createRestClient({ apiUrl, anonKey, roles }) {
  const request = async (role, method, path, body, query = '') => {
    const url = loopbackUrl(apiUrl, '/rest/v1/' + path + query)
    const response = await fetch(url, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: 'Bearer ' + roles[role].access_token,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    })
    const raw = await response.text()
    let data = null
    try { data = raw ? JSON.parse(raw) : null } catch { data = raw }
    return { status: response.status, ok: response.ok, data }
  }
  const rest = (role, method, path, body, query) => request(role, method, path, body, query)
  const rpc = (role, fn, params) => request(role, 'POST', 'rpc/' + fn, params)
  return { rest, rpc }
}

/** Service-role admin Auth calls against the same loopback origin. */
export function createAdminClient({ apiUrl, serviceKey }) {
  return async (path, method, body) => {
    const url = loopbackUrl(apiUrl, path)
    const response = await fetch(url, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    })
    const result = await response.json()
    assert(response.ok, 'admin auth operation failed HTTP ' + response.status)
    return result
  }
}
