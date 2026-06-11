import React, { useState, useEffect, useCallback } from 'react'
import {
  Users as UsersIcon, Plus, RefreshCw, Search, MoreVertical,
  Trash2, RotateCcw, Key, Power, PowerOff, Eye,
  Copy, Check, AlertTriangle, Server
} from 'lucide-react'
import { makeApi, formatBytes, formatBps } from '../api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { useNode } from '../NodeContext'

function linkServerIp(link) {
  try {
    const m = link.match(/[?&]server=([^&]+)/)
    return m ? decodeURIComponent(m[1]) : null
  } catch { return null }
}

function isInvalidLink(link) {
  const ip = linkServerIp(link)
  if (!ip) return true
  if (ip === '::' || ip === '::1' || ip === '0.0.0.0' || ip === '') return true
  return false
}

function isPrivateIp(ip) {
  if (!ip) return false
  if (/^10\./.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  if (/^127\./.test(ip)) return true
  if (/^169\.254\./.test(ip)) return true
  return false
}

function hasPrivateLinks(links) {
  return links?.some(l => isPrivateIp(linkServerIp(l)))
}

function filterValidLinks(links) {
  return (links || []).filter(l => !isInvalidLink(l))
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="text-gray-500 hover:text-gray-200 transition-colors">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

function UserActionsMenu({ user, onAction }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = React.useRef(null)

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  const actions = [
    { id: 'view', label: 'Подробнее', icon: Eye },
    { id: 'rotate', label: 'Сменить секрет', icon: Key },
    { id: 'reset-quota', label: 'Сбросить квоту', icon: RotateCcw },
    user.enabled !== false
      ? { id: 'disable', label: 'Отключить', icon: PowerOff }
      : { id: 'enable', label: 'Включить', icon: Power },
    { id: 'delete', label: 'Удалить', icon: Trash2, danger: true },
  ]
  return (
    <div>
      <button ref={btnRef} onClick={toggle} className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-dark-600 rounded transition-colors">
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 w-48 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl overflow-hidden"
            style={{ top: pos.top, right: pos.right }}>
            {actions.map(({ id, label, icon: Icon, danger }) => (
              <button key={id} onClick={() => { setOpen(false); onAction(id, user) }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${danger ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-300 hover:bg-dark-600'}`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function generateSecret() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function NodeLinksBlock({ nodeName, links }) {
  const allLinks = [
    ...filterValidLinks(links?.tls).map(l => ['TLS', l]),
    ...filterValidLinks(links?.secure).map(l => ['Secure', l]),
    ...filterValidLinks(links?.classic).map(l => ['Classic', l]),
  ]
  const allRaw = [...(links?.tls || []), ...(links?.secure || []), ...(links?.classic || [])]
  const hasPrivate = hasPrivateLinks(allRaw)
  if (allLinks.length === 0 && !hasPrivate) return null
  return (
    <div className="border border-dark-600 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-dark-700/60 border-b border-dark-600">
        <Server size={12} className="text-gray-500" />
        <span className="text-xs font-medium text-gray-300">{nodeName}</span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {hasPrivate && (
          <div className="flex items-start gap-2 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-xs text-yellow-300">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>Приватный IP — настройте <code className="font-mono">public_host</code> в config.toml</span>
          </div>
        )}
        {allLinks.map(([type, l], i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12 flex-shrink-0">{type}</span>
            <code className="flex-1 text-xs font-mono bg-dark-900 px-2 py-1.5 rounded text-gray-300 break-all">{l}</code>
            <CopyButton text={l} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateUserModal({ nodes, onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', secret: '', user_ad_tag: '', max_tcp_conns: '', data_quota_bytes: '', rate_limit_up_bps: '', rate_limit_down_bps: '', max_unique_ips: '', expiration_rfc3339: '', enabled: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)
  const toast = useToast()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.username.trim()) { setError('Введите имя пользователя'); return }
    if (nodes.length === 0) { setError('Нет доступных нод — добавьте ноду в разделе «Ноды»'); return }
    setLoading(true); setError(null)

    const sharedSecret = form.secret.trim() || generateSecret()

    const body = { username: form.username.trim(), enabled: form.enabled, secret: sharedSecret }
    if (form.user_ad_tag) body.user_ad_tag = form.user_ad_tag
    if (form.max_tcp_conns) body.max_tcp_conns = parseInt(form.max_tcp_conns)
    if (form.data_quota_bytes) body.data_quota_bytes = parseInt(form.data_quota_bytes)
    if (form.rate_limit_up_bps) body.rate_limit_up_bps = parseInt(form.rate_limit_up_bps)
    if (form.rate_limit_down_bps) body.rate_limit_down_bps = parseInt(form.rate_limit_down_bps)
    if (form.max_unique_ips) body.max_unique_ips = parseInt(form.max_unique_ips)
    if (form.expiration_rfc3339) body.expiration_rfc3339 = form.expiration_rfc3339

    // upsertUser: create fresh, or if already exists — rotate secret to match sharedSecret
    const upsertUser = async (node) => {
      const api = makeApi(node.id)
      try {
        const res = await api.createUser(body)
        return { node, data: res.data, synced: false }
      } catch (e) {
        const msg = (e.message || '').toLowerCase()
        const isExists = msg.includes('exist') || msg.includes('conflict') ||
          msg.includes('http 409') || msg.includes('http 422')
        if (!isExists) throw e
        // User already on this node — force the shared secret onto it
        await api.rotateSecret(body.username, sharedSecret)
        return { node, data: null, synced: true }
      }
    }

    const settled = await Promise.allSettled(nodes.map(upsertUser))

    const nodeResults = settled.map((r, i) => ({
      node: nodes[i],
      ok: r.status === 'fulfilled',
      data: r.status === 'fulfilled' ? r.value.data : null,
      synced: r.status === 'fulfilled' ? r.value.synced : false,
      error: r.status === 'rejected' ? r.reason?.message : null,
    }))

    const successCount = nodeResults.filter(r => r.ok).length
    if (successCount > 0) {
      // Save to panel user registry for future auto-sync on new nodes
      await fetch('/proxy/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {})
      setResults({ secret: sharedSecret, nodes: nodeResults })
      toast(`Пользователь настроен на ${successCount} из ${nodes.length} нод`, 'success')
      onCreated()
    } else {
      setError('Не удалось создать пользователя ни на одной ноде: ' + nodeResults[0]?.error)
    }
    setLoading(false)
  }

  if (results) {
    return (
      <Modal title="Пользователь создан" onClose={onClose} size="lg">
        <div className="space-y-4">
          <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-xl">
            <div className="text-sm font-medium text-green-300 mb-3">Общий секрет для всех нод — сохраните!</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-dark-900 px-3 py-2 rounded-lg text-yellow-300 border border-dark-600 break-all">{results.secret}</code>
              <CopyButton text={results.secret} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Прокси-ссылки по нодам</div>
            {results.nodes.map(({ node, ok, data, synced, error }) => {
              if (!ok) return (
                <div key={node.id} className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/30 rounded-xl text-xs text-red-300">
                  <AlertTriangle size={12} className="flex-shrink-0" />
                  <span><b>{node.name}</b>: {error}</span>
                </div>
              )
              if (synced) return (
                <div key={node.id} className="flex items-center gap-2 p-3 bg-blue-950/30 border border-blue-700/30 rounded-xl text-xs text-blue-300">
                  <Check size={12} className="flex-shrink-0 text-blue-400" />
                  <span><b>{node.name}</b> — секрет успешно обновлён</span>
                </div>
              )
              // Freshly created: data = { user: { links }, secret }
              const links = data?.user?.links ?? data?.links
              return <NodeLinksBlock key={node.id} nodeName={node.name} links={links} />
            })}
          </div>
          <button onClick={onClose} className="btn-primary w-full justify-center">Закрыть</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Создать пользователя" onClose={onClose} size="lg">
      <div className="space-y-4">
        {nodes.length > 1 && (
          <div className="flex items-center gap-2 p-3 bg-blue-950/30 border border-blue-700/30 rounded-lg text-xs text-blue-300">
            <Server size={13} className="flex-shrink-0" />
            Пользователь будет создан на всех {nodes.length} нодах с одинаковым токеном
          </div>
        )}
        {error && <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-sm text-red-300"><AlertTriangle size={14} /> {error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Имя пользователя *</label><input className="input" placeholder="alice" value={form.username} onChange={e => set('username', e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} /></div>
          <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Секрет (32 hex, пусто = авто)</label><input className="input" placeholder="авто-генерация" value={form.secret} onChange={e => set('secret', e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Max TCP соединений</label><input className="input" type="number" placeholder="не ограничено" value={form.max_tcp_conns} onChange={e => set('max_tcp_conns', e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Max уникальных IP</label><input className="input" type="number" placeholder="не ограничено" value={form.max_unique_ips} onChange={e => set('max_unique_ips', e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Квота данных (байт)</label><input className="input" type="number" placeholder="не ограничено" value={form.data_quota_bytes} onChange={e => set('data_quota_bytes', e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Срок истечения (RFC3339)</label><input className="input" placeholder="2025-12-31T23:59:59Z" value={form.expiration_rfc3339} onChange={e => set('expiration_rfc3339', e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Лимит загрузки (бит/с)</label><input className="input" type="number" placeholder="не ограничено" value={form.rate_limit_up_bps} onChange={e => set('rate_limit_up_bps', e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Лимит скачивания (бит/с)</label><input className="input" type="number" placeholder="не ограничено" value={form.rate_limit_down_bps} onChange={e => set('rate_limit_down_bps', e.target.value)} /></div>
          <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">AD-тег</label><input className="input" placeholder="опционально" value={form.user_ad_tag} onChange={e => set('user_ad_tag', e.target.value)} /></div>
          <div className="flex items-center gap-3 pt-4"><label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} className="w-4 h-4 rounded" />Активен сразу</label></div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Отмена</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Создание...' : 'Создать'}</button>
        </div>
      </div>
    </Modal>
  )
}

function UserDetailModal({ nodes, activeNode, username, onClose }) {
  const [primaryUser, setPrimaryUser] = useState(null)
  const [nodeResults, setNodeResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const settled = await Promise.allSettled(
        nodes.map(node => makeApi(node.id).getUser(username).then(r => ({ node, data: r.data })))
      )
      const results = settled.map((r, i) => ({
        node: nodes[i],
        ok: r.status === 'fulfilled',
        data: r.status === 'fulfilled' ? r.value.data : null,
        error: r.status === 'rejected' ? r.reason?.message : null,
      }))
      setNodeResults(results)
      const primary = results.find(r => r.ok && r.node.id === activeNode?.id) || results.find(r => r.ok)
      if (primary) setPrimaryUser(primary.data)
      setLoading(false)
    }
    fetchAll()
  }, [username])

  const user = primaryUser

  return (
    <Modal title={`Пользователь: ${username}`} onClose={onClose} size="xl">
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-dark-700 animate-pulse rounded" />)}</div>
      ) : user ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              ['Статус', user.enabled !== false ? <span className="badge-green">Активен</span> : <span className="badge-red">Отключён</span>],
              ['В рантайме', user.in_runtime ? <span className="badge-green">Да</span> : <span className="badge-yellow">Нет</span>],
              ['Соединений', user.current_connections],
              ['Трафик', formatBytes(user.total_octets)],
              ['Активных IP', user.active_unique_ips],
              ['Квота', user.data_quota_bytes ? formatBytes(user.data_quota_bytes) : '∞'],
              ['Лимит загр.', user.rate_limit_up_bps ? formatBps(user.rate_limit_up_bps) : '∞'],
              ['Лимит скач.', user.rate_limit_down_bps ? formatBps(user.rate_limit_down_bps) : '∞'],
              ['Max TCP', user.max_tcp_conns ?? '∞'],
              ['Max IP', user.max_unique_ips ?? '∞'],
              ['Истекает', user.expiration_rfc3339 ?? 'никогда'],
            ].map(([label, value]) => (
              <div key={label} className="p-3 bg-dark-700/60 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className="text-sm font-medium text-white">{value}</div>
              </div>
            ))}
          </div>
          {user.active_unique_ips_list?.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Активные IP</div>
              <div className="flex flex-wrap gap-2">
                {user.active_unique_ips_list.map((ip, i) => (
                  <span key={i} className="px-2 py-1 bg-dark-700 rounded text-xs font-mono text-green-300">{ip}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Прокси-ссылки по нодам
            </div>
            <div className="space-y-2">
              {nodeResults.map(({ node, ok, data, error }) => (
                ok ? (
                  <NodeLinksBlock key={node.id} nodeName={node.name} links={data?.links} />
                ) : (
                  <div key={node.id} className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/30 rounded-xl text-xs text-red-300">
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    <span><b>{node.name}</b>: {error || 'нода недоступна'}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600">Ошибка загрузки</div>
      )}
    </Modal>
  )
}

function RotateSecretModal({ nodes, username, onClose, onDone }) {
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const toast = useToast()

  const submit = async () => {
    setLoading(true); setError(null)
    try {
      const newSecret = secret.trim() || generateSecret()
      // Rotate on all nodes with the same new secret
      const settled = await Promise.allSettled(
        nodes.map(node => makeApi(node.id).rotateSecret(username, newSecret))
      )
      const ok = settled.filter(r => r.status === 'fulfilled').length
      if (ok === 0) throw new Error('Ни одна нода не ответила')
      // Update registry
      await fetch('/proxy/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, secret: newSecret }),
      }).catch(() => {})
      setResult({ secret: newSecret, ok, total: nodes.length })
      toast(`Секрет обновлён на ${ok}/${nodes.length} нодах`, ok === nodes.length ? 'success' : 'warning')
      onDone()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  if (result) {
    return (
      <Modal title="Секрет обновлён" onClose={onClose}>
        <div className="space-y-4">
          <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-xl">
            <div className="text-sm font-medium text-green-300 mb-3">
              Новый секрет <b>{username}</b> — обновлён на {result.ok}/{result.total} нодах:
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-dark-900 px-3 py-2 rounded-lg text-yellow-300 border border-dark-600 break-all">{result.secret}</code>
              <CopyButton text={result.secret} />
            </div>
          </div>
          <button onClick={onClose} className="btn-primary w-full justify-center">Закрыть</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Сменить секрет: ${username}`} onClose={onClose}>
      <div className="space-y-4">
        {nodes.length > 1 && (
          <div className="flex items-center gap-2 p-3 bg-blue-950/30 border border-blue-700/30 rounded-lg text-xs text-blue-300">
            <Server size={13} className="flex-shrink-0" />
            Новый секрет будет установлен на всех {nodes.length} нодах
          </div>
        )}
        {error && <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-sm text-red-300"><AlertTriangle size={14} /> {error}</div>}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Новый секрет (32 hex, пусто = авто)</label>
          <input className="input" placeholder="авто-генерация" value={secret} onChange={e => setSecret(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Отмена</button>
          <button onClick={submit} disabled={loading} className="btn-warning flex-1 justify-center">{loading ? 'Смена...' : 'Сменить'}</button>
        </div>
      </div>
    </Modal>
  )
}

function ConfirmModal({ title, message, onConfirm, onClose, danger }) {
  const [loading, setLoading] = useState(false)
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-300">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Отмена</button>
          <button onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }} disabled={loading}
            className={`flex-1 justify-center ${danger ? 'btn-danger' : 'btn-primary'}`}>
            {loading ? 'Подождите...' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Users() {
  const { activeNode, nodes } = useNode()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const toast = useToast()

  const api = activeNode ? makeApi(activeNode.id) : null

  const load = useCallback(async (showRefresh = false) => {
    if (!api) { setLoading(false); return }
    if (showRefresh) setRefreshing(true)
    try {
      const res = await api.statsUsers()
      setUsers(Array.isArray(res.data) ? res.data : (res.data?.users || []))
    } catch (e) {
      if (showRefresh) toast('Ошибка загрузки: ' + e.message, 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeNode?.id])

  useEffect(() => { setLoading(true); setUsers([]); load() }, [activeNode?.id])
  useEffect(() => { const t = setInterval(() => load(false), 15000); return () => clearInterval(t) }, [load])

  if (!activeNode) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-center">
        <Server size={48} className="text-gray-700 mb-4" />
        <div className="text-gray-400 font-medium">Нода не выбрана</div>
        <div className="text-sm text-gray-600 mt-1">Добавьте и выберите ноду в разделе «Ноды»</div>
      </div>
    )
  }

  const allNodes = nodes

  const runOnAllNodes = (fn) => Promise.allSettled(allNodes.map(n => fn(makeApi(n.id))))

  const handleAction = async (action, user) => {
    if (action === 'view') { setModal({ type: 'view', username: user.username }) }
    else if (action === 'rotate') { setModal({ type: 'rotate', username: user.username }) }
    else if (action === 'delete') {
      setModal({ type: 'confirm', title: 'Удалить пользователя?', message: `Удалить "${user.username}" со всех нод? Это действие необратимо.`, danger: true,
        onConfirm: async () => {
          try {
            await runOnAllNodes(a => a.deleteUser(user.username))
            await fetch(`/proxy/users/${encodeURIComponent(user.username)}`, { method: 'DELETE' }).catch(() => {})
            toast(`"${user.username}" удалён со всех нод`, 'success')
            setModal(null); load()
          } catch (e) { toast('Ошибка: ' + e.message, 'error') }
        }
      })
    } else if (action === 'disable') {
      setModal({ type: 'confirm', title: 'Отключить?', message: `Отключить "${user.username}" на всех нодах?`, danger: false,
        onConfirm: async () => {
          try {
            await runOnAllNodes(a => a.disableUser(user.username))
            toast(`"${user.username}" отключён на всех нодах`, 'success')
            setModal(null); load()
          } catch (e) { toast('Ошибка: ' + e.message, 'error') }
        }
      })
    } else if (action === 'enable') {
      try {
        await runOnAllNodes(a => a.enableUser(user.username))
        toast(`"${user.username}" активирован на всех нодах`, 'success')
        load()
      } catch (e) { toast('Ошибка: ' + e.message, 'error') }
    } else if (action === 'reset-quota') {
      setModal({ type: 'confirm', title: 'Сбросить квоту?', message: `Сбросить данные для "${user.username}" на всех нодах?`, danger: false,
        onConfirm: async () => {
          try {
            await runOnAllNodes(a => a.resetQuota(user.username))
            toast(`Квота "${user.username}" сброшена на всех нодах`, 'success')
            setModal(null); load()
          } catch (e) { toast('Ошибка: ' + e.message, 'error') }
        }
      })
    }
  }

  const filtered = users.filter(u => u.username?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Пользователи</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeNode.name} · {users.length} пользователей{nodes.length > 1 ? ` · ${nodes.length} нод` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="btn-ghost">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {nodes.length > 0 && (
            <button onClick={async () => {
              try {
                const r = await fetch('/proxy/sync', { method: 'POST' })
                const d = await r.json()
                if (d.ok) {
                  const total = d.results?.reduce((s, n) => s + n.updated + n.created, 0) ?? 0
                  toast(`Синхронизировано: ${total} пользователей обновлено`, 'success')
                  load()
                }
              } catch { toast('Ошибка синхронизации', 'error') }
            }} className="btn-ghost text-xs gap-1.5" title="Применить секреты из реестра ко всем нодам">
              <Key size={13} />Синхронизировать
            </button>
          )}
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary">
            <Plus size={15} />Добавить
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input className="input pl-9" placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-dark-700 animate-pulse rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <UsersIcon size={40} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm">{users.length === 0 ? 'Нет пользователей. Создайте первого!' : 'Ничего не найдено'}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-dark-600 bg-dark-800/50">
                  <th className="px-4 py-3 font-medium">Пользователь</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Соед.</th>
                  <th className="px-4 py-3 font-medium">Уник. IP</th>
                  <th className="px-4 py-3 font-medium">Трафик</th>
                  <th className="px-4 py-3 font-medium">Квота</th>
                  <th className="px-4 py-3 font-medium">Скорость ↑/↓</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filtered.map((user) => (
                  <tr key={user.username} className="table-row-hover">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm font-medium text-white">{user.username}</div>
                      {user.expiration_rfc3339 && <div className="text-xs text-gray-500 mt-0.5">до {user.expiration_rfc3339?.slice(0, 10)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {user.enabled !== false ? <span className="badge-green">Активен</span> : <span className="badge-red">Откл.</span>}
                        {!user.in_runtime && <span className="badge-yellow">вне runtime</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{user.current_connections ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{user.active_unique_ips ?? 0}{user.max_unique_ips ? `/${user.max_unique_ips}` : ''}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{formatBytes(user.total_octets)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{user.data_quota_bytes ? formatBytes(user.data_quota_bytes) : '∞'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {user.rate_limit_up_bps || user.rate_limit_down_bps ? `${formatBps(user.rate_limit_up_bps)} / ${formatBps(user.rate_limit_down_bps)}` : '∞'}
                    </td>
                    <td className="px-4 py-3"><UserActionsMenu user={user} onAction={handleAction} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === 'create' && <CreateUserModal nodes={nodes} onClose={() => setModal(null)} onCreated={load} />}
      {modal?.type === 'view' && <UserDetailModal nodes={nodes} activeNode={activeNode} username={modal.username} onClose={() => setModal(null)} />}
      {modal?.type === 'rotate' && <RotateSecretModal nodes={nodes} username={modal.username} onClose={() => setModal(null)} onDone={load} />}
      {modal?.type === 'confirm' && <ConfirmModal title={modal.title} message={modal.message} danger={modal.danger} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
    </div>
  )
}
