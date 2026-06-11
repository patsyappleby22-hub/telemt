import React, { useState, useCallback, createContext, useContext } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const remove = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map(({ id, message, type }) => (
          <div
            key={id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium max-w-sm animate-in slide-in-from-right ${
              type === 'success'
                ? 'bg-dark-800 border-green-700/50 text-green-300'
                : 'bg-dark-800 border-red-700/50 text-red-300'
            }`}
          >
            {type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span className="flex-1">{message}</span>
            <button onClick={() => remove(id)} className="opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
