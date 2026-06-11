import React, { useState, useEffect, useCallback } from 'react'
import { Activity, Users, Wifi, Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw, Server, Zap } from 'lucide-react'
import StatCard from '../components/StatCard'
import { api, formatUptime, formatBytes } from '../api'
import { useToast } from '../components/Toast'

function UpstreamBadge({ healthy }) {
  return healthy
    ? <span className="badge-green"><CheckCircle size={10} />Онлайн</span>
    : <span className="badge-red"><XCircle size={10} />Офлайн</span>
}

export default function Dashboard() {
  const [health, setHealth] = useState(null)
  const [ready, setReady] = useState(null)
  const [sysInfo, setSysInfo] = useState(null)
  const [summary, setSummary] = useState(null)
  const [upstreams, setUpstreams] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const toast = useToast()

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [h, r, s, sum, up] = await Promise.allSettled([
        api.health(),
        api.healthReady(),
        api.systemInfo(),
        api.statsSummary(),
        api.statsUpstreams(),
      ])
      if (h.status === 'fulfilled') setHealth(h.value?.data)
      if (r.status === 'fulfilled') setReady(r.value?.data)
      if (s.status === 'fulfilled') setSysInfo(s.value?.data)
      if (sum.status === 'fulfilled') setSummary(sum.value?.data)
      if (up.status === 'fulfilled') setUpstreams(up.value?.data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = setInterval(() => load(), 15000)
    return () => clearInterval(timer)
  }, [load])

  const serverOffline = error && !health

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Дашборд</h1>
          <p className="text-sm text-gray-500 mt-0.5">Мониторинг состояния сервера</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-ghost gap-2"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {serverOffline && (
        <div className="card border-red-800/50 bg-red-950/20 flex items-center gap-3">
          <XCircle size={18} className="text-red-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-red-300">Сервер недоступен</div>
            <div className="text-xs text-red-500 mt-0.5">
              API telemt не отвечает. Убедитесь, что сервис запущен на порту 9091.
            </div>
          </div>
        </div>
      )}

      {health && (
        <div className={`card border flex items-center gap-3 ${
          health.status === 'ok'
            ? 'border-green-800/40 bg-green-950/10'
            : 'border-yellow-800/40 bg-yellow-950/10'
        }`}>
          {health.status === 'ok'
            ? <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
            : <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
          }
          <div className="flex-1">
            <div className="text-sm font-medium text-white">
              Статус: {health.status === 'ok' ? 'Работает' : health.status}
              {health.read_only && <span className="ml-2 badge-yellow">Только чтение</span>}
            </div>
            {ready && (
              <div className="text-xs text-gray-500 mt-0.5">
                Апстримов: {ready.healthy_upstreams}/{ready.total_upstreams} активны
                {ready.ready ? '' : ` · ${ready.reason || 'не готов'}`}
              </div>
            )}
          </div>
          {sysInfo && (
            <div className="text-xs text-gray-500 text-right">
              <div>v{sysInfo.version}</div>
              <div>uptime: {formatUptime(sysInfo.uptime_seconds)}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Соединений"
          value={summary?.connections_total?.toLocaleString()}
          sub="всего за время работы"
          icon={Activity}
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Пользователей"
          value={summary?.configured_users}
          sub="настроено"
          icon={Users}
          color="purple"
          loading={loading}
        />
        <StatCard
          title="Плохих соед."
          value={summary?.connections_bad_total?.toLocaleString()}
          sub="отклонено/ошибок"
          icon={AlertTriangle}
          color="yellow"
          loading={loading}
        />
        <StatCard
          title="Uptime"
          value={summary ? formatUptime(summary.uptime_seconds) : null}
          sub="время работы"
          icon={Clock}
          color="green"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Wifi size={15} className="text-blue-400" />
            Апстримы (DC)
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-dark-700 animate-pulse rounded-lg" />)}
            </div>
          ) : upstreams?.upstreams?.length > 0 ? (
            <div className="space-y-2">
              {upstreams.upstreams.map((u) => (
                <div key={u.upstream_id} className="flex items-center gap-3 p-3 bg-dark-700/60 rounded-lg">
                  <UpstreamBadge healthy={u.healthy} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{u.address}</div>
                    <div className="text-xs text-gray-500">
                      {u.route_kind} · вес {u.weight} · {u.scopes}
                    </div>
                  </div>
                  <div className="text-xs text-right text-gray-400">
                    {u.effective_latency_ms != null
                      ? `${u.effective_latency_ms.toFixed(0)}мс`
                      : '—'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 text-sm">
              {error ? 'Нет данных' : 'Апстримы не настроены'}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Zap size={15} className="text-yellow-400" />
            Ошибки по типам
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-8 bg-dark-700 animate-pulse rounded" />)}
            </div>
          ) : summary?.connections_bad_by_class?.length > 0 ? (
            <div className="space-y-2">
              {summary.connections_bad_by_class.map((c) => (
                <div key={c.class} className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 w-40 truncate">{c.class}</div>
                  <div className="flex-1 bg-dark-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-red-500/70 rounded-full"
                      style={{ width: `${Math.min(100, (c.total / (summary.connections_bad_total || 1)) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 w-12 text-right">{c.total}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 text-sm">
              {error ? 'Нет данных' : 'Ошибок не зафиксировано'}
            </div>
          )}

          {summary?.handshake_failures_by_class?.length > 0 && (
            <>
              <div className="text-xs font-medium text-gray-500 mt-4 mb-2">Ошибки рукопожатия</div>
              <div className="space-y-2">
                {summary.handshake_failures_by_class.map((c) => (
                  <div key={c.class} className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 w-40 truncate">{c.class}</div>
                    <div className="flex-1 bg-dark-700 rounded-full h-2">
                      <div className="h-full bg-yellow-500/70 rounded-full" style={{ width: '20%' }} />
                    </div>
                    <div className="text-xs text-gray-400 w-12 text-right">{c.total}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Server size={15} className="text-purple-400" />
          Информация о системе
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-dark-700 animate-pulse rounded" />)}
          </div>
        ) : sysInfo ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(sysInfo).map(([k, v]) => (
              <div key={k} className="p-3 bg-dark-700/50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1 capitalize">{k.replace(/_/g, ' ')}</div>
                <div className="text-sm font-medium text-white break-all">
                  {typeof v === 'number' && k.includes('uptime')
                    ? formatUptime(v)
                    : String(v)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-600 text-sm">Нет данных</div>
        )}
      </div>
    </div>
  )
}
