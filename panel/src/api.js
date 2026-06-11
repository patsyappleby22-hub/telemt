const PROXY = '/proxy'

function nodeBase(nodeId) {
  return `${PROXY}/nodes/${nodeId}/api`
}

async function request(nodeId, method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== undefined) opts.body = JSON.stringify(body)

  let res
  try {
    res = await fetch(nodeBase(nodeId) + path, opts)
  } catch {
    throw new Error('Нет соединения с прокси-сервером')
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error('Нода недоступна')
  }

  let data
  try {
    data = await res.json()
  } catch {
    if (!res.ok) throw new Error(`Нода недоступна (HTTP ${res.status})`)
    throw new Error('Некорректный ответ от ноды')
  }

  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  return data
}

export function makeApi(nodeId) {
  const r = (method, path, body) => request(nodeId, method, path, body)
  return {
    health: () => r('GET', '/v1/health'),
    healthReady: () => r('GET', '/v1/health/ready'),
    systemInfo: () => r('GET', '/v1/system/info'),
    statsSummary: () => r('GET', '/v1/stats/summary'),
    statsUpstreams: () => r('GET', '/v1/stats/upstreams'),
    statsUsers: () => r('GET', '/v1/stats/users'),
    statsUsersQuota: () => r('GET', '/v1/stats/users/quota'),
    statsUsersActiveIps: () => r('GET', '/v1/stats/users/active-ips'),
    statsZeroAll: () => r('GET', '/v1/stats/zero/all'),
    statsMinimalAll: () => r('GET', '/v1/stats/minimal/all'),
    runtimeGates: () => r('GET', '/v1/runtime/gates'),
    limitsEffective: () => r('GET', '/v1/limits/effective'),
    securityPosture: () => r('GET', '/v1/security/posture'),
    securityWhitelist: () => r('GET', '/v1/security/whitelist'),
    getUser: (username) => r('GET', `/v1/users/${encodeURIComponent(username)}`),
    createUser: (data) => r('POST', '/v1/users', data),
    patchUser: (username, data) => r('PATCH', `/v1/users/${encodeURIComponent(username)}`, data),
    deleteUser: (username) => r('DELETE', `/v1/users/${encodeURIComponent(username)}`),
    enableUser: (username) => r('POST', `/v1/users/${encodeURIComponent(username)}/enable`),
    disableUser: (username) => r('POST', `/v1/users/${encodeURIComponent(username)}/disable`),
    resetQuota: (username) => r('POST', `/v1/users/${encodeURIComponent(username)}/reset-quota`),
    rotateSecret: (username, secret) => r('POST', `/v1/users/${encodeURIComponent(username)}/rotate-secret`, secret ? { secret } : {}),
  }
}

export function formatBytes(bytes) {
  if (bytes === 0 || bytes === undefined || bytes === null) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatUptime(secs) {
  if (!secs) return '0с'
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
