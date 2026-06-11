import React, { useState, useEffect, useCallback } from 'react'
import { Shield, RefreshCw, CheckCircle, XCircle, Lock, Wifi, List } from 'lucide-react'
import { api } from '../api'

function BoolRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-dark-700 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      {value
        ? <span className="badge-green"><CheckCircle size={10} />Включено</span>
        : <span className="badge-red"><XCircle size={10} />Выключено</span>
      }
    </div>
  )
}

function ValueRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-dark-700 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      <span className="text-sm font-mono text-gray-200">{value ?? '—'}</span>
    </div>
  )
}

export default function Security() {
  const [posture, setPosture] = useState(null)
  const [whitelist, setWhitelist] = useState(null)
  const [limits, setLimits] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [p, w, l] = await Promise.allSettled([
        api.securityPosture(),
        api.securityWhitelist(),
        api.limitsEffective(),
      ])
      if (p.status === 'fulfilled') setPosture(p.value?.data)
      if (w.status === 'fulfilled') setWhitelist(w.value?.data)
      if (l.status === 'fulfilled') setLimits(l.value?.data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Безопасность</h1>
          <p className="text-sm text-gray-500 mt-0.5">Защита и конфигурация безопасности</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="btn-ghost">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="card h-40 animate-pulse bg-dark-700" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {posture && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Lock size={15} className="text-blue-400" />
                Уровень защиты
              </h2>
              <div>
                {Object.entries(posture).map(([k, v]) => {
                  if (typeof v === 'boolean') {
                    return <BoolRow key={k} label={k.replace(/_/g, ' ')} value={v} />
                  }
                  if (typeof v === 'string' || typeof v === 'number') {
                    return <ValueRow key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                  }
                  return null
                })}
              </div>
            </div>
          )}

          {whitelist && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <List size={15} className="text-green-400" />
                Белые списки API
              </h2>
              {Object.entries(whitelist).map(([section, entries]) => (
                <div key={section} className="mb-4 last:mb-0">
                  <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">{section}</div>
                  {Array.isArray(entries) && entries.length > 0 ? (
                    <div className="space-y-1">
                      {entries.map((e, i) => (
                        <div key={i} className="px-3 py-1.5 bg-dark-700 rounded text-xs font-mono text-gray-300">
                          {e}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 italic">Пусто</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {limits && (
            <div className="card lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Wifi size={15} className="text-yellow-400" />
                Лимиты системы
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(limits).map(([k, v]) => (
                  <div key={k} className="p-3 bg-dark-700/60 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1 capitalize">{k.replace(/_/g, ' ')}</div>
                    <div className="text-sm font-semibold text-white">{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!posture && !whitelist && !limits && (
            <div className="lg:col-span-2 text-center py-16 text-gray-600">
              <Shield size={40} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">Сервер недоступен — запустите telemt</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
