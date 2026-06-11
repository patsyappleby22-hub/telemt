import React from 'react'

export default function StatCard({ title, value, sub, icon: Icon, color = 'blue', loading }) {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10',
    green: 'text-green-400 bg-green-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
    red: 'text-red-400 bg-red-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  }
  return (
    <div className="card flex items-start gap-4">
      {Icon && (
        <div className={`p-2.5 rounded-lg flex-shrink-0 ${colors[color]}`}>
          <Icon size={20} className={colors[color].split(' ')[0]} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">{title}</div>
        {loading ? (
          <div className="h-7 w-20 bg-dark-600 animate-pulse rounded" />
        ) : (
          <div className="text-2xl font-bold text-white">{value ?? '—'}</div>
        )}
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </div>
    </div>
  )
}
