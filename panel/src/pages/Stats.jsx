import React, { useState, useEffect, useCallback } from 'react'
import { BarChart2, RefreshCw, Users, Wifi, Cpu, Database } from 'lucide-react'
import { api, formatBytes, formatUptime } from '../api'

function Section({ title, icon: Icon, color, children }) {
  const colors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
  }
  return (
    <div className="card">
      <h2 className={`text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2`}>
        <Icon size={15} className={colors[color]} />
        {title}
      </h2>
      {children}
    </div>
  )
}

function KVGrid({ data, keyMap }) {
  const entries = keyMap
    ? keyMap.map(([k, label, fmt]) => {
        const v = data[k]
        return [label, fmt ? fmt(v) : v]
      })
    : Object.entries(data).map(([k, v]) => [k.replace(/_/g, ' '), String(v)])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {entries.map(([label, value]) => (
        <div key={label} className="p-3 bg-dark-700/60 rounded-lg">
          <div className="text-xs text-gray-500 mb-1 capitalize">{label}</div>
          <div className="text-sm font-semibold text-white">{value ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}

export default function Stats() {
  const [zero, setZero] = useState(null)
  const [usersStats, setUsersStats] = useState(null)
  const [quota, setQuota] = useState(null)
  const [minimal, setMinimal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [z, u, q, m] = await Promise.allSettled([
        api.statsZeroAll(),
        api.statsUsers(),
        api.statsUsersQuota(),
        api.statsMinimalAll(),
      ])
      if (z.status === 'fulfilled') setZero(z.value?.data)
      if (u.status === 'fulfilled') setUsersStats(u.value?.data)
      if (q.status === 'fulfilled') setQuota(q.value?.data)
      if (m.status === 'fulfilled') setMinimal(m.value?.data)
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
          <h1 className="text-xl font-bold text-white">Статистика</h1>
          <p className="text-sm text-gray-500 mt-0.5">Детальные метрики сервера</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="btn-ghost">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="card h-36 animate-pulse bg-dark-700" />)}
        </div>
      ) : (
        <>
          {zero?.core && (
            <Section title="Ядро" icon={Cpu} color="blue">
              <KVGrid data={zero.core} keyMap={[
                ['uptime_seconds', 'Uptime', formatUptime],
                ['connections_total', 'Всего соед.', v => v?.toLocaleString()],
                ['connections_bad_total', 'Плохих соед.', v => v?.toLocaleString()],
                ['handshake_timeouts_total', 'Таймаутов', v => v?.toLocaleString()],
                ['configured_users', 'Пользователей', null],
                ['accept_permit_timeout_total', 'Accept-таймаутов', v => v?.toLocaleString()],
                ['telemetry_core_enabled', 'Телеметрия', v => v ? 'Вкл' : 'Выкл'],
                ['conntrack_pressure_active', 'Conntrack давление', v => v ? 'Да' : 'Нет'],
                ['conntrack_delete_attempt_total', 'Conntrack удалений', v => v?.toLocaleString()],
              ]} />
            </Section>
          )}

          {zero?.upstream && (
            <Section title="Апстримы" icon={Wifi} color="green">
              <KVGrid data={zero.upstream} keyMap={[
                ['connect_attempt_total', 'Попыток подкл.', v => v?.toLocaleString()],
                ['connect_success_total', 'Успешных', v => v?.toLocaleString()],
                ['connect_fail_total', 'Ошибок', v => v?.toLocaleString()],
                ['connect_attempts_bucket_1', '1 попытка', v => v?.toLocaleString()],
                ['connect_attempts_bucket_2', '2 попытки', v => v?.toLocaleString()],
                ['connect_attempts_bucket_3_4', '3-4 попытки', v => v?.toLocaleString()],
                ['connect_attempts_bucket_gt_4', '>4 попыток', v => v?.toLocaleString()],
                ['connect_duration_success_bucket_le_100ms', '≤100мс', v => v?.toLocaleString()],
                ['connect_duration_success_bucket_101_500ms', '101-500мс', v => v?.toLocaleString()],
                ['connect_duration_success_bucket_gt_1000ms', '>1000мс', v => v?.toLocaleString()],
              ]} />
            </Section>
          )}

          {zero?.middle_proxy && (
            <Section title="Middle Proxy" icon={BarChart2} color="purple">
              <KVGrid data={zero.middle_proxy} keyMap={[
                ['reconnect_attempt_total', 'Реконнектов', v => v?.toLocaleString()],
                ['reconnect_success_total', 'Успешных', v => v?.toLocaleString()],
                ['handshake_reject_total', 'Rejected хэндш.', v => v?.toLocaleString()],
                ['keepalive_sent_total', 'Keepalive отпр.', v => v?.toLocaleString()],
                ['keepalive_failed_total', 'Keepalive ошибок', v => v?.toLocaleString()],
                ['d2c_batches_total', 'D2C батчей', v => v?.toLocaleString()],
                ['d2c_payload_bytes_total', 'D2C байт', v => formatBytes(v)],
                ['route_drop_queue_full_total', 'Очередь полна', v => v?.toLocaleString()],
                ['endpoint_quarantine_total', 'Карантин', v => v?.toLocaleString()],
              ]} />
            </Section>
          )}

          {zero?.pool && (
            <Section title="Пул соединений" icon={Database} color="yellow">
              <KVGrid data={zero.pool} keyMap={[
                ['pool_swap_total', 'Свапов пула', v => v?.toLocaleString()],
                ['pool_drain_active', 'Drain активных', v => v?.toLocaleString()],
                ['writer_removed_total', 'Writers удалено', v => v?.toLocaleString()],
                ['refill_triggered_total', 'Refill запусков', v => v?.toLocaleString()],
                ['refill_failed_total', 'Refill ошибок', v => v?.toLocaleString()],
              ]} />
            </Section>
          )}

          {quota?.users?.length > 0 && (
            <Section title="Квота пользователей" icon={Users} color="green">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-dark-600">
                      <th className="pb-2 font-medium">Пользователь</th>
                      <th className="pb-2 font-medium">Лимит</th>
                      <th className="pb-2 font-medium">Использовано</th>
                      <th className="pb-2 font-medium">Прогресс</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quota.users.map((u) => {
                      const pct = u.data_quota_bytes > 0
                        ? Math.min(100, (u.used_bytes / u.data_quota_bytes) * 100)
                        : 0
                      return (
                        <tr key={u.username} className="table-row-hover">
                          <td className="py-2 pr-4 font-mono text-gray-200">{u.username}</td>
                          <td className="py-2 pr-4 text-gray-400">{formatBytes(u.data_quota_bytes)}</td>
                          <td className="py-2 pr-4 text-gray-300">{formatBytes(u.used_bytes)}</td>
                          <td className="py-2 w-32">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-dark-600 rounded-full h-1.5">
                                <div
                                  className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {!zero && !usersStats && !quota && (
            <div className="text-center py-16 text-gray-600">
              <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">Сервер недоступен — запустите telemt</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
