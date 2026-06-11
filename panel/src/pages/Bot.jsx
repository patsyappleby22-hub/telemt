import React, { useState, useEffect, useCallback } from 'react'
import {
  Bot, Users, CreditCard, Settings, Plus, Trash2, Edit2, Check, X,
  TrendingUp, UserCheck, DollarSign, Calendar, RefreshCw, Copy,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Gift, Send
} from 'lucide-react'
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

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      active ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/20 text-gray-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-400' : 'bg-gray-500'}`} />
      {active ? 'Активна' : 'Нет доступа'}
    </span>
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
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
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

      {addOpen && <Modal onClose={() => setAddOpen(false)} title="Новый тариф">
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
      </Modal>}
    </div>
  )
}

// ─── Bot Users Tab ────────────────────────────────────────────────────────────
function BotUsersTab() {
  const addToast = useToast()
  const [users, setUsers] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activating, setActivating] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, p] = await Promise.all([apiFetch('/users'), apiFetch('/plans')])
      setUsers(u)
      setPlans(p)
    } catch (e) { addToast(e.message, 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const activate = async () => {
    if (!selectedUser || !selectedPlan) return
    setActivating(selectedUser.telegram_id)
    try {
      const updated = await apiFetch(`/users/${selectedUser.telegram_id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ plan_id: selectedPlan })
      })
      setUsers(users.map(u => u.telegram_id === updated.telegram_id ? updated : u))
      addToast('Подписка активирована', 'success')
      setSelectedUser(null)
    } catch (e) { addToast(e.message, 'error') }
    setActivating(null)
  }

  const deactivate = async (u) => {
    try {
      const updated = await apiFetch(`/users/${u.telegram_id}/deactivate`, { method: 'POST' })
      setUsers(users.map(x => x.telegram_id === updated.telegram_id ? updated : x))
      addToast('Доступ отозван', 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  const deleteUser = async (u) => {
    if (!confirm(`Удалить пользователя ${u.first_name || u.telegram_id}?`)) return
    try {
      await apiFetch(`/users/${u.telegram_id}`, { method: 'DELETE' })
      setUsers(users.filter(x => x.telegram_id !== u.telegram_id))
      addToast('Пользователь удалён', 'success')
    } catch (e) { addToast(e.message, 'error') }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return !q || String(u.telegram_id).includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.first_name || '').toLowerCase().includes(q)
  })

  const now = Date.now()

  if (loading) return <div className="text-gray-500 text-sm">Загрузка...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Пользователи бота</h2>
          <p className="text-xs text-gray-500 mt-0.5">{users.length} зарегистрировано</p>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Поиск по ID / username / имени"
            value={search} onChange={e => setSearch(e.target.value)}
            className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 w-64"
          />
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-200 bg-dark-700 border border-dark-600 rounded-lg">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Нет пользователей</p>
        </div>
      ) : (
        <div className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Пользователь</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Telegram ID</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Подписка до</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Статус</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Рефералы</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Регистрация</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const active = u.subscription_until && u.subscription_until > now
                return (
                  <tr key={u.telegram_id} className="border-b border-dark-700 hover:bg-dark-750 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{u.first_name || '—'} {u.last_name || ''}</div>
                      {u.username && <div className="text-xs text-gray-500">@{u.username}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{u.telegram_id}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{formatDate(u.subscription_until)}</td>
                    <td className="px-4 py-3"><StatusBadge active={active} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.referral_count || 0}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => { setSelectedUser(u); setSelectedPlan(plans[0]?.id || '') }}
                          className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs rounded-lg transition-colors"
                        >
                          Выдать
                        </button>
                        {active && (
                          <button
                            onClick={() => deactivate(u)}
                            className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded-lg transition-colors"
                          >
                            Отозвать
                          </button>
                        )}
                        <button onClick={() => deleteUser(u)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!!selectedUser && <Modal onClose={() => setSelectedUser(null)} title="Активировать подписку">
        {selectedUser && (
          <div className="space-y-4">
            <div className="bg-dark-700 rounded-lg px-4 py-3 text-sm">
              <div className="text-white font-medium">{selectedUser.first_name} {selectedUser.last_name}</div>
              <div className="text-gray-400 text-xs mt-0.5">ID: {selectedUser.telegram_id}</div>
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
                    <span className="text-gray-400 text-sm font-medium">{p.price} ₽</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={activate}
                disabled={!!activating}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors"
              >
                {activating ? 'Активация...' : 'Активировать'}
              </button>
              <button onClick={() => setSelectedUser(null)} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm py-2 rounded-lg transition-colors">
                Отмена
              </button>
            </div>
          </div>
        )}
      </Modal>}
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
            <button onClick={() => setTokenVisible(!tokenVisible)} className="px-3 py-2 bg-dark-700 border border-dark-500 rounded-lg text-gray-400 hover:text-gray-200 text-sm transition-colors">
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
          <label className="text-xs text-gray-400 mb-1.5 block">Ссылка на поддержку (username или t.me/...)</label>
          <input value={settings?.support_link || ''} onChange={e => setSettings({ ...settings, support_link: e.target.value })}
            placeholder="@support или https://t.me/support"
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">О нас (текст для раздела "О нас")</label>
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
          <p className="text-xs text-gray-600 mt-1">Пользователь должен подписаться на канал перед получением тестового доступа. Бот должен быть администратором канала.</p>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
        {saving ? 'Сохранение...' : 'Сохранить настройки'}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'plans', label: 'Тарифы', icon: CreditCard },
  { id: 'users', label: 'Пользователи', icon: Users },
  { id: 'payments', label: 'Платежи', icon: TrendingUp },
  { id: 'settings', label: 'Настройки', icon: Settings },
]

export default function BotPage() {
  const addToast = useToast()
  const [tab, setTab] = useState('plans')
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
          <p className="text-xs text-gray-500">Управление ботом для продажи прокси</p>
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

      <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'plans' && <PlansTab />}
        {tab === 'users' && <BotUsersTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
