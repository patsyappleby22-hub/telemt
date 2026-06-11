import React, { useState } from 'react'
import {
  Server, Plus, Trash2, Edit2, AlertTriangle, Wifi, WifiOff,
  RefreshCw, Terminal, Copy, Check, ChevronDown, ChevronUp,
  Zap, X, Download
} from 'lucide-react'
import { useNode } from '../NodeContext'
import { addNode, updateNode, deleteNode } from '../nodes'
import { makeApi } from '../api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

// ── helpers ────────────────────────────────────────────────────────────────

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 btn-ghost py-1.5 px-3 text-xs">
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {copied ? 'Скопировано' : (label || 'Копировать')}
    </button>
  )
}

function NodeStatus({ nodeId }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const check = async () => {
    setLoading(true)
    try {
      const api = makeApi(nodeId)
      const h = await api.health()
      setStatus({ ok: true, label: h?.data?.status || 'ok' })
    } catch (e) {
      setStatus({ ok: false, label: e.message })
    } finally { setLoading(false) }
  }
  return (
    <button onClick={check} disabled={loading}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 transition-colors">
      {loading ? <RefreshCw size={12} className="animate-spin" />
        : status?.ok ? <Wifi size={12} className="text-green-400" />
        : status ? <WifiOff size={12} className="text-red-400" />
        : <Wifi size={12} />}
      <span className={status ? (status.ok ? 'text-green-400' : 'text-red-400') : ''}>
        {status ? (status.ok ? 'Онлайн' : 'Офлайн') : 'Проверить'}
      </span>
    </button>
  )
}

// ── Auto-install modal ─────────────────────────────────────────────────────

function AutoInstallModal({ onClose, onAdded }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', api_port: '9091', proxy_port: '8443' })
  const [cmd, setCmd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [advanced, setAdvanced] = useState(false)
  const toast = useToast()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const generate = async () => {
    if (!form.name.trim()) { setError('Введите название ноды'); return }
    setLoading(true); setError(null)
    try {
      const panelUrl = window.location.origin
      const res = await fetch('/proxy/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), panel_url: panelUrl })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка')

      const scriptUrl = `/proxy/setup.sh?token=${data.token}&name=${encodeURIComponent(form.name.trim())}&panel_url=${encodeURIComponent(panelUrl)}&api_port=${form.api_port}&proxy_port=${form.proxy_port}`
      const fullCmd = `curl -fsSL '${panelUrl}${scriptUrl}' | sudo bash`
      setCmd(fullCmd)
      setStep(2)

      // Poll for node appearance
      const start = Date.now()
      const poll = setInterval(async () => {
        if (Date.now() - start > 30 * 60 * 1000) { clearInterval(poll); return }
        try {
          const r = await fetch('/proxy/nodes')
          const list = await r.json()
          const found = list.find(n => n.name === form.name.trim())
          if (found) {
            clearInterval(poll)
            toast(`Нода "${found.name}" зарегистрирована автоматически!`, 'success')
            onAdded()
            setStep(3)
          }
        } catch {}
      }, 3000)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title="Авто-установка ноды" onClose={onClose} size="xl">
      {step === 1 && (
        <div className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-sm text-red-300">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="p-4 bg-blue-950/30 border border-blue-700/30 rounded-xl space-y-1.5">
            <div className="text-sm font-semibold text-blue-300 flex items-center gap-2">
              <Zap size={14} />Как это работает
            </div>
            <ol className="text-xs text-gray-400 space-y-1 ml-5 list-decimal">
              <li>Вы вводите название ноды и нажимаете «Сгенерировать»</li>
              <li>Панель выдаёт одну команду — вставьте её в терминал VPS</li>
              <li>Скрипт устанавливает telemt, настраивает и запускает его</li>
              <li>Нода автоматически появляется в панели — ничего копировать не нужно</li>
            </ol>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Название ноды *</label>
            <input className="input" placeholder="VPS Berlin" value={form.name}
              onChange={e => set('name', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()} />
          </div>

          <div>
            <button onClick={() => setAdvanced(!advanced)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
              {advanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Расширенные настройки
            </button>
            {advanced && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">API порт</label>
                  <input className="input" type="number" value={form.api_port} onChange={e => set('api_port', e.target.value)} />
                  <p className="text-xs text-gray-600 mt-1">Управляющий API telemt</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-medium">Proxy порт</label>
                  <input className="input" type="number" value={form.proxy_port} onChange={e => set('proxy_port', e.target.value)} />
                  <p className="text-xs text-gray-600 mt-1">MTProxy для клиентов</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 justify-center">Отмена</button>
            <button onClick={generate} disabled={loading} className="btn-primary flex-1 justify-center gap-2">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Terminal size={14} />}
              {loading ? 'Генерация...' : 'Сгенерировать команду'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg flex items-start gap-2 text-xs text-yellow-300">
            <span className="flex-shrink-0 mt-0.5">⏱</span>
            <span>Скрипт установит Rust и соберёт telemt из исходников — это займёт <b>3–8 минут</b>. Не закрывайте терминал VPS.</span>
          </div>

          <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-xl">
            <div className="text-sm font-semibold text-green-300 mb-2 flex items-center gap-2">
              <Terminal size={14} />Команда готова — вставьте на VPS
            </div>
            <div className="relative">
              <pre className="text-xs font-mono text-yellow-200 bg-dark-900 p-3 rounded-lg border border-dark-600 break-all whitespace-pre-wrap pr-24 leading-relaxed">
                {cmd}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyBtn text={cmd} label="Копировать" />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-dark-700/50 rounded-lg border border-dark-600">
            <div className="w-5 h-5 rounded-full bg-blue-600/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <RefreshCw size={10} className="animate-spin text-blue-400" />
            </div>
            <div>
              <div className="text-sm text-gray-300 font-medium">Ожидаю регистрацию ноды...</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Как только скрипт завершится на VPS, нода появится здесь автоматически. Токен действителен 30 минут.
              </div>
            </div>
          </div>

          <details className="group">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 list-none flex items-center gap-1">
              <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
              Что делает скрипт
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-500 ml-4 list-disc">
              <li>Определяет публичный IP сервера</li>
              <li>Скачивает бинарник telemt (x86_64 или aarch64)</li>
              <li>Генерирует случайный секрет для proxy</li>
              <li>Создаёт config.toml и systemd-сервис</li>
              <li>Открывает порты в UFW / firewalld (если активны)</li>
              <li>Запускает telemt и дожидается готовности API</li>
              <li>Регистрирует ноду в этой панели</li>
            </ul>
          </details>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 justify-center">Закрыть</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-600/20 border border-green-500/40 flex items-center justify-center mx-auto">
            <Check size={28} className="text-green-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-white">Нода подключена!</div>
            <div className="text-sm text-gray-500 mt-1">
              «{form.name}» успешно установлена и зарегистрирована
            </div>
          </div>
          <button onClick={onClose} className="btn-primary mx-auto px-8">Отлично!</button>
        </div>
      )}
    </Modal>
  )
}

// ── Manual add/edit modals ─────────────────────────────────────────────────

function AddNodeModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', url: '', auth_token: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const toast = useToast()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) return setError('Введите название')
    if (!form.url.trim()) return setError('Введите URL API')
    setLoading(true); setError(null)
    try {
      await addNode({ name: form.name.trim(), url: form.url.trim(), auth_token: form.auth_token || null })
      toast('Нода добавлена!', 'success')
      onAdded(); onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title="Добавить ноду вручную" onClose={onClose}>
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-sm text-red-300">
            <AlertTriangle size={14} /> {error}
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">Название *</label>
          <input className="input" placeholder="VPS Berlin" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">URL API telemt *</label>
          <input className="input" placeholder="http://1.2.3.4:9091" value={form.url} onChange={e => set('url', e.target.value)} />
          <p className="text-xs text-gray-600 mt-1">По умолчанию — порт 9091</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">Authorization-токен (если настроен)</label>
          <input className="input" placeholder="опционально" value={form.auth_token} onChange={e => set('auth_token', e.target.value)} />
        </div>
        <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-500 text-xs">
          <p className="text-yellow-400 font-medium mb-1">⚠ Разрешите внешний доступ к API на VPS:</p>
          <code className="block text-xs bg-dark-900 px-2 py-1.5 rounded text-green-300">
            [server.api]{'\n'}listen = "0.0.0.0:9091"{'\n'}whitelist = ["0.0.0.0/0"]
          </code>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Отмена</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? 'Добавление...' : 'Добавить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function EditNodeModal({ node, onClose, onUpdated }) {
  const [form, setForm] = useState({ name: node.name, url: node.url, auth_token: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const toast = useToast()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) return setError('Введите название')
    setLoading(true); setError(null)
    try {
      await updateNode(node.id, { name: form.name.trim(), url: form.url.trim(), auth_token: form.auth_token || null })
      toast('Нода обновлена', 'success')
      onUpdated(); onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title={`Редактировать: ${node.name}`} onClose={onClose}>
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-sm text-red-300">
            <AlertTriangle size={14} /> {error}
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">Название</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">URL API</label>
          <input className="input" value={form.url} onChange={e => set('url', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">Новый токен (пусто = не менять)</label>
          <input className="input" placeholder="оставьте пустым для сохранения старого" value={form.auth_token} onChange={e => set('auth_token', e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Отмена</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Nodes() {
  const { nodes, activeNode, selectNode, refresh } = useNode()
  const [modal, setModal] = useState(null)
  const toast = useToast()

  const handleDelete = async (node) => {
    if (!confirm(`Удалить ноду "${node.name}"?`)) return
    try {
      await deleteNode(node.id)
      toast(`Нода "${node.name}" удалена`, 'success')
      refresh()
    } catch (e) { toast('Ошибка: ' + e.message, 'error') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Ноды</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление подключёнными серверами telemt</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModal('manual')} className="btn-ghost">
            <Plus size={14} />
            Вручную
          </button>
          <button onClick={() => setModal('auto')} className="btn-primary">
            <Zap size={14} />
            Авто-установка
          </button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="card text-center py-14">
          <Server size={40} className="mx-auto mb-4 text-gray-700" />
          <div className="text-gray-400 font-medium mb-1">Нет добавленных нод</div>
          <div className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            Используйте авто-установку — она сгенерирует одну команду для вставки в VPS и сделает всё остальное.
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setModal('manual')} className="btn-ghost">
              <Plus size={14} />Вручную
            </button>
            <button onClick={() => setModal('auto')} className="btn-primary">
              <Zap size={14} />Авто-установка
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {nodes.map(node => (
            <div
              key={node.id}
              onClick={() => selectNode(node.id)}
              className={`card cursor-pointer transition-all ${
                activeNode?.id === node.id ? 'border-blue-500/60 bg-blue-950/10' : 'hover:border-dark-400'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    activeNode?.id === node.id ? 'bg-blue-600' : 'bg-dark-600'
                  }`}>
                    <Server size={15} className={activeNode?.id === node.id ? 'text-white' : 'text-gray-400'} />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-white">{node.name}</div>
                    <div className="text-xs text-gray-500 font-mono truncate max-w-[160px]">{node.url}</div>
                  </div>
                </div>
                {activeNode?.id === node.id && <span className="badge-blue flex-shrink-0">Активна</span>}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-600">
                <NodeStatus nodeId={node.id} />
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setModal({ type: 'edit', node })}
                    className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-dark-600 rounded transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(node)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div
            onClick={() => setModal('auto')}
            className="card border-dashed border-dark-500 hover:border-blue-500/40 cursor-pointer transition-all flex flex-col items-center justify-center py-8 gap-2 text-gray-600 hover:text-gray-400"
          >
            <Zap size={20} />
            <span className="text-sm">Добавить ноду</span>
          </div>
        </div>
      )}

      {modal === 'auto' && <AutoInstallModal onClose={() => setModal(null)} onAdded={refresh} />}
      {modal === 'manual' && <AddNodeModal onClose={() => setModal(null)} onAdded={refresh} />}
      {modal?.type === 'edit' && <EditNodeModal node={modal.node} onClose={() => setModal(null)} onUpdated={refresh} />}
    </div>
  )
}
