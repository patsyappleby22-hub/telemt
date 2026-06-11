const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== undefined) opts.body = JSON.stringify(body)

  let res
  try {
    res = await fetch(BASE + path, opts)
  } catch {
    throw new Error('Сервер недоступен')
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error('Сервер telemt не запущен')
  }

  let data
  try {
    data = await res.json()
  } catch {
    if (!res.ok) throw new Error(`Сервер недоступен (HTTP ${res.status})`)
    throw new Error('Некорректный ответ от сервера')
  }

  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  return data
}

export const api = {
  health: () => request('GET', '/v1/health'),
  healthReady: () => request('GET', '/v1/health/ready'),
  systemInfo: () => request('GET', '/v1/system/info'),
  statsSummary: () => request('GET', '/v1/stats/summary'),
  statsUpstreams: () => request('GET', '/v1/stats/upstreams'),
  statsUsers: () => request('GET', '/v1/stats/users'),
  statsUsersQuota: () => request('GET', '/v1/stats/users/quota'),
  statsUsersActiveIps: () => request('GET', '/v1/stats/users/active-ips'),
  statsZeroAll: () => request('GET', '/v1/stats/zero/all'),
  statsMinimalAll: () => request('GET', '/v1/stats/minimal/all'),
  runtimeGates: () => request('GET', '/v1/runtime/gates'),
  limitsEffective: () => request('GET', '/v1/limits/effective'),
  securityPosture: () => request('GET', '/v1/security/posture'),
  securityWhitelist: () => request('GET', '/v1/security/whitelist'),

  getUser: (username) => request('GET', `/v1/users/${encodeURIComponent(username)}`),
  createUser: (data) => request('POST', '/v1/users', data),
  patchUser: (username, data) => request('PATCH', `/v1/users/${encodeURIComponent(username)}`, data),
  deleteUser: (username) => request('DELETE', `/v1/users/${encodeURIComponent(username)}`),
  enableUser: (username) => request('POST', `/v1/users/${encodeURIComponent(username)}/enable`),
  disableUser: (username) => request('POST', `/v1/users/${encodeURIComponent(username)}/disable`),
  resetQuota: (username) => request('POST', `/v1/users/${encodeURIComponent(username)}/reset-quota`),
  rotateSecret: (username, secret) => request('POST', `/v1/users/${encodeURIComponent(username)}/rotate-secret`, secret ? { secret } : {}),
}

export function formatBytes(bytes) {
  if (bytes === 0 || bytes === undefined || bytes === null) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatUptime(secs) {
  if (!secs) return '0s'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  const parts = []
  if (d > 0) parts.push(`${d}д`)
  if (h > 0) parts.push(`${h}ч`)
  if (m > 0) parts.push(`${m}м`)
  if (s > 0 || parts.length === 0) parts.push(`${s}с`)
  return parts.join(' ')
}

export function formatBps(bps) {
  if (!bps) return '—'
  if (bps < 1024) return bps + ' б/с'
  if (bps < 1048576) return (bps / 1024).toFixed(1) + ' КБ/с'
  return (bps / 1048576).toFixed(1) + ' МБ/с'
}
