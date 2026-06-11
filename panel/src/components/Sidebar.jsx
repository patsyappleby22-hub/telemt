import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, BarChart2, Shield, Radio } from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/users', icon: Users, label: 'Пользователи' },
  { to: '/stats', icon: BarChart2, label: 'Статистика' },
  { to: '/security', icon: Shield, label: 'Безопасность' },
]

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
      <nav className="flex-1 p-3 space-y-0.5">
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
