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
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-0 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 rounded-t-2xl border border-white/10 bg-grafito-900 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-brand-400" />
                <h3 className="font-semibold text-white">Escanear código</h3>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 text-grafito-400 hover:bg-white/5">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-5">
              {(['keyboard'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex items-center gap-1.5 rounded-lg bg-grafito-800 px-3 py-2 text-sm text-white"
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
                className="w-full rounded-xl bg-grafito-800 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-grafito-500 outline-none focus:border-brand-500 font-mono"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Buscar producto
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
