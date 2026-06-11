import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Bot, Users, CreditCard, Settings, Plus, Trash2, Edit2, Check, X,
  TrendingUp, UserCheck, DollarSign, RefreshCw, Copy, Key,
  ToggleLeft, ToggleRight, Search, Server, Power, PowerOff,
  RotateCcw, Eye, AlertTriangle, MoreVertical
} from 'lucide-react'
import { makeApi, formatBytes, formatBps } from '../api'
import { useNode } from '../NodeContext'
import { useToast } from '../components/Toast'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'

const API = '/proxy/bot'

async function apiFetch(path, opts = {}) {
  const r = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText)
  return r.json()
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="text-gray-500 hover:text-gray-200 transition-colors flex-shrink-0">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

// ─── Subscription Status Badge ────────────────────────────────────────────────
function SubBadge({ active, until }) {
  if (!until) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-600/20 text-gray-400">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />Нет
    </span>
  )
  if (active) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Активна
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Истекла
    </span>
  )
}

// ─── Proxy Links Block ────────────────────────────────────────────────────────
function filterValidLinks(links) {
  return (links || []).filter(l => {
    try {
      const m = l.match(/[?&]server=([^&]+)/)
      const ip = m ? decodeURIComponent(m[1]) : null
      if (!ip || ip === '::' || ip === '::1' || ip === '0.0.0.0' || ip === '') return false
      return true
    } catch { return false }
  })
}

function NodeLinksBlock({ nodeName, links }) {
  const tls = filterValidLinks(links?.tls)
  const secure = filterValidLinks(links?.secure)
  const classic = filterValidLinks(links?.classic)
  const all = [
    ...tls.map(l => ['TLS', l]),
    ...secure.map(l => ['Secure', l]),
    ...classic.map(l => ['Classic', l]),
  ]
  if (all.length === 0) return null
  return (
    <div className="border border-dark-600 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-dark-700/60 border-b border-dark-600">
        <Server size={12} className="text-gray-500" />
        <span className="text-xs font-medium text-gray-300">{nodeName}</span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {all.map(([type, l], i) => (
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

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onClose, danger }) {
  const [loading, setLoading] = useState(false)
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-300">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm rounded-lg transition-colors">
            Отмена
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }}
            disabled={loading}
            className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {loading ? 'Подождите...' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Proxy Detail Modal ───────────────────────────────────────────────────────
function ProxyDetailModal({ nodes, username, onClose }) {
  const [nodeResults, setNodeResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const fetchAll = async () => {
      const settled = await Promise.allSettled(
        nodes.map(n => makeApi(n.id).getUser(username).then(r => ({ node: n, data: r })))
      )
      const results = settled.map((r, i) => ({
        node: nodes[i],
        ok: r.status === 'fulfilled',
        data: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason?.message : null,
      }))
      setNodeResults(results)
      const primary = results.find(r => r.ok)
      if (primary) {
        const d = primary.data
        setUser(d?.data?.user ?? d?.data ?? d?.user ?? d)
      }
      setLoading(false)
    }
    fetchAll()
  }, [username])

  return (
    <Modal title={`Прокси: ${username}`} onClose={onClose} size="lg">
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-dark-700 animate-pulse rounded" />)}</div>
      ) : user ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Статус', user.enabled !== false
                ? <span className="text-green-400 font-medium">Активен</span>
                : <span className="text-red-400 font-medium">Отключён</span>],
              ['Соединений', user.current_connections ?? 0],
              ['Трафик', formatBytes(user.total_octets)],
              ['Активных IP', user.active_unique_ips ?? 0],
              ['Квота', user.data_quota_bytes ? formatBytes(user.data_quota_bytes) : '∞'],
              ['Истекает', user.expiration_rfc3339 ? user.expiration_rfc3339.slice(0, 10) : 'никогда'],
            ].map(([label, value]) => (
              <div key={label} className="p-3 bg-dark-700/60 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className="text-sm font-medium text-white">{value}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Прокси-ссылки по нодам</div>
            <div className="space-y-2">
              {nodeResults.filter(r => r.ok).map(({ node, data }) => {
                const links = data?.data?.user?.links ?? data?.data?.links ?? data?.user?.links ?? data?.links
                return <NodeLinksBlock key={node.id} nodeName={node.name} links={links} />
              })}
              {nodeResults.filter(r => !r.ok).map(({ node, error }) => (
                <div key={node.id} className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/30 rounded-xl text-xs text-red-300">
                  <AlertTriangle size={12} className="flex-shrink-0" />
                  <span><b>{node.name}</b>: {error || 'нода недоступна'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 text-sm">Пользователь не найден ни на одной ноде</div>
      )}
    </Modal>
  )
}

// ─── Rotate Secret Modal ──────────────────────────────────────────────────────
function RotateModal({ nodes, proxyUsername, onClose, onDone, addToast }) {
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const submit = async () => {
    setLoading(true); setError(null)
    try {
      const newSecret = secret.trim() ||
        Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
      const settled = await Promise.allSettled(nodes.map(n => makeApi(n.id).rotateSecret(proxyUsername, newSecret)))
      const ok = settled.filter(r => r.status === 'fulfilled').length
      if (ok === 0) throw new Error('Ни одна нода не ответила')
      await fetch('/proxy/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: proxyUsername, secret: newSecret })
      }).catch(() => {})
      setResult({ secret: newSecret, ok, total: nodes.length })
      addToast(`Секрет обновлён на ${ok}/${nodes.length} нодах`, ok === nodes.length ? 'success' : 'warning')
      onDone()
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  if (result) return (
    <Modal title="Секрет обновлён" onClose={onClose}>
      <div className="space-y-4">
        <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-xl">
          <div className="text-sm font-medium text-green-300 mb-2">
            Обновлён на {result.ok}/{result.total} нодах:
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm bg-dark-900 px-3 py-2 rounded-lg text-yellow-300 border border-dark-600 break-all">{result.secret}</code>
            <CopyButton text={result.secret} />
          </div>
        </div>
        <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg transition-colors">
          Закрыть
        </button>
      </div>
    </Modal>
  )

  return (
    <Modal title={`Сменить секрет: ${proxyUsername}`} onClose={onClose}>
      <div className="space-y-4">
        {nodes.length > 1 && (
          <div className="flex items-center gap-2 p-3 bg-blue-950/30 border border-blue-700/30 rounded-lg text-xs text-blue-300">
            <Server size={13} className="flex-shrink-0" />
            Новый секрет будет установлен на всех {nodes.length} нодах
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-sm text-red-300">
            <AlertTriangle size={14} /> {error}
          </div>
        )}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Новый секрет (32 hex, пусто = авто)</label>
          <input
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm font-mono"
            placeholder="авто-генерация"
            value={secret}
            onChange={e => setSecret(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm py-2 rounded-lg transition-colors">
            Отмена
          </button>
          <button onClick={submit} disabled={loading} className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors">
            {loading ? 'Смена...' : 'Сменить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Activate Subscription Modal ──────────────────────────────────────────────
function ActivateModal({ user, plans, onClose, onDone, addToast }) {
  const [selectedPlan, setSelectedPlan] = useState(plans.filter(p => p.enabled)[0]?.id || '')
  const [loading, setLoading] = useState(false)

  const activate = async () => {
    if (!selectedPlan) return
    setLoading(true)
    try {
      await apiFetch(`/users/${user.telegram_id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ plan_id: selectedPlan })
      })
      addToast('Подписка активирована', 'success')
      onDone(); onClose()
    } catch (e) { addToast(e.message, 'error') }
    setLoading(false)
  }

  return (
    <Modal onClose={onClose} title="Активировать подписку">
      <div className="space-y-4">
        <div className="bg-dark-700 rounded-lg px-4 py-3">
          <div className="text-white font-medium">{user.first_name} {user.last_name || ''}</div>
          <div className="text-gray-400 text-xs mt-0.5">Telegram ID: {user.telegram_id}</div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Выберите тариф</label>
          <div className="space-y-2">
            {plans.filter(p => p.enabled).map(p => (
              <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                selectedPlan === p.id ? 'border-blue-500 bg-blue-500/10' : 'border-dark-500 bg-dark-700 hover:border-dark-400'
              }`}>
                <input type="radio" value={p.id} checked={selectedPlan === p.id}
                  onChange={() => setSelectedPlan(p.id)} className="accent-blue-500" />
                <span className="flex-1 text-sm text-white">{p.label}</span>
                <span className="text-gray-400 text-sm">{p.price} ₽</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={activate} disabled={loading || !selectedPlan}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors">
            {loading ? 'Активация...' : 'Активировать'}
          </button>
          <button onClick={onClose} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm py-2 rounded-lg transition-colors">
            Отмена
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Sync Button ──────────────────────────────────────────────────────────────
function SyncButton({ onLoad, addToast }) {
  const [syncing, setSyncing] = useState(false)

  const run = async () => {
    setSyncing(true)
    try {
      const r = await fetch('/proxy/sync', { method: 'POST' })
      const d = await r.json()
      if (d.ok) {
        const total = d.results?.reduce((s, n) => s + (n.rotated || 0) + (n.recreated || 0) + (n.created || 0), 0) ?? 0
        addToast(`Синхронизировано: ${total} применено`, 'success')
        onLoad()
      }
    } catch (e) { addToast('Ошибка: ' + e.message, 'error') }
    setSyncing(false)
  }

  return (
    <button onClick={run} disabled={syncing}
      className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 bg-dark-700 border border-dark-600 rounded-lg transition-colors disabled:opacity-50">
      <Key size={13} className={syncing ? 'animate-pulse' : ''} />
      {syncing ? 'Синхронизация...' : 'Синхронизировать'}
    </button>
  )
}

// ─── User Actions Menu ────────────────────────────────────────────────────────
function UserMenu({ user, onAction, now }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, bottom: null, right: 0 })
  const btnRef = useRef(null)

  const subActive = user.subscription_until && user.subscription_until > now

  // Build actions list first so toggle can measure menu height
  const actions = []
  if (user._type === 'bot') {
    actions.push({ id: 'activate', label: 'Выдать подписку', icon: Check })
    if (subActive) actions.push({ id: 'deactivate', label: 'Отозвать доступ', icon: PowerOff })
  }
  if (user.proxy_username) {
    actions.push({ id: 'view', label: 'Прокси-детали', icon: Eye })
    actions.push({ id: 'rotate', label: 'Сменить секрет', icon: Key })
    actions.push({ id: 'resetQuota', label: 'Сбросить квоту', icon: RotateCcw })
    if (user.proxy_enabled) {
      actions.push({ id: 'disableProxy', label: 'Откл. прокси', icon: PowerOff })
    } else {
      actions.push({ id: 'enableProxy', label: 'Вкл. прокси', icon: Power })
    }
  }
  actions.push({ id: 'delete', label: 'Удалить', icon: Trash2, danger: true })

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const menuHeight = actions.length * 44 + 8
      const spaceBelow = window.innerHeight - r.bottom
      if (spaceBelow < menuHeight) {
        // Not enough room below — open upward
        setPos({ top: null, bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right })
      } else {
        setPos({ top: r.bottom + 4, bottom: null, right: window.innerWidth - r.right })
      }
    }
    setOpen(v => !v)
  }

  const menuStyle = pos.bottom !== null
    ? { bottom: pos.bottom, right: pos.right }
    : { top: pos.top, right: pos.right }

  return (
    <div>
      <button ref={btnRef} onClick={toggle}
        className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-dark-600 rounded transition-colors">
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 w-48 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl overflow-hidden"
            style={menuStyle}>
            {actions.map(({ id, label, icon: Icon, danger }) => (
              <button key={id} onClick={() => { setOpen(false); onAction(id, user) }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  danger ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-300 hover:bg-dark-600'
                }`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Unified Users Tab ────────────────────────────────────────────────────────
function UnifiedUsersTab() {
  const { nodes, activeNode } = useNode()
  const addToast = useToast()
  const [botUsers, setBotUsers] = useState([])
  const [plans, setPlans] = useState([])
  const [proxyStats, setProxyStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, plansRes] = await Promise.allSettled([
      apiFetch('/users'),
      apiFetch('/plans'),
    ])
    if (usersRes.status === 'fulfilled') setBotUsers(Array.isArray(usersRes.value) ? usersRes.value : [])
    if (plansRes.status === 'fulfilled') setPlans(Array.isArray(plansRes.value) ? plansRes.value : [])

    if (activeNode) {
      try {
        const stats = await makeApi(activeNode.id).statsUsers()
        const arr = Array.isArray(stats)
          ? stats
          : Array.isArray(stats?.data)
            ? stats.data
            : (stats?.data?.users || [])
        setProxyStats(arr)
      } catch { setProxyStats([]) }
    } else {
      setProxyStats([])
    }
    setLoading(false)
  }, [activeNode?.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(() => load(), 20000)
    return () => clearInterval(t)
  }, [load])

  const now = Date.now()

  // Merge bot users + proxy-only users
  const mergedUsers = useMemo(() => {
    const result = []
    const handled = new Set()

    for (const bu of botUsers) {
      const pUsername = bu.proxy_username || `tg_${bu.telegram_id}`
      const ps = proxyStats.find(p => p.username === pUsername) || null
      handled.add(pUsername)
      result.push({
        _key: `bot_${bu.telegram_id}`,
        _type: 'bot',
        telegram_id: bu.telegram_id,
        first_name: bu.first_name || '',
        last_name: bu.last_name || '',
        tg_username: bu.username || '',
        subscription_until: bu.subscription_until || null,
        has_access: bu.has_access,
        trial_used: bu.trial_used,
        created_at: bu.created_at,
        proxy_username: pUsername,
        proxy_enabled: ps ? ps.enabled !== false : null,
        in_runtime: ps?.in_runtime,
        current_connections: ps?.current_connections ?? 0,
        total_octets: ps?.total_octets ?? 0,
        active_unique_ips: ps?.active_unique_ips ?? 0,
      })
    }

    for (const pu of proxyStats) {
      if (handled.has(pu.username)) continue
      result.push({
        _key: `proxy_${pu.username}`,
        _type: 'proxy',
        proxy_username: pu.username,
        proxy_enabled: pu.enabled !== false,
        in_runtime: pu.in_runtime,
        current_connections: pu.current_connections ?? 0,
        total_octets: pu.total_octets ?? 0,
        active_unique_ips: pu.active_unique_ips ?? 0,
        expiration_rfc3339: pu.expiration_rfc3339,
      })
    }
    return result
  }, [botUsers, proxyStats])

  const filtered = mergedUsers.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      String(u.telegram_id ?? '').includes(q) ||
      (u.tg_username ?? '').toLowerCase().includes(q) ||
      (u.first_name ?? '').toLowerCase().includes(q) ||
      (u.last_name ?? '').toLowerCase().includes(q) ||
      (u.proxy_username ?? '').toLowerCase().includes(q)
    )
  })

  const runOnAllNodes = (fn) => Promise.allSettled(nodes.map(n => fn(makeApi(n.id))))

  const handleAction = async (action, user) => {
    if (action === 'activate') {
      setModal({ type: 'activate', user })

    } else if (action === 'deactivate') {
      setModal({
        type: 'confirm',
        title: 'Отозвать доступ?',
        message: `Отключить прокси и завершить подписку для ${user.first_name || user.telegram_id}? Пользователь потеряет доступ немедленно.`,
        danger: true,
        onConfirm: async () => {
          try {
            await apiFetch(`/users/${user.telegram_id}/deactivate`, { method: 'POST' })
            addToast('Доступ отозван', 'success')
          } catch (e) { addToast(e.message, 'error') }
          setModal(null); load()
        }
      })

    } else if (action === 'view') {
      setModal({ type: 'view', user })

    } else if (action === 'rotate') {
      setModal({ type: 'rotate', user })

    } else if (action === 'resetQuota') {
      setModal({
        type: 'confirm',
        title: 'Сбросить квоту?',
        message: `Обнулить счётчики трафика для ${user.proxy_username}?`,
        danger: false,
        onConfirm: async () => {
          try {
            await runOnAllNodes(a => a.resetQuota(user.proxy_username))
            addToast('Квота сброшена', 'success')
          } catch (e) { addToast(e.message, 'error') }
          setModal(null); load()
        }
      })

    } else if (action === 'enableProxy') {
      try {
        await runOnAllNodes(a => a.enableUser(user.proxy_username))
        addToast('Прокси включён на всех нодах', 'success')
        load()
      } catch (e) { addToast(e.message, 'error') }

    } else if (action === 'disableProxy') {
      setModal({
        type: 'confirm',
        title: 'Отключить прокси?',
        message: `Отключить прокси-пользователя ${user.proxy_username} на всех нодах? Подписка в боте останется нетронутой.`,
        danger: true,
        onConfirm: async () => {
          try {
            await runOnAllNodes(a => a.disableUser(user.proxy_username))
            addToast('Прокси отключён', 'success')
          } catch (e) { addToast(e.message, 'error') }
          setModal(null); load()
        }
      })

    } else if (action === 'delete') {
      const label = user._type === 'bot'
        ? `${user.first_name || ''} (ID: ${user.telegram_id})`
        : user.proxy_username
      setModal({
        type: 'confirm',
        title: 'Удалить пользователя?',
        message: `Удалить ${label}? Пользователь будет удалён из бота и со всех нод. Действие необратимо.`,
        danger: true,
        onConfirm: async () => {
          try {
            if (user._type === 'bot') {
              await apiFetch(`/users/${user.telegram_id}`, { method: 'DELETE' })
            }
            if (user.proxy_username) {
              await runOnAllNodes(a => a.deleteUser(user.proxy_username))
              await fetch(`/proxy/users/${encodeURIComponent(user.proxy_username)}`, { method: 'DELETE' }).catch(() => {})
            }
            addToast('Удалено', 'success')
          } catch (e) { addToast(e.message, 'error') }
          setModal(null); load()
        }
      })
    }
  }

  const botCount = mergedUsers.filter(u => u._type === 'bot').length
  const activeSubCount = mergedUsers.filter(u => u.subscription_until && u.subscription_until > now).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Пользователи</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {botCount} в боте · {activeSubCount} активных подписок{activeNode ? ` · нода: ${activeNode.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {nodes.length > 0 && <SyncButton onLoad={load} addToast={addToast} />}
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-200 bg-dark-700 border border-dark-600 rounded-lg transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени, @username, Telegram ID, прокси..."
          className="w-full bg-dark-700 border border-dark-500 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500"
        />
      </div>

      {!activeNode && (
        <div className="flex items-center gap-2 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl text-xs text-yellow-300">
          <AlertTriangle size={13} className="flex-shrink-0" />
          Нода не выбрана — прокси-статистика недоступна. Выберите ноду в боковом меню.
        </div>
      )}

      <div className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-14 bg-dark-700 animate-pulse rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{mergedUsers.length === 0 ? 'Нет пользователей' : 'Ничего не найдено'}</p>
          </div>
        ) : (
          <>
            {/* ── Desktop table (md+) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Пользователь</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Подписка</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Прокси</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Соед.</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Трафик</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Регистрация</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const subActive = u.subscription_until && u.subscription_until > now
                    return (
                      <tr key={u._key} className="border-b border-dark-700 hover:bg-dark-750 transition-colors">
                        <td className="px-4 py-3">
                          {u._type === 'bot' ? (
                            <>
                              <div className="font-medium text-white">
                                {u.first_name}{u.last_name ? ` ${u.last_name}` : ''}
                              </div>
                              {u.tg_username && <div className="text-xs text-gray-500">@{u.tg_username}</div>}
                              <div className="text-xs text-gray-600 font-mono">ID {u.telegram_id}</div>
                            </>
                          ) : (
                            <div className="font-mono text-sm text-white">{u.proxy_username}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u._type === 'bot' ? (
                            <div>
                              <SubBadge active={subActive} until={u.subscription_until} />
                              {u.subscription_until && (
                                <div className="text-xs text-gray-500 mt-0.5">до {formatDate(u.subscription_until)}</div>
                              )}
                              {u.trial_used && <div className="text-xs text-gray-600 mt-0.5">тест исп.</div>}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.proxy_username ? (
                            <div>
                              {u.proxy_enabled === null ? (
                                <span className="text-xs text-gray-600">нет на нодах</span>
                              ) : u.proxy_enabled ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Активен
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-red-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Откл.
                                </span>
                              )}
                              <div className="text-xs text-gray-600 font-mono mt-0.5 truncate max-w-[120px]">{u.proxy_username}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">{u.current_connections}</td>
                        <td className="px-4 py-3 text-gray-300 text-sm">{formatBytes(u.total_octets)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <UserMenu user={u} onAction={handleAction} now={now} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (< md) ── */}
            <div className="md:hidden divide-y divide-dark-700">
              {filtered.map(u => {
                const subActive = u.subscription_until && u.subscription_until > now
                return (
                  <div key={u._key} className="p-4">
                    {/* Row 1: name + menu */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {u._type === 'bot' ? (
                          <>
                            <div className="font-medium text-white text-sm">
                              {u.first_name}{u.last_name ? ` ${u.last_name}` : ''}
                            </div>
                            {u.tg_username && <div className="text-xs text-gray-500">@{u.tg_username}</div>}
                            <div className="text-xs text-gray-600 font-mono">ID {u.telegram_id}</div>
                          </>
                        ) : (
                          <div className="font-mono text-sm text-white break-all">{u.proxy_username}</div>
                        )}
                      </div>
                      <UserMenu user={u} onAction={handleAction} now={now} />
                    </div>

                    {/* Row 2: subscription + proxy badges */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {u._type === 'bot' && (
                        <div className="flex items-center gap-1.5">
                          <SubBadge active={subActive} until={u.subscription_until} />
                          {u.subscription_until && (
                            <span className="text-xs text-gray-500">до {formatDate(u.subscription_until)}</span>
                          )}
                          {u.trial_used && <span className="text-xs text-gray-600">· тест исп.</span>}
                        </div>
                      )}
                      {u.proxy_username && (
                        u.proxy_enabled === null ? (
                          <span className="text-xs text-gray-600">нет на нодах</span>
                        ) : u.proxy_enabled ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Прокси активен
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Прокси откл.
                          </span>
                        )
                      )}
                    </div>

                    {/* Row 3: stats */}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>Соед.: <span className="text-gray-300">{u.current_connections}</span></span>
                      <span>Трафик: <span className="text-gray-300">{formatBytes(u.total_octets)}</span></span>
                      {u.created_at && <span>Рег.: <span className="text-gray-400">{formatDate(u.created_at)}</span></span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modal?.type === 'activate' && (
        <ActivateModal user={modal.user} plans={plans} addToast={addToast}
          onClose={() => setModal(null)} onDone={load} />
      )}
      {modal?.type === 'view' && (
        <ProxyDetailModal nodes={nodes} username={modal.user.proxy_username}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === 'rotate' && (
        <RotateModal nodes={nodes} proxyUsername={modal.user.proxy_username} addToast={addToast}
          onClose={() => setModal(null)} onDone={load} />
      )}
      {modal?.type === 'confirm' && (
        <ConfirmModal title={modal.title} message={modal.message} danger={modal.danger}
          onConfirm={modal.onConfirm} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────
function PlansTab() {
  const addToast = useToast()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [addOpen, setAddOpen] = useState(false)
  const [newPlan, setNewPlan] = useState({ label: '', days: '', price: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try { setPlans(await apiFetch('/plans')) } catch (e) { addToast(e.message, 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    try {
      await apiFetch('/plans', { method: 'POST', body: JSON.stringify(plans) })
      addToast('Тарифы сохранены', 'success')
      setEditId(null)
    } catch (e) { addToast(e.message, 'error') }
  }

  const toggleEnabled = (idx) => {
    const updated = plans.map((p, i) => i === idx ? { ...p, enabled: !p.enabled } : p)
    setPlans(updated)
    apiFetch('/plans', { method: 'POST', body: JSON.stringify(updated) }).catch(() => {})
  }

  const startEdit = (p) => { setEditId(p.id); setEditData({ label: p.label, days: p.days, price: p.price }) }
  const cancelEdit = () => setEditId(null)
  const applyEdit = () => {
    setPlans(plans.map(p => p.id === editId
      ? { ...p, label: editData.label, days: Number(editData.days), price: Number(editData.price) }
      : p))
    setEditId(null)
    setTimeout(save, 50)
  }

  const deletePlan = async (id) => {
    try {
      await apiFetch(`/plans/${id}`, { method: 'DELETE' })
      setPlans(plans.filter(p => p.id !== id))
      addToast('Тариф удалён', 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  const addPlan = async () => {
    if (!newPlan.label || !newPlan.days || !newPlan.price) return addToast('Заполните все поля', 'error')
    const plan = {
      id: `plan_${Date.now()}`,
      label: newPlan.label,
      days: Number(newPlan.days),
      price: Number(newPlan.price),
      enabled: true
    }
    const updated = [...plans, plan]
    try {
      await apiFetch('/plans', { method: 'POST', body: JSON.stringify(updated) })
      setPlans(updated)
      setNewPlan({ label: '', days: '', price: '' })
      setAddOpen(false)
      addToast('Тариф добавлен', 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  if (loading) return <div className="text-gray-500 text-sm">Загрузка...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Тарифные планы</h2>
          <p className="text-xs text-gray-500 mt-0.5">Настройте цены и сроки подписки для бота</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
          <Plus size={14} /> Добавить тариф
        </button>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-600">
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Название</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Срок (дней)</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Цена (₽)</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Статус</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {plans.map((p, idx) => (
              <tr key={p.id} className="border-b border-dark-700 hover:bg-dark-750 transition-colors">
                {editId === p.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input value={editData.label} onChange={e => setEditData({ ...editData, label: e.target.value })}
                        className="bg-dark-700 border border-dark-500 rounded-lg px-2 py-1 text-white text-sm w-full" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={editData.days} onChange={e => setEditData({ ...editData, days: e.target.value })}
                        className="bg-dark-700 border border-dark-500 rounded-lg px-2 py-1 text-white text-sm w-24" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={editData.price} onChange={e => setEditData({ ...editData, price: e.target.value })}
                        className="bg-dark-700 border border-dark-500 rounded-lg px-2 py-1 text-white text-sm w-24" />
                    </td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2">
                      <div className="flex gap-2 justify-end">
                        <button onClick={applyEdit} className="p-1 text-green-400 hover:text-green-300"><Check size={14} /></button>
                        <button onClick={cancelEdit} className="p-1 text-gray-500 hover:text-gray-300"><X size={14} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-white font-medium">{p.label}</td>
                    <td className="px-4 py-3 text-gray-300">{p.days}</td>
                    <td className="px-4 py-3 text-gray-300">{p.price} ₽</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleEnabled(idx)} className="flex items-center gap-1.5 text-xs">
                        {p.enabled
                          ? <><ToggleRight size={18} className="text-green-400" /><span className="text-green-400">Вкл</span></>
                          : <><ToggleLeft size={18} className="text-gray-500" /><span className="text-gray-500">Выкл</span></>
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => startEdit(p)} className="p-1 text-gray-400 hover:text-blue-400 transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => deletePlan(p.id)} className="p-1 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <Modal onClose={() => setAddOpen(false)} title="Новый тариф">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Название</label>
              <input placeholder="1 месяц" value={newPlan.label}
                onChange={e => setNewPlan({ ...newPlan, label: e.target.value })}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Срок (дней)</label>
              <input type="number" placeholder="30" value={newPlan.days}
                onChange={e => setNewPlan({ ...newPlan, days: e.target.value })}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Цена (₽)</label>
              <input type="number" placeholder="149" value={newPlan.price}
                onChange={e => setNewPlan({ ...newPlan, price: e.target.value })}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={addPlan} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg transition-colors">
                Добавить
              </button>
              <button onClick={() => setAddOpen(false)} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm py-2 rounded-lg transition-colors">
                Отмена
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────
function PaymentsTab() {
  const addToast = useToast()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/payments').then(setPayments).catch(e => addToast(e.message, 'error')).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500 text-sm">Загрузка...</div>

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">История платежей</h2>
        <p className="text-xs text-gray-500 mt-0.5">{payments.length} транзакций</p>
      </div>
      {payments.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Нет платежей</p>
        </div>
      ) : (
        <div className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Дата</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Пользователь</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Тариф</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Сумма</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Статус</th>
              </tr>
            </thead>
            <tbody>
              {[...payments].reverse().map(p => (
                <tr key={p.id} className="border-b border-dark-700 hover:bg-dark-750 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(p.created_at)}</td>
                  <td className="px-4 py-3 text-gray-300">
                    <div className="text-xs">{p.user_name || '—'}</div>
                    <div className="text-gray-500 text-xs">{p.telegram_id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{p.plan_label || '—'}</td>
                  <td className="px-4 py-3 text-white font-medium text-xs">{p.amount} ₽</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                      p.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {p.status === 'paid' ? 'Оплачен' : p.status === 'pending' ? 'Ожидает' : 'Отменён'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const addToast = useToast()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tokenVisible, setTokenVisible] = useState(false)
  const [tokenInput, setTokenInput] = useState('')

  useEffect(() => {
    apiFetch('/settings').then(s => { setSettings(s); setLoading(false) }).catch(e => addToast(e.message, 'error'))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...settings }
      if (tokenInput) payload.bot_token = tokenInput
      else delete payload.bot_token
      await apiFetch('/settings', { method: 'PATCH', body: JSON.stringify(payload) })
      addToast('Настройки сохранены', 'success')
      setTokenInput('')
    } catch (e) { addToast(e.message, 'error') }
    setSaving(false)
  }

  if (loading) return <div className="text-gray-500 text-sm">Загрузка...</div>

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-white">Настройки бота</h2>
        <p className="text-xs text-gray-500 mt-0.5">Конфигурация Telegram-бота</p>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600 p-5 space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Bot Token (от @BotFather)</label>
          <div className="flex gap-2">
            <input
              type={tokenVisible ? 'text' : 'password'}
              placeholder={settings?.bot_token === '***' ? '••••••• (сохранён)' : 'Введите токен бота...'}
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm font-mono"
            />
            <button onClick={() => setTokenVisible(!tokenVisible)}
              className="px-3 py-2 bg-dark-700 border border-dark-500 rounded-lg text-gray-400 hover:text-gray-200 text-sm transition-colors">
              {tokenVisible ? 'Скрыть' : 'Показать'}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">Получите токен у @BotFather → /newbot</p>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Название сервиса</label>
          <input value={settings?.bot_name || ''} onChange={e => setSettings({ ...settings, bot_name: e.target.value })}
            placeholder="Telemt Proxy"
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Приветственный текст (подзаголовок)</label>
          <input value={settings?.welcome_text || ''} onChange={e => setSettings({ ...settings, welcome_text: e.target.value })}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Преимущества (каждое с новой строки)</label>
          <textarea value={settings?.features || ''} onChange={e => setSettings({ ...settings, features: e.target.value })}
            rows={4}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm resize-none" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Ссылка на поддержку</label>
          <input value={settings?.support_link || ''} onChange={e => setSettings({ ...settings, support_link: e.target.value })}
            placeholder="@support или https://t.me/support"
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">О нас</label>
          <textarea value={settings?.about_text || ''} onChange={e => setSettings({ ...settings, about_text: e.target.value })}
            rows={3}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Бонус за реферала (дней)</label>
            <input type="number" value={settings?.ref_bonus_days || 3}
              onChange={e => setSettings({ ...settings, ref_bonus_days: Number(e.target.value) })}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Пробный период (дней)</label>
            <input type="number" value={settings?.trial_days || 1}
              onChange={e => setSettings({ ...settings, trial_days: Number(e.target.value) })}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Канал для обязательной подписки (username без @)</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">@</span>
            <input value={settings?.required_channel || ''}
              onChange={e => setSettings({ ...settings, required_channel: e.target.value.replace('@', '') })}
              placeholder="mychannel (оставьте пустым чтобы отключить)"
              className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Пользователь должен подписаться на канал перед получением тестового доступа. Бот должен быть администратором канала.
          </p>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
        {saving ? 'Сохранение...' : 'Сохранить настройки'}
      </button>
    </div>
  )
}

// ─── Main Bot Page ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'users', label: 'Пользователи', icon: Users },
  { id: 'plans', label: 'Тарифы', icon: CreditCard },
  { id: 'payments', label: 'Платежи', icon: TrendingUp },
  { id: 'settings', label: 'Настройки', icon: Settings },
]

export default function BotPage() {
  const addToast = useToast()
  const [tab, setTab] = useState('users')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    apiFetch('/stats').then(setStats).catch(() => {})
  }, [tab])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
          <Bot size={18} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Telegram Бот</h1>
          <p className="text-xs text-gray-500">Управление ботом и пользователями прокси</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Всего пользователей" value={stats.total_users} icon={Users} color="blue" />
          <StatCard title="Активных подписок" value={stats.active_subscriptions} icon={UserCheck} color="green" />
          <StatCard title="Выручка за сегодня" value={`${stats.today_revenue} ₽`} icon={DollarSign} color="yellow" />
          <StatCard title="Общая выручка" value={`${stats.total_revenue} ₽`} icon={TrendingUp} color="purple" />
        </div>
      )}

      <div className="bg-dark-800 border border-dark-600 rounded-xl p-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max sm:min-w-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {tab === 'users' && <UnifiedUsersTab />}
        {tab === 'plans' && <PlansTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
