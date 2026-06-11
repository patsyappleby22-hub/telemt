import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getNodes } from './nodes'

const NodeContext = createContext(null)

export function NodeProvider({ children }) {
  const [nodes, setNodes] = useState([])
  const [activeNodeId, setActiveNodeId] = useState(() => localStorage.getItem('activeNodeId') || null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const list = await getNodes()
      setNodes(list)
      if (list.length > 0 && (!activeNodeId || !list.find(n => n.id === activeNodeId))) {
        const first = list[0].id
        setActiveNodeId(first)
        localStorage.setItem('activeNodeId', first)
      }
    } catch {}
    finally { setLoading(false) }
  }, [activeNodeId])

  useEffect(() => { refresh() }, [])

  const selectNode = (id) => {
    setActiveNodeId(id)
    localStorage.setItem('activeNodeId', id)
  }

  const activeNode = nodes.find(n => n.id === activeNodeId) || null

  return (
    <NodeContext.Provider value={{ nodes, activeNode, activeNodeId, selectNode, refresh, loading }}>
      {children}
    </NodeContext.Provider>
  )
}

export function useNode() {
  const ctx = useContext(NodeContext)
  if (!ctx) return { nodes: [], activeNode: null, activeNodeId: null, selectNode: () => {}, refresh: () => {}, loading: true }
  return ctx
}
