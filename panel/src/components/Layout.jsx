import React, { useState, useEffect, useCallback } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Network, ChevronDown, Check, Plus, Settings, CheckCircle2, AlertTriangle, Menu, X } from 'lucide-react'
import { useNode } from '../NodeContext'
import { makeApi } from '../api'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/bot', label: 'Пользователи' },
  { to: '/stats', label: 'Статистика' },
  { to: '/security', label: 'Безопасность' },
  { to: '/nodes', label: 'Ноды' },
]

function NodeSelector() {
  const { nodes, activeNode, selectNode } = useNode()
  const [open, setOpen] = useState(false)

  const visible = nodes.slice(0, 3)
  const overflow = nodes.slice(3)
  const hasOverflow = overflow.length > 0

  return (
    <div className="flex items-center gap-1 bg-[#181b22] p-1 rounded-lg border border-[#252830]">
      {nodes.length === 0 ? (
        <span className="px-3 py-1.5 text-xs text-slate-600">Нет нод</span>
      ) : (
        visible.map(n => (
          <button
            key={n.id}
            onClick={() => selectNode(n.id)}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              n.id === activeNode?.id
                ? 'bg-[#252830] text-white shadow-sm ring-1 ring-[#353840]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e2028]'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
              n.id === activeNode?.id
                ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]'
                : 'bg-emerald-500'
            }`} />
            {n.name}
          </button>
        ))
      )}

      {(hasOverflow || nodes.length === 0) && (
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center justify-center rounded px-2 py-1.5 text-slate-500 hover:text-slate-300 hover:bg-[#1e2028] transition-colors"
          >
            <ChevronDown size={13} />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 bg-[#181b22] border border-[#252830] rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
                {overflow.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { selectNode(n.id); setOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-300 hover:bg-[#1e2028] transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{n.name}</span>
                    {activeNode?.id === n.id && <Check size={12} className="text-cyan-400" />}
                  </button>
                ))}
                <NavLink
                  to="/nodes"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs text-cyan-400 hover:bg-[#1e2028] border-t border-[#252830] transition-colors"
                >
                  <Plus size={12} />
                  Добавить ноду
                </NavLink>
              </div>
            </>
          )}
        </div>
      )}

      <NavLink
        to="/nodes"
        className="flex items-center justify-center rounded px-2 py-1.5 text-slate-500 hover:text-slate-300 hover:bg-[#1e2028] transition-colors"
        title="Управление нодами"
      >
        <Plus size={13} />
      </NavLink>
    </div>
  )
}

export default function Layout() {
  const { activeNode } = useNode()
  const [health, setHealth] = useState(null)
  const [navOpen, setNavOpen] = useState(false)

  const checkHealth = useCallback(async () => {
    if (!activeNode) { setHealth(null); return }
    try {
      const api = makeApi(activeNode.id)
      const res = await api.health()
      setHealth(res?.data || null)
    } catch {
      setHealth({ status: 'error' })
    }
  }, [activeNode?.id])

  useEffect(() => { checkHealth() }, [activeNode?.id])
  useEffect(() => {
    const t = setInterval(checkHealth, 30000)
    return () => clearInterval(t)
  }, [checkHealth])

  const isHealthy = health?.status === 'ok'
  const isError = health?.status === 'error'

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[#1e2028] bg-[#0f1115]/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-[#0f1115]/80">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
              <Network size={17} className="text-cyan-400" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-100">TELEMT</span>
          </div>

          <div className="hidden md:block h-4 w-px bg-[#252830]" />

          <div className="hidden md:flex">
            <NodeSelector />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {activeNode && health && (
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isError
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : isHealthy
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              {isError
                ? <AlertTriangle size={12} />
                : <CheckCircle2 size={12} />}
              {isError ? 'Ошибка' : isHealthy ? 'Стабильно' : 'Внимание'}
            </div>
          )}
          <NavLink
            to="/nodes"
            className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2028] transition-colors"
            title="Настройки нод"
          >
            <Settings size={15} />
          </NavLink>
          <button
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2028] transition-colors"
            onClick={() => setNavOpen(!navOpen)}
          >
            {navOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {navOpen && (
        <div className="md:hidden border-b border-[#1e2028] bg-[#0f1115] px-4 pb-3 pt-2 space-y-2">
          <NodeSelector />
          <nav className="flex flex-wrap gap-1 pt-1">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e2028]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      <div className="mx-auto max-w-[1600px] px-4">
        <div className="hidden md:flex items-center border-b border-[#1e2028]/60 py-3">
          <nav className="flex gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e2028]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <main className="py-4 md:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
