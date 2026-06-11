import React, { useState } from 'react'
import { Server, Plus, Trash2, Edit2, Check, X, AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useNode } from '../NodeContext'
import { addNode, updateNode, deleteNode } from '../nodes'
import { makeApi } from '../api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

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
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={check}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 transition-colors"
      title="Проверить доступность"
    >
      {loading ? (
        <RefreshCw size={12} className="animate-spin" />
      ) : status === null ? (
        <Wifi size={12} />
      ) : status.ok ? (
        <Wifi size={12} className="text-green-400" />
      ) : (
        <WifiOff size={12} className="text-red-400" />
      )}
      {status ? (
        <span className={status.ok ? 'text-green-400' : 'text-red-400'}>
          {status.ok ? 'Онлайн' : 'Офлайн'}
        </span>
      ) : (
        <span>Проверить</span>
      )}
    </button>
  )
}

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
      onAdded()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Добавить ноду" onClose={onClose}>
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
          <input
            className="input"
            placeholder="http://1.2.3.4:9091"
            value={form.url}
            onChange={e => set('url', e.target.value)}
          />
          <p className="text-xs text-gray-600 mt-1">
            Адрес HTTP API вашего telemt-сервера. По умолчанию — порт 9091.
          </p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">Authorization-токен (если настроен)</label>
          <input className="input" placeholder="опционально" value={form.auth_token} onChange={e => set('auth_token', e.target.value)} />
        </div>
        <div className="p-3 bg-dark-700/50 rounded-lg border border-dark-500">
          <p className="text-xs text-yellow-400 font-medium mb-1">⚠ Важно: разрешите доступ к API</p>
          <p className="text-xs text-gray-500">
            В <code className="text-gray-300">config.toml</code> на вашем VPS добавьте IP этой панели в <code className="text-gray-300">whitelist</code>:
          </p>
          <code className="block mt-2 text-xs bg-dark-900 px-2 py-1.5 rounded text-green-300">
            [server.api]{'\n'}whitelist = ["0.0.0.0/0"]
          </code>
          <p className="text-xs text-gray-600 mt-1">или укажите конкретный IP Replit вместо 0.0.0.0/0</p>
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
      await updateNode(node.id, {
        name: form.name.trim(),
        url: form.url.trim(),
        auth_token: form.auth_token || null
      })
      toast('Нода обновлена', 'success')
      onUpdated()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
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
    } catch (e) {
      toast('Ошибка: ' + e.message, 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Ноды</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление подключёнными серверами telemt</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary">
          <Plus size={15} />
          Добавить ноду
        </button>
      </div>

      {nodes.length === 0 ? (
        <div className="card text-center py-16">
          <Server size={40} className="mx-auto mb-4 text-gray-700" />
          <div className="text-gray-400 font-medium mb-2">Нет добавленных нод</div>
          <div className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            Добавьте ваши VPS-серверы с запущенным telemt. Панель подключится к их API и вы сможете управлять всеми нодами из одного места.
          </div>
          <button onClick={() => setModal('add')} className="btn-primary mx-auto">
            <Plus size={15} />
            Добавить первую ноду
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {nodes.map(node => (
            <div
              key={node.id}
              onClick={() => selectNode(node.id)}
              className={`card cursor-pointer transition-all ${
                activeNode?.id === node.id
                  ? 'border-blue-500/60 bg-blue-950/10'
                  : 'hover:border-dark-400'
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
                {activeNode?.id === node.id && (
                  <span className="badge-blue flex-shrink-0">Активна</span>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-600">
                <NodeStatus nodeId={node.id} />
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setModal({ type: 'edit', node })}
                    className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-dark-600 rounded transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(node)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card border-dark-600">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Как подключить VPS</h3>
        <ol className="space-y-3 text-sm text-gray-400">
          <li className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
            <div>
              Установите telemt на VPS: <code className="text-xs bg-dark-700 px-1.5 py-0.5 rounded text-gray-300">curl -fsSL https://raw.githubusercontent.com/telemt/telemt/main/install.sh | sh</code>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
            <div>
              В <code className="text-xs bg-dark-700 px-1.5 py-0.5 rounded text-gray-300">config.toml</code> разрешите внешний доступ к API:
              <code className="block mt-1 text-xs bg-dark-900 px-2 py-1.5 rounded text-green-300">
                [server.api]{'\n'}listen = "0.0.0.0:9091"{'\n'}whitelist = ["0.0.0.0/0"]
              </code>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
            <div>Откройте порт 9091 в firewall вашего VPS (если есть UFW: <code className="text-xs bg-dark-700 px-1.5 py-0.5 rounded text-gray-300">ufw allow 9091</code>)</div>
          </li>
          <li className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">4</span>
            <div>Добавьте ноду в панели с URL <code className="text-xs bg-dark-700 px-1.5 py-0.5 rounded text-gray-300">http://IP_ВАШЕГО_VPS:9091</code></div>
          </li>
        </ol>
      </div>

      {modal === 'add' && (
        <AddNodeModal onClose={() => setModal(null)} onAdded={refresh} />
      )}
      {modal?.type === 'edit' && (
        <EditNodeModal node={modal.node} onClose={() => setModal(null)} onUpdated={refresh} />
      )}
    </div>
  )
}
