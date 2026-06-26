import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Barcode, Keyboard } from 'lucide-react'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (barcode: string) => void
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const [manualInput, setManualInput] = useState('')
  const [mode, setMode] = useState<'camera' | 'keyboard'>('keyboard')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the input when modal opens
  useEffect(() => {
    if (open && mode === 'keyboard') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, mode])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) {
      onScan(manualInput.trim())
      setManualInput('')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full max-w-sm rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-brand-400" />
                <h3 className="font-semibold text-grafito-900 dark:text-white">Escanear código</h3>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-5">
              {(['keyboard'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex items-center gap-1.5 rounded-lg bg-grafito-100 dark:bg-grafito-800 px-3 py-2 text-sm text-grafito-900 dark:text-white"
                >
                  <Keyboard className="h-4 w-4" /> Entrada manual
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                ref={inputRef}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Escribe o escanea el código…"
                className="w-full rounded-xl bg-grafito-100 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 px-4 py-3 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 dark:placeholder:text-grafito-500 outline-none focus:border-brand-500 font-mono"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-grafito-900 dark:text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Buscar producto
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
