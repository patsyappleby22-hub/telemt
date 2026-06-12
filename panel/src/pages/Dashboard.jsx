import React, { useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Users, Activity, AlertTriangle, Clock,
  Globe, Server, ArrowUpRight, CheckCircle2, XCircle,
  RefreshCw, Plus
} from 'lucide-react'
import { makeApi, formatUptime } from '../api'
import { useNode } from '../NodeContext'

function StatCard({ title, value, sub, icon: Icon, loading, accent = 'cyan', trend }) {
  const accentMap = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
  }
  const cls = accentMap[accent] || accentMap.cyan

  return (
    <div className="bg-[#15181e] border border-[#252830] rounded-xl p-5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity pointer-events-none">
        <Icon size={64} />
      </div>
      <div className="text-xs font-medium text-slate-400 mb-2">{title}</div>
      {loading ? (
        <div className="h-9 w-24 bg-[#1e2028] animate-pulse rounded-lg mb-1" />
      ) : (
        <div className="text-4xl font-light tracking-tight text-white flex items-baseline gap-2">
          {value ?? '—'}
          {trend && (
            <span className="text-sm font-medium text-emerald-400 flex items-center">
              <ArrowUpRight size={12} className="mr-0.5" />{trend}
            </span>
          )}
        </div>
      )}
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${cls.split(' ')[1]} opacity-0 group-hover:opacity-100 transition-opacity`} />
    </div>
  )
}

function QualityBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const color = pct < 30 ? 'bg-emerald-500' : pct < 70 ? 'bg-cyan-500' : pct < 90 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="w-16 bg-[#1e2028] rounded-full h-1.5 overflow-hidden">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function LatencyColor({ ms }) {
  if (ms == null) return <span className="text-slate-600 font-mono">—</span>
  const cls = ms < 50 ? 'text-emerald-400' : ms < 150 ? 'text-amber-400' : 'text-rose-400'
  return <span className={`font-mono ${cls}`}>{Math.round(ms)} мс</span>
}

export default function Dashboard() {
  const { activeNode } = useNode()
  const [summary, setSummary] = useState(null)
  const [upstreams, setUpstreams] = useState(null)
  const [sysInfo, setSysInfo] = useState(null)
  const [ready, setReady] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (!activeNode) { setLoading(false); return }
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    const api = makeApi(activeNode.id)
    try {
      const [sumRes, upRes, sysRes, readyRes] = await Promise.allSettled([
        api.statsSummary(),
        api.statsUpstreams(),
        api.systemInfo(),
        api.healthReady(),
      ])
      setSummary(sumRes.status === 'fulfilled' ? sumRes.value?.data : null)
      setUpstreams(upRes.status === 'fulfilled' ? upRes.value?.data : null)
      setSysInfo(sysRes.status === 'fulfilled' ? sysRes.value?.data : null)
      setReady(readyRes.status === 'fulfilled' ? readyRes.value?.data : null)
      const allFailed = [sumRes, upRes, sysRes, readyRes].every(r => r.status === 'rejected')
      setError(allFailed ? (sumRes.reason?.message || 'Нода недоступна') : null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeNode?.id])

  useEffect(() => { load() }, [activeNode?.id])
  useEffect(() => {
    const t = setInterval(() => load(), 15000)
    return () => clearInterval(t)
  }, [load])

  if (!activeNode) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#15181e] border border-[#252830] flex items-center justify-center mb-5">
          <Server size={28} className="text-slate-600" />
        </div>
        <div className="text-slate-300 font-medium text-lg mb-1">Нода не выбрана</div>
        <div className="text-sm text-slate-600 mb-5">Добавьте и выберите ноду для начала работы</div>
        <NavLink
          to="/nodes"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20 text-sm font-medium hover:bg-cyan-500/20 transition-colors"
        >
          <Plus size={14} />
          Перейти к нодам
        </NavLink>
      </div>
    )
  }

  const ups = upstreams?.upstreams || []
  const maxLatency = ups.reduce((m, u) => Math.max(m, u.effective_latency_ms || 0), 0)
  const badClasses = summary?.connections_bad_by_class || []
  const totalBad = summary?.connections_bad_total || 0

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <XCircle size={16} className="text-rose-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-rose-300">Нода недоступна</div>
            <div className="text-xs text-rose-500/80 mt-0.5">{error}</div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs hover:bg-rose-500/20 transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Повторить
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Пользователей"
          value={summary?.configured_users?.toLocaleString('ru-RU')}
          sub="настроено в системе"
          icon={Users}
          loading={loading}
          accent="cyan"
        />
        <StatCard
          title="Соединений"
          value={summary?.connections_total?.toLocaleString('ru-RU')}
          sub="всего за время работы"
          icon={Activity}
          loading={loading}
          accent="emerald"
        />
        <StatCard
          title="Отклонено"
          value={summary?.connections_bad_total?.toLocaleString('ru-RU')}
          sub="ошибок соединений"
          icon={AlertTriangle}
          loading={loading}
          accent="amber"
        />
        <StatCard
          title="Uptime"
          value={summary ? formatUptime(summary.uptime_seconds) : null}
          sub={sysInfo ? `v${sysInfo.version}` : 'время работы'}
          icon={Clock}
          loading={loading}
          accent="emerald"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Upstream Routing Table */}
        <div className="lg:col-span-8 bg-[#15181e] border border-[#252830] rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#252830]">
            <div>
              <div className="text-sm font-medium text-slate-200">Маршрутизация DC Telegram</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Задержки и доступность апстримов
                {ready && (
                  <span className="ml-2 text-slate-600">
                    · {ready.healthy_upstreams}/{ready.total_upstreams} активны
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 hidden sm:inline">Обновление: 15 сек</span>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e2028] transition-colors"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-10 bg-[#1a1d24] animate-pulse rounded-lg" />
              ))}
            </div>
          ) : ups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] font-medium text-slate-500 uppercase tracking-wider bg-[#12151a] border-b border-[#252830]">
                  <tr>
                    <th className="px-5 py-3 text-left">Адрес</th>
                    <th className="px-5 py-3 text-left hidden sm:table-cell">Тип</th>
                    <th className="px-5 py-3 text-right">Пинг</th>
                    <th className="px-5 py-3 text-right">Нагрузка</th>
                    <th className="px-5 py-3">Состояние</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2028]">
                  {ups.map((u, i) => (
                    <tr key={i} className="hover:bg-[#1a1d24] transition-colors group">
                      <td className="px-5 py-3 font-medium text-slate-300 flex items-center gap-2">
                        <Globe size={13} className="text-slate-500 flex-shrink-0" />
                        <span className="font-mono text-xs">{u.address}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 hidden sm:table-cell capitalize">
                        {u.route_kind || '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <LatencyColor ms={u.effective_latency_ms} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end">
                          <QualityBar value={u.effective_latency_ms || 0} max={maxLatency || 1} />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {u.healthy ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={10} />Онлайн
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle size={10} />Офлайн
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <Globe size={32} className="mb-3 opacity-40" />
              <div className="text-sm">{error ? 'Нет данных' : 'Апстримы не настроены'}</div>
            </div>
          )}
        </div>

        {/* Right column: Error breakdown + System Info */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Error breakdown */}
          <div className="bg-[#15181e] border border-[#252830] rounded-xl flex flex-col overflow-hidden flex-1">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#252830]">
              <div className="text-sm font-medium text-slate-200">Сбои по типам</div>
              {totalBad > 0 && (
                <span className="text-xs font-mono text-slate-500">{totalBad.toLocaleString('ru-RU')} всего</span>
              )}
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-7 bg-[#1a1d24] animate-pulse rounded" />)}
              </div>
            ) : badClasses.length > 0 ? (
              <div className="p-4 space-y-3">
                {badClasses.map((c) => {
                  const pct = totalBad > 0 ? Math.min(100, (c.total / totalBad) * 100) : 0
                  return (
                    <div key={c.class}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400 truncate max-w-[60%]">{c.class}</span>
                        <span className="text-xs font-mono text-slate-500">{c.total.toLocaleString('ru-RU')}</span>
                      </div>
                      <div className="w-full bg-[#1e2028] rounded-full h-1">
                        <div className="h-1 bg-rose-500/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                <CheckCircle2 size={28} className="mb-2 text-emerald-500/40" />
                <div className="text-sm">{error ? 'Нет данных' : 'Сбоев не зафиксировано'}</div>
              </div>
            )}
          </div>

          {/* System info compact */}
          {sysInfo && (
            <div className="bg-[#15181e] border border-[#252830] rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Система</div>
              <div className="space-y-2">
                {[
                  ['Версия', `v${sysInfo.version}`],
                  ['Uptime', formatUptime(sysInfo.uptime_seconds)],
                  sysInfo.os_version ? ['ОС', sysInfo.os_version] : null,
                  sysInfo.cpu_model ? ['CPU', sysInfo.cpu_model] : null,
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{k}</span>
                    <span className="text-xs font-mono text-slate-300 truncate max-w-[60%] text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
