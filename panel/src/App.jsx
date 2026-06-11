import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Stats from './pages/Stats'
import Security from './pages/Security'
import Nodes from './pages/Nodes'
import Bot from './pages/Bot'
import { ToastProvider } from './components/Toast'
import { NodeProvider } from './NodeContext'

export default function App() {
  return (
    <ToastProvider>
      <NodeProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="stats" element={<Stats />} />
            <Route path="security" element={<Security />} />
            <Route path="nodes" element={<Nodes />} />
            <Route path="bot" element={<Bot />} />
          </Route>
        </Routes>
      </NodeProvider>
    </ToastProvider>
  )
}
