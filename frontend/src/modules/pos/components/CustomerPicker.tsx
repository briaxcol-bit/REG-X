import { useState } from 'react'
import { Search, X, UserCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCustomers } from '@modules/customers/hooks/useCustomers'

interface CustomerPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (customerId: string) => void
}

export function CustomerPicker({ open, onClose, onSelect }: CustomerPickerProps) {
  const [search, setSearch] = useState('')
  const { data: customers = [] } = useCustomers({ search, limit: 20 })

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed left-1/2 top-1/4 z-50 w-full max-w-sm -translate-x-1/2 rounded-2xl border border-white/10 bg-grafito-900 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              <Search className="h-4 w-4 text-grafito-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-grafito-500 outline-none"
                autoFocus
              />
              <button onClick={onClose}><X className="h-4 w-4 text-grafito-400" /></button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {customers.length === 0 ? (
                <p className="py-8 text-center text-sm text-grafito-500">No se encontraron clientes</p>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-grafito-800 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20">
                      <UserCircle className="h-4 w-4 text-brand-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">{c.fullName}</p>
                      <p className="text-xs text-grafito-400">{c.email ?? c.phone ?? ''}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
