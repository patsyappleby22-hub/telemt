import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, size = 'md' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const sizes = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-3xl' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-full ${sizes[size]} bg-dark-800 border border-dark-600 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]`}>
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-dark-500" />
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-600 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-dark-700">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}
