import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, BarChart2, Shield, Radio, Server, Bot, ChevronDown, Check, Plus } from 'lucide-react'
import { useNode } from '../NodeContext'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/users', icon: Users, label: 'Пользователи' },
  { to: '/stats', icon: BarChart2, label: 'Статистика' },
  { to: '/security', icon: Shield, label: 'Безопасность' },
  { to: '/nodes', icon: Server, label: 'Ноды' },
  { to: '/bot', icon: Bot, label: 'Бот' },
]

function NodePicker() {
  const { nodes, activeNode, selectNode } = useNode()
  const [open, setOpen] = useState(false)

  return (
    <div className="px-3 pb-3 relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-500 transition-colors text-sm"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeNode ? 'bg-green-400' : 'bg-gray-600'}`} />
        <span className="flex-1 text-left truncate text-gray-200 text-xs">
          {activeNode ? activeNode.name : 'Нет нод'}
        </span>
        <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 z-20 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl overflow-hidden">
            {nodes.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-500">Нет добавленных нод</div>
            ) : (
              nodes.map(n => (
                <button
                  key={n.id}
                  onClick={() => { selectNode(n.id); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-300 hover:bg-dark-600 transition-colors"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{n.name}</span>
                  {activeNode?.id === n.id && <Check size={12} className="text-blue-400" />}
                </button>
              ))
            )}
            <NavLink
              to="/nodes"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs text-blue-400 hover:bg-dark-600 border-t border-dark-600 transition-colors"
            >
              <Plus size={12} />
              Добавить ноду
            </NavLink>
          </div>
        </>
      )}
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 bg-dark-800 border-r border-dark-600 flex flex-col">
      <div className="p-5 border-b border-dark-600">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Radio size={16} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Telemt</div>
            <div className="text-xs text-gray-500">MTProxy Panel</div>
          </div>
        </div>
      </div>

      <div className="pt-3">
        <NodePicker />
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-gray-400 hover:bg-dark-700 hover:text-gray-200'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-dark-600">
        <div className="text-xs text-gray-600">v3.4.15</div>
      </div>
    </aside>
  )
}
