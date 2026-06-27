import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Banknote, CreditCard, Smartphone, CheckCircle2, Printer, ChevronRight, RotateCcw } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import { cn } from '@shared/utils/cn'
import { completeSale, type SaleHistoryRow } from '@lib/db'

// ── Métodos de pago ─────────────────────────────────────────────
type PaymentMethod = 'CASH' | 'CARD' | 'NEQUI' | 'DAVIPLATA' | 'TRANSFER'

const METHODS: {
  method: PaymentMethod
  label: string
  color: string
  border: string
  bg: string
  icon: React.ElementType | string
}[] = [
  { method: 'CASH',      label: 'Efectivo',      color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: Banknote },
  { method: 'CARD',      label: 'Tarjeta',        color: 'text-blue-600 dark:text-blue-400',       border: 'border-blue-500',    bg: 'bg-blue-50 dark:bg-blue-500/10',       icon: CreditCard },
  { method: 'NEQUI',     label: 'Nequi',          color: 'text-purple-600 dark:text-purple-400',   border: 'border-purple-500',  bg: 'bg-purple-50 dark:bg-purple-500/10',   icon: '🟣' },
  { method: 'DAVIPLATA', label: 'Daviplata',      color: 'text-red-600 dark:text-red-400',         border: 'border-red-500',     bg: 'bg-red-50 dark:bg-red-500/10',         icon: '🔴' },
  { method: 'TRANSFER',  label: 'Transferencia',  color: 'text-amber-600 dark:text-amber-400',     border: 'border-amber-500',   bg: 'bg-amber-50 dark:bg-amber-500/10',     icon: Smartphone },
]

const QUICK_CASH = [5000, 10000, 20000, 50000, 100000]

interface CompleteComandaModalProps {
  open:     boolean
  onClose:  () => void
  sale:     SaleHistoryRow | null
  currency: string
}

export function CompleteComandaModal({ open, onClose, sale, currency }: CompleteComandaModalProps) {
  const [method, setMethod]       = useState<PaymentMethod>('CASH')
  const [cashInput, setCashInput] = useState('')
  const [success, setSuccess]     = useState(false)

  const { profile } = useAuthStore()
  const queryClient  = useQueryClient()

  const total        = sale?.total ?? 0
  const cashReceived = parseInt(cashInput.replace(/\D/g, ''), 10) || 0
  const change       = method === 'CASH' ? Math.max(0, cashReceived - total) : 0
  const canComplete  = method !== 'CASH' || cashReceived >= total

  const { mutateAsync, isPending } = useMutation({
    mutationFn: () => {
      if (!sale) throw new Error('No sale')
      const userId   = profile?.id ?? ''
      const paidAmt  = method === 'CASH' ? cashReceived : total
      const dbMethod = (method === 'NEQUI' || method === 'DAVIPLATA') ? 'QR' : method
      return completeSale(sale.id, userId, [{ method: dbMethod, amount: paidAmt }])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sales'],  refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: ['sales-history'],  refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: ['shift-sales'],    refetchType: 'all' })
      setSuccess(true)
    },
    onError: (err: Error) => toast.error(err.message ?? 'Error al cobrar la comanda'),
  })

  const handleCashInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    if (!digits) { setCashInput(''); return }
    setCashInput(new Intl.NumberFormat('es-CO').format(parseInt(digits, 10)))
  }

  const handleClose = () => {
    setSuccess(false)
    setCashInput('')
    setMethod('CASH')
    onClose()
  }

  const handlePrint = () => {
    if (!sale) return
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

    const itemRows = (sale.sale_items ?? []).map(it => `
      <tr>
        <td style="padding:3px 0;vertical-align:top">
          <div>${it.name}</div>
          <div style="color:#555;font-size:10px">${it.quantity} und × ${fmt(it.unit_price)}${it.tax > 0 ? ` · IVA ${it.tax}%` : ''}</div>
        </td>
        <td style="padding:3px 0;text-align:right;vertical-align:top;white-space:nowrap">${fmt(it.total)}</td>
      </tr>`).join('')

    const now = new Date()
    const dateStr = now.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Recibo ${sale.order_number}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:11px; width:302px; padding:8px 6px; color:#000; background:#fff; }
  .center { text-align:center; } .bold { font-weight:bold; }
  .sep-solid { border:none; border-top:1px solid #000; margin:5px 0; }
  .sep-dot   { border:none; border-top:1px dashed #555; margin:4px 0; }
  table { width:100%; border-collapse:collapse; } td { font-size:11px; }
  .row-total td { font-weight:bold; font-size:12px; border-top:1px solid #000; padding-top:4px; }
  @media print { @page { margin:4mm; } body { width:302px; } }
</style>
</head><body>
  <div class="center bold" style="font-size:14px">RECIBO DE PAGO</div>
  <div class="center" style="font-size:10px">Comanda #${sale.order_number}</div>
  <hr class="sep-solid">
  <div>Cajero: ${profile?.full_name ?? 'Admin'}</div>
  <div>Fecha: ${dateStr} ${timeStr}</div>
  <hr class="sep-solid">
  <table>
    <thead><tr>
      <th style="text-align:left;font-size:10px;padding-bottom:3px">DESCRIPCIÓN</th>
      <th style="text-align:right;font-size:10px;padding-bottom:3px">TOTAL</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="sep-dot">
  <table>
    <tr class="row-total"><td>TOTAL PAGADO</td><td style="text-align:right">${fmt(total)}</td></tr>
    ${method === 'CASH' && cashReceived > 0 ? `
    <tr><td style="padding-left:6px">Efectivo recibido</td><td style="text-align:right">${fmt(cashReceived)}</td></tr>
    <tr><td style="padding-left:6px">Cambio entregado</td><td style="text-align:right">${fmt(change)}</td></tr>` : ''}
  </table>
  <hr class="sep-dot" style="margin-top:8px">
  <div class="center bold" style="margin-top:8px">¡Gracias por su compra!</div>
</body></html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank', 'width=420,height=800,scrollbars=yes')
    if (!win) { URL.revokeObjectURL(url); alert('Permite ventanas emergentes para imprimir.'); return }
    win.onload = () => {
      setTimeout(() => {
        win.focus()
        win.print()
        win.onafterprint = () => { win.close(); URL.revokeObjectURL(url) }
      }, 250)
    }
  }

  return (
    <AnimatePresence>
      {open && sale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={success ? undefined : handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full sm:max-w-md max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* ── SUCCESS ─────────────────────────────── */}
            {success ? (
              <div className="p-6 space-y-5">
                <div className="flex flex-col items-center gap-3 pt-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-grafito-900 dark:text-white">¡Comanda cobrada!</p>
                    <p className="text-2xl font-black text-brand-500 mt-1">{formatCurrency(total, currency)}</p>
                  </div>
                </div>

                {change > 0 && (
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4 text-center">
                    <p className="text-xs text-grafito-500 mb-1">Cambio a entregar</p>
                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(change, currency)}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handlePrint}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 py-3 text-sm font-semibold text-grafito-700 dark:text-grafito-200 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ── HEADER ───────────────────────────── */}
                <div className="flex items-center justify-between border-b border-grafito-100 dark:border-white/5 px-6 py-4">
                  <div>
                    <p className="text-xs text-grafito-500 font-medium uppercase tracking-wider">
                      Comanda #{sale.order_number}
                    </p>
                    <p className="text-3xl font-black text-grafito-900 dark:text-white mt-0.5">
                      {formatCurrency(total, currency)}
                    </p>
                  </div>
                  <button onClick={handleClose} className="rounded-xl p-2 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Items */}
                  <div className="rounded-xl bg-grafito-50 dark:bg-white/5 divide-y divide-grafito-100 dark:divide-white/5 overflow-hidden">
                    {(sale.sale_items ?? []).map((it, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-grafito-900 dark:text-white">{it.name}</p>
                          <p className="text-xs text-grafito-500">{it.quantity} × {formatCurrency(it.unit_price, currency)}</p>
                        </div>
                        <span className="text-sm font-bold text-grafito-900 dark:text-white">{formatCurrency(it.total, currency)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Métodos */}
                  <div>
                    <p className="text-xs font-bold text-grafito-500 uppercase tracking-wider mb-3">Método de pago</p>
                    <div className="grid grid-cols-5 gap-2">
                      {METHODS.map(m => {
                        const active = method === m.method
                        const IconEl = m.icon
                        return (
                          <button
                            key={m.method}
                            onClick={() => setMethod(m.method)}
                            className={cn(
                              'flex flex-col items-center gap-1.5 rounded-xl p-3 border-2 transition-all',
                              active
                                ? `${m.border} ${m.bg}`
                                : 'border-grafito-200 dark:border-white/5 bg-grafito-50 dark:bg-white/[0.02] hover:border-grafito-300 dark:hover:border-white/10'
                            )}
                          >
                            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-lg', active ? m.bg : 'bg-grafito-100 dark:bg-white/5')}>
                              {typeof IconEl === 'string'
                                ? <span className="text-base leading-none">{IconEl}</span>
                                : <IconEl className={cn('h-4 w-4', active ? m.color : 'text-grafito-400')} />
                              }
                            </div>
                            <span className={cn('text-[10px] font-bold leading-tight text-center', active ? m.color : 'text-grafito-500 dark:text-grafito-400')}>
                              {m.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Efectivo */}
                  {method === 'CASH' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                      <p className="text-xs font-bold text-grafito-500 uppercase tracking-wider">Efectivo recibido</p>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-grafito-400 font-bold text-lg">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cashInput}
                          onChange={e => handleCashInput(e.target.value)}
                          placeholder={new Intl.NumberFormat('es-CO').format(total)}
                          autoFocus
                          className="w-full rounded-xl border-2 border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 pl-8 pr-4 py-3.5 text-2xl font-black text-grafito-900 dark:text-white placeholder-grafito-300 outline-none focus:border-brand-500 transition-colors"
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setCashInput(new Intl.NumberFormat('es-CO').format(total))}
                          className="rounded-lg bg-brand-500/10 border border-brand-500/30 px-3 py-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 transition-colors"
                        >
                          Exacto
                        </button>
                        {QUICK_CASH.filter(v => v > total * 0.8).slice(0, 4).map(v => (
                          <button
                            key={v}
                            onClick={() => setCashInput(new Intl.NumberFormat('es-CO').format((parseInt(cashInput.replace(/\D/g, ''), 10) || 0) + v))}
                            className="rounded-lg bg-grafito-100 dark:bg-white/5 border border-grafito-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 transition-colors"
                          >
                            +{new Intl.NumberFormat('es-CO').format(v)}
                          </button>
                        ))}
                      </div>
                      <div className={cn(
                        'flex items-center justify-between rounded-xl px-5 py-4',
                        change > 0
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
                          : 'bg-grafito-100 dark:bg-white/5 border border-grafito-200 dark:border-white/5'
                      )}>
                        <span className="text-sm text-grafito-500">Cambio</span>
                        <span className={cn('text-2xl font-black', change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-grafito-400')}>
                          {formatCurrency(change, currency)}
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {(method === 'NEQUI' || method === 'DAVIPLATA' || method === 'CARD' || method === 'TRANSFER') && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl bg-grafito-50 dark:bg-white/5 border border-grafito-200 dark:border-white/10 p-4 text-center"
                    >
                      <p className="text-xs text-grafito-500 mb-1">
                        {method === 'CARD' ? 'Pasa la tarjeta por el datáfono' :
                         method === 'TRANSFER' ? 'Confirma que la transferencia fue recibida' :
                         `Solicita al cliente transferir vía ${method === 'NEQUI' ? 'Nequi' : 'Daviplata'}`}
                      </p>
                      <p className="text-xl font-black text-grafito-900 dark:text-white">{formatCurrency(total, currency)}</p>
                    </motion.div>
                  )}
                </div>

                {/* Botón cobrar */}
                <div className="border-t border-grafito-100 dark:border-white/5 p-5">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => mutateAsync()}
                    disabled={!canComplete || isPending}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-all',
                      canComplete && !isPending
                        ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20'
                        : 'bg-grafito-100 dark:bg-white/5 text-grafito-400 cursor-not-allowed'
                    )}
                  >
                    {isPending ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white inline-block"
                      />
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        Cobrar comanda
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
