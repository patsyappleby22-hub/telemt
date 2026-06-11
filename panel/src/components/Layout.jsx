import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Radio } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-dark-900">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-30
        transform transition-transform duration-200 ease-in-out
        md:static md:translate-x-0 md:transition-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-dark-800 border-b border-dark-600 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-dark-700 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Radio size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm text-white">Telemt Panel</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
