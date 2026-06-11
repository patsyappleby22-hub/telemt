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
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-dark-600 rounded transition-colors">
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-44 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl overflow-hidden">
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

function CreateUserModal({ api, onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', secret: '', user_ad_tag: '', max_tcp_conns: '', data_quota_bytes: '', rate_limit_up_bps: '', rate_limit_down_bps: '', max_unique_ips: '', expiration_rfc3339: '', enabled: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const toast = useToast()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.username.trim()) { setError('Введите имя пользователя'); return }
    setLoading(true); setError(null)
    try {
      const body = { username: form.username.trim(), enabled: form.enabled }
      if (form.secret) body.secret = form.secret
      if (form.user_ad_tag) body.user_ad_tag = form.user_ad_tag
      if (form.max_tcp_conns) body.max_tcp_conns = parseInt(form.max_tcp_conns)
      if (form.data_quota_bytes) body.data_quota_bytes = parseInt(form.data_quota_bytes)
      if (form.rate_limit_up_bps) body.rate_limit_up_bps = parseInt(form.rate_limit_up_bps)
      if (form.rate_limit_down_bps) body.rate_limit_down_bps = parseInt(form.rate_limit_down_bps)
      if (form.max_unique_ips) body.max_unique_ips = parseInt(form.max_unique_ips)
      if (form.expiration_rfc3339) body.expiration_rfc3339 = form.expiration_rfc3339
      const res = await api.createUser(body)
      setResult(res.data)
      toast('Пользователь создан!', 'success')
      onCreated()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  if (result) {
    return (
      <Modal title="Пользователь создан" onClose={onClose}>
        <div className="space-y-4">
          <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-xl">
            <div className="text-sm font-medium text-green-300 mb-3">Сохраните секрет — он показывается только один раз!</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-dark-900 px-3 py-2 rounded-lg text-yellow-300 border border-dark-600 break-all">{result.secret}</code>
              <CopyButton text={result.secret} />
            </div>
          </div>
          {result.user?.links?.tls?.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">TLS-ссылки</div>
              {result.user.links.tls.map((l, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <code className="flex-1 text-xs font-mono bg-dark-700 px-2 py-1.5 rounded text-gray-300 break-all">{l}</code>
                  <CopyButton text={l} />
                </div>
              ))}
            </div>
          )}
          <button onClick={onClose} className="btn-primary w-full justify-center">Закрыть</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Создать пользователя" onClose={onClose} size="lg">
      <div className="space-y-4">
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

function UserDetailModal({ api, username, onClose }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState({})

  useEffect(() => {
    api.getUser(username).then(r => { setUser(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [username])

  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text)
    setCopied(p => ({ ...p, [key]: true }))
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 1500)
  }

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
          {(user.links?.tls?.length > 0 || user.links?.classic?.length > 0 || user.links?.secure?.length > 0) && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Ссылки для подключения</div>
              <div className="space-y-2">
                {[['TLS', user.links?.tls], ['Secure', user.links?.secure], ['Classic', user.links?.classic]].map(([type, links]) =>
                  links?.map((link, i) => (
                    <div key={`${type}-${i}`} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-12">{type}</span>
                      <code className="flex-1 text-xs font-mono bg-dark-700 px-2 py-1.5 rounded text-blue-300 break-all">{link}</code>
                      <button onClick={() => copy(link, `${type}-${i}`)} className="text-gray-500 hover:text-gray-200 flex-shrink-0">
                        {copied[`${type}-${i}`] ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600">Ошибка загрузки</div>
      )}
    </Modal>
  )
}

function RotateSecretModal({ api, username, onClose, onDone }) {
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const toast = useToast()

  const submit = async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.rotateSecret(username, secret || undefined)
      setResult(res.data)
      toast('Секрет обновлён', 'success')
      onDone()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  if (result) {
    return (
      <Modal title="Секрет обновлён" onClose={onClose}>
        <div className="space-y-4">
          <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-xl">
            <div className="text-sm font-medium text-green-300 mb-3">Новый секрет <b>{username}</b>:</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-dark-900 px-3 py-2 rounded-lg text-yellow-300 border border-dark-600 break-all">{result.secret || JSON.stringify(result)}</code>
              <CopyButton text={result.secret || ''} />
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
  const { activeNode } = useNode()
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

  const handleAction = async (action, user) => {
    if (action === 'view') { setModal({ type: 'view', username: user.username }) }
    else if (action === 'rotate') { setModal({ type: 'rotate', username: user.username }) }
    else if (action === 'delete') {
      setModal({ type: 'confirm', title: 'Удалить пользователя?', message: `Удалить "${user.username}"? Это действие необратимо.`, danger: true,
        onConfirm: async () => {
          try { await api.deleteUser(user.username); toast(`"${user.username}" удалён`, 'success'); setModal(null); load() }
          catch (e) { toast('Ошибка: ' + e.message, 'error') }
        }
      })
    } else if (action === 'disable') {
      setModal({ type: 'confirm', title: 'Отключить?', message: `Отключить "${user.username}"?`, danger: false,
        onConfirm: async () => {
          try { await api.disableUser(user.username); toast(`"${user.username}" отключён`, 'success'); setModal(null); load() }
          catch (e) { toast('Ошибка: ' + e.message, 'error') }
        }
      })
    } else if (action === 'enable') {
      try { await api.enableUser(user.username); toast(`"${user.username}" активирован`, 'success'); load() }
      catch (e) { toast('Ошибка: ' + e.message, 'error') }
    } else if (action === 'reset-quota') {
      setModal({ type: 'confirm', title: 'Сбросить квоту?', message: `Сбросить данные для "${user.username}"?`, danger: false,
        onConfirm: async () => {
          try { await api.resetQuota(user.username); toast(`Квота "${user.username}" сброшена`, 'success'); setModal(null); load() }
          catch (e) { toast('Ошибка: ' + e.message, 'error') }
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
          <p className="text-sm text-gray-500 mt-0.5">{activeNode.name} · {users.length} пользователей</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="btn-ghost">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
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
                  <th className="px-4 py-3 font-medium">IP</th>
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

      {modal?.type === 'create' && <CreateUserModal api={api} onClose={() => setModal(null)} onCreated={load} />}
      {modal?.type === 'view' && <UserDetailModal api={api} username={modal.username} onClose={() => setModal(null)} />}
      {modal?.type === 'rotate' && <RotateSecretModal api={api} username={modal.username} onClose={() => setModal(null)} onDone={load} />}
      {modal?.type === 'confirm' && <ConfirmModal title={modal.title} message={modal.message} danger={modal.danger} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
    </div>
  )
}
