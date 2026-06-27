import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, Loader2, Unlock } from 'lucide-react'
import { useCashSession } from '@modules/pos/hooks/useCashSession'
import { formatCurrency } from '@shared/utils/format'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'

interface OpenCashModalProps {
  open: boolean
}

const DENOMINATIONS = [
  { label: '$100.000', value: 100000 },
  { label: '$50.000',  value: 50000  },
  { label: '$20.000',  value: 20000  },
  { label: '$10.000',  value: 10000  },
  { label: '$5.000',   value: 5000   },
  { label: '$2.000',   value: 2000   },
  { label: '$1.000',   value: 1000   },
  { label: '$500',     value: 500    },
  { label: '$200',     value: 200    },
  { label: '$100',     value: 100    },
  { label: '$50',      value: 50     },
]

const inputCls = 'w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 px-4 py-2.5 text-sm text-grafito-900 dark:text-white placeholder-grafito-400 dark:placeholder-grafito-500 outline-none focus:ring-2 focus:ring-brand-500/40'

export function OpenCashModal({ open }: OpenCashModalProps) {
  const { branch } = useAuthStore()
  const currency = branch?.currency ?? 'COP'
  const { open: openMutation } = useCashSession()

  const [name, setName]             = useState('Caja Principal')
  const [useDenomin, setUseDenomin] = useState(false)
  const [manualAmount, setManualAmount] = useState('')
  const [counts, setCounts]         = useState<Record<number, number>>({})

  const totalFromDenom = DENOMINATIONS.reduce(
    (acc, d) => acc + d.value * (counts[d.value] ?? 0), 0
  )
  const openingCash = useDenomin
    ? totalFromDenom
    : parseFloat(manualAmount.replace(/[^0-9.]/g, '') || '0')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    openMutation.mutate({ name: name.trim() || 'Caja Principal', openingCash })
  }

  const setCount = (denom: number, val: string) => {
    const n = parseInt(val) || 0
    setCounts(prev => ({ ...prev, [denom]: Math.max(0, n) }))
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-grafito-950/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            exit={{    scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="w-full max-w-md rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-grafito-100 dark:border-white/5 px-6 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
                <Unlock className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <h2 className="font-bold text-grafito-900 dark:text-white">Apertura de Caja</h2>
                <p className="text-xs text-grafito-500">Registra el efectivo inicial para comenzar</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Nombre */}
              <div>
                <label className="text-xs font-semibold text-grafito-700 dark:text-grafito-300 block mb-1.5">
                  Nombre de la caja
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Caja Principal"
                  className={inputCls}
                />
              </div>

              {/* Toggle monto/denominaciones */}
              <div className="flex gap-2">
                {[
                  { label: 'Monto directo',     active: !useDenomin, onClick: () => setUseDenomin(false) },
                  { label: 'Por denominaciones', active:  useDenomin, onClick: () => setUseDenomin(true)  },
                ].map(btn => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={btn.onClick}
                    className={cn(
                      'flex-1 rounded-lg py-2 text-xs font-semibold border transition-colors',
                      btn.active
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'border-grafito-200 dark:border-white/10 text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5'
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {!useDenomin ? (
                <div>
                  <label className="text-xs font-semibold text-grafito-700 dark:text-grafito-300 block mb-1.5">
                    Efectivo inicial
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={manualAmount}
                      onChange={e => setManualAmount(e.target.value)}
                      placeholder="0"
                      className={cn(inputCls, 'pl-9')}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-grafito-700 dark:text-grafito-300">Conteo por denominaciones</p>
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {DENOMINATIONS.map(d => (
                      <div key={d.value} className="flex items-center gap-3">
                        <span className="w-20 text-xs font-medium text-grafito-500 shrink-0">{d.label}</span>
                        <input
                          type="number"
                          min={0}
                          value={counts[d.value] ?? ''}
                          onChange={e => setCount(d.value, e.target.value)}
                          placeholder="0"
                          className="w-20 rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 px-3 py-1.5 text-sm text-grafito-900 dark:text-white text-center outline-none focus:ring-2 focus:ring-brand-500/40"
                        />
                        <span className="text-xs text-grafito-400 flex-1 text-right">
                          {counts[d.value] ? formatCurrency(d.value * counts[d.value], currency) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="rounded-xl bg-grafito-100 dark:bg-grafito-800 px-5 py-4 flex items-center justify-between">
                <span className="text-sm text-grafito-500">Efectivo inicial</span>
                <span className="text-xl font-black text-grafito-900 dark:text-white">
                  {formatCurrency(openingCash, currency)}
                </span>
              </div>

              {openMutation.isError && (
                <p className="text-xs text-red-500 text-center">
                  {(openMutation.error as Error)?.message ?? 'Error al abrir la caja'}
                </p>
              )}

              <button
                type="submit"
                disabled={openMutation.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
              >
                {openMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Abriendo caja…</>
                  : <><Unlock className="h-4 w-4" /> Abrir Caja</>
                }
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
