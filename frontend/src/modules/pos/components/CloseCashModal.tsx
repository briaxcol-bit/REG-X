import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Loader2, TrendingUp, DollarSign, AlertTriangle, CheckCircle, Clock, X, StopCircle, ClipboardList, ChevronDown, Printer } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCashSession, type ActiveCashRegister } from '@modules/pos/hooks/useCashSession'
import { getSalesHistory, getCashExpensesForRegister } from '@lib/db'
import { buildEscPosCashReport } from '@lib/escpos'
import { printEscPosDirect } from '@lib/print'
import { formatCurrency } from '@shared/utils/format'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia',
  QR: 'QR / App', GIFT_CARD: 'Gift Card', CREDIT: 'Fiado', MIXED: 'Mixto',
}

interface CashReportPrintData {
  businessName: string
  branchName?: string
  registerName: string
  cashierName?: string
  openedAt: string
  closedAt: string
  duration?: string
  openingCash: number
  cashSales: number
  cashExpenses?: number
  expectedCash: number
  countedCash: number
  difference: number
  byMethod?: [string, number][]
  salesCount?: number
  salesTotal?: number
  notes?: string
  isCommandsOnly?: boolean
  currency: string
}

/**
 * Fallback de impresión cuando NO hay impresora térmica conectada:
 * renderiza el reporte en un iframe oculto y lanza el diálogo del navegador.
 * (Llamar window.print() a secas imprimiría la página del POS: hoja en blanco.)
 */
function printReportViaBrowser(d: CashReportPrintData) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: d.currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

  const rowHtml = (label: string, value: string, bold = false) => `
    <tr${bold ? ' class="bold"' : ''}>
      <td style="padding:2px 0">${label}</td>
      <td style="padding:2px 0;text-align:right;white-space:nowrap">${value}</td>
    </tr>`

  const methodsHtml = (d.byMethod ?? []).map(([m, amt]) => rowHtml(`&nbsp;&nbsp;${m}`, fmt(amt))).join('')

  const diffLabel = d.difference === 0 ? 'CUADRADO' : d.difference > 0 ? 'SOBRANTE' : 'FALTANTE'

  const cashHtml = d.isCommandsOnly ? '' : `
    <hr class="sep-solid">
    <div class="bold">ARQUEO DE EFECTIVO</div>
    <table>
      ${rowHtml('&nbsp;&nbsp;Base inicial', fmt(d.openingCash))}
      ${rowHtml('&nbsp;&nbsp;+ Ventas efectivo', fmt(d.cashSales))}
      ${d.cashExpenses && d.cashExpenses > 0 ? rowHtml('&nbsp;&nbsp;- Gastos efectivo', fmt(d.cashExpenses)) : ''}
    </table>
    <hr class="sep-dot">
    <table>
      ${rowHtml('EFECTIVO ESPERADO', fmt(d.expectedCash), true)}
      ${rowHtml('EFECTIVO CONTADO', fmt(d.countedCash))}
    </table>
    <hr class="sep-dot">
    <table>${rowHtml(diffLabel, fmt(Math.abs(d.difference)), true)}</table>`

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Cierre de caja ${d.registerName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:11px; width:302px; padding:8px 6px; color:#000; background:#fff; }
  .center { text-align:center; } .bold { font-weight:bold; }
  .sep-solid { border:none; border-top:1px solid #000; margin:5px 0; }
  .sep-dot   { border:none; border-top:1px dashed #555; margin:4px 0; }
  table { width:100%; border-collapse:collapse; } td { font-size:11px; }
  .sign { margin-top:22px; }
  @media print { @page { margin:4mm; } body { width:302px; } }
</style>
</head><body>
  <div class="center bold" style="font-size:14px">${d.businessName.toUpperCase()}</div>
  ${d.branchName ? `<div class="center" style="font-size:10px">${d.branchName}</div>` : ''}
  <div class="center bold" style="margin-top:3px">${d.isCommandsOnly ? '* CIERRE DE TURNO *' : '* CIERRE DE CAJA *'}</div>
  <hr class="sep-solid">
  <div>Caja: ${d.registerName}</div>
  ${d.cashierName ? `<div>Cajero: ${d.cashierName}</div>` : ''}
  <div>Apertura: ${d.openedAt}</div>
  <div>Cierre: ${d.closedAt}</div>
  ${d.duration ? `<div>Duración: ${d.duration}</div>` : ''}
  <hr class="sep-solid">
  <div class="bold">VENTAS DEL TURNO</div>
  <table>
    ${d.salesCount !== undefined ? rowHtml('&nbsp;&nbsp;Transacciones', String(d.salesCount)) : ''}
    ${methodsHtml}
  </table>
  ${d.salesTotal !== undefined ? `<hr class="sep-dot"><table>${rowHtml('TOTAL VENDIDO', fmt(d.salesTotal), true)}</table>` : ''}
  ${cashHtml}
  ${d.notes ? `<hr class="sep-solid"><div class="bold">OBSERVACIONES:</div><div>${d.notes}</div>` : ''}
  <div class="sign">_______________________</div>
  <div>Firma cajero</div>
  <div class="sign">_______________________</div>
  <div>Firma responsable</div>
  <hr class="sep-dot" style="margin-top:10px">
  <div class="center" style="font-size:10px">Documento interno de control</div>
</body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) { document.body.removeChild(iframe); return }
  doc.open(); doc.write(html); doc.close()
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, 300)
}

interface CloseCashModalProps {
  open:            boolean
  onClose:         () => void
  register:        ActiveCashRegister
  isCommandsOnly?: boolean
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

export function CloseCashModal({ open, onClose, register, isCommandsOnly = false }: CloseCashModalProps) {
  const { branch, tenant } = useAuthStore()
  const currency = branch?.currency ?? 'COP'
  const { close: closeMutation } = useCashSession()

  const [useDenomin, setUseDenomin] = useState(false)
  const [manualCounted, setManualCounted] = useState('')
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [notes, setNotes] = useState('')

  const totalFromDenom = DENOMINATIONS.reduce(
    (acc, d) => acc + d.value * (counts[d.value] ?? 0), 0
  )
  const countedCash = isCommandsOnly
    ? 0
    : useDenomin
      ? totalFromDenom
      : parseFloat(manualCounted.replace(/[^0-9.]/g, '') || '0')

  // Gastos en efectivo pagados desde esta caja: reducen el efectivo esperado
  const { data: cashExpenses } = useQuery({
    queryKey: ['register-cash-expenses', register.id],
    queryFn: () => getCashExpensesForRegister(tenant?.tenantId ?? '', register.id),
    enabled: open && !!tenant?.tenantId,
  })
  const cashExpensesTotal = cashExpenses?.total ?? 0

  const expectedCash = register.opening_cash + register.cash_sales - cashExpensesTotal
  const difference   = countedCash - expectedCash
  const diffPositive = difference >= 0

  const setCount = (denom: number, val: string) => {
    const n = parseInt(val) || 0
    setCounts(prev => ({ ...prev, [denom]: Math.max(0, n) }))
  }

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault()
    closeMutation.mutate(
      { countedCash, notes: notes.trim() || undefined },
      { onSuccess: () => onClose() }
    )
  }

  const openedAt = new Date(register.opened_at)
  const diffMs   = Date.now() - openedAt.getTime()
  const hours    = Math.floor(diffMs / 3_600_000)
  const minutes  = Math.floor((diffMs % 3_600_000) / 60_000)
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  const { data: shiftSales = [] } = useQuery({
    queryKey: ['shift-sales', register.id],
    queryFn: () => getSalesHistory(
      tenant?.tenantId ?? '',
      branch?.branchId ?? '',
      { cashRegisterId: register.id, limit: 200 }
    ),
    enabled: open && !!tenant?.tenantId && !!branch?.branchId,
    staleTime: 10_000,
  })

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [printing, setPrinting]     = useState(false)

  /**
   * Imprime el reporte de cierre por el MISMO camino que la factura:
   * USB directo → bridge de red → si no hay impresora, diálogo del navegador.
   */
  const handlePrintReport = async () => {
    setPrinting(true)
    try {
      // Ventas del turno agrupadas por método de pago
      const methodTotals: Record<string, number> = {}
      let salesTotal = 0
      const completed = shiftSales.filter(s => s.status === 'COMPLETED')
      for (const s of completed) {
        salesTotal += Number(s.total)
        for (const p of s.sale_payments ?? []) {
          methodTotals[p.method] = (methodTotals[p.method] ?? 0) + Number(p.amount)
        }
      }
      const byMethod: [string, number][] = Object.entries(methodTotals)
        .map(([m, amt]) => [METHOD_LABELS[m] ?? m, amt] as [string, number])
        .sort((a, b) => b[1] - a[1])

      const bytes = buildEscPosCashReport({
        businessName:   tenant?.tenantName ?? 'Mi Negocio',
        branchName:     branch?.branchName ?? '',
        registerName:   register.name,
        cashierName:    register.opened_by_name,
        openedAt:       openedAt.toLocaleString('es-CO'),
        closedAt:       new Date().toLocaleString('es-CO'),
        duration,
        openingCash:    register.opening_cash,
        cashSales:      register.cash_sales,
        cashExpenses:   cashExpensesTotal,
        expectedCash,
        countedCash,
        difference,
        byMethod,
        salesCount:     completed.length,
        salesTotal,
        notes:          notes.trim() || undefined,
        isCommandsOnly,
      })

      const printed = await printEscPosDirect(bytes)
      if (printed.ok) {
        toast.success('Reporte enviado a la impresora')
      } else {
        // Sin impresora directa: imprimir el reporte en un iframe propio.
        // (window.print() imprimiría la página del POS y saldría en blanco.)
        printReportViaBrowser({
          businessName:  tenant?.tenantName ?? 'Mi Negocio',
          branchName:    branch?.branchName ?? '',
          registerName:  register.name,
          cashierName:   register.opened_by_name,
          openedAt:      openedAt.toLocaleString('es-CO'),
          closedAt:      new Date().toLocaleString('es-CO'),
          duration,
          openingCash:   register.opening_cash,
          cashSales:     register.cash_sales,
          cashExpenses:  cashExpensesTotal,
          expectedCash,
          countedCash,
          difference,
          byMethod,
          salesCount:    completed.length,
          salesTotal,
          notes:         notes.trim() || undefined,
          isCommandsOnly,
          currency,
        })
      }
    } catch {
      toast.error('No se pudo imprimir el reporte')
    } finally {
      setPrinting(false)
    }
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
            className="w-full max-w-lg rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-grafito-100 dark:border-white/5 px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', isCommandsOnly ? 'bg-red-500/10' : 'bg-amber-500/10')}>
                  {isCommandsOnly
                    ? <StopCircle className="h-5 w-5 text-red-500" />
                    : <Lock className="h-5 w-5 text-amber-500" />
                  }
                </div>
                <div>
                  <h2 className="font-bold text-grafito-900 dark:text-white">
                    {isCommandsOnly ? 'Cerrar Turno' : 'Cierre de Caja · Arqueo'}
                  </h2>
                  <p className="text-xs text-grafito-500">{register.name}</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <form onSubmit={handleClose} className="p-6 space-y-5">

                {/* Stats de sesión */}
                {isCommandsOnly ? (
                  /* Modo comanda: duración + comandas enviadas */
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard icon={Clock}         label="Duración"           value={duration}                                         sub={openedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} colorCls="text-grafito-700 dark:text-grafito-300" bgCls="bg-grafito-100 dark:bg-grafito-800" />
                    <StatCard icon={ClipboardList} label="Comandas enviadas"  value={String(register.tx_count)}                        sub="pedidos del turno"                                                            colorCls="text-amber-600 dark:text-amber-400"     bgCls="bg-amber-50 dark:bg-amber-500/10" />
                    <StatCard icon={TrendingUp}    label="Total pedidos"      value={formatCurrency(register.sales_total, currency)}   sub="valor acumulado"                                                              colorCls="text-emerald-600 dark:text-emerald-400" bgCls="bg-emerald-50 dark:bg-emerald-500/10" />
                  </div>
                ) : (
                  /* Modo normal: caja completa */
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard icon={Clock}      label="Duración"          value={duration}                                         sub={openedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} colorCls="text-grafito-700 dark:text-grafito-300" bgCls="bg-grafito-100 dark:bg-grafito-800" />
                    <StatCard icon={TrendingUp} label="Ventas totales"    value={formatCurrency(register.sales_total, currency)}  sub={`${register.tx_count} transacciones`}                                        colorCls="text-emerald-600 dark:text-emerald-400" bgCls="bg-emerald-50 dark:bg-emerald-500/10" />
                    <StatCard icon={DollarSign} label="Apertura"          value={formatCurrency(register.opening_cash, currency)} sub="Efectivo inicial"                                                             colorCls="text-grafito-700 dark:text-grafito-300" bgCls="bg-grafito-100 dark:bg-grafito-800" />
                    <StatCard icon={DollarSign} label="Ventas en efectivo" value={formatCurrency(register.cash_sales, currency)}  sub="Solo pagos en cash"                                                           colorCls="text-brand-600 dark:text-brand-400"     bgCls="bg-brand-50 dark:bg-brand-500/10" />
                  </div>
                )}

                {/* Conteo de efectivo — solo modo normal */}
                {!isCommandsOnly && (
                  <>
                    {/* Gastos en efectivo del turno */}
                    {cashExpensesTotal > 0 && (
                      <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-5 py-3 flex justify-between items-center">
                        <span className="text-sm text-red-600 dark:text-red-400">
                          Gastos en efectivo ({cashExpenses?.items.length ?? 0})
                        </span>
                        <span className="font-bold text-red-600 dark:text-red-400">
                          -{formatCurrency(cashExpensesTotal, currency)}
                        </span>
                      </div>
                    )}

                    {/* Esperado */}
                    <div className="rounded-xl bg-grafito-100 dark:bg-grafito-800 px-5 py-3 flex justify-between items-center">
                      <span className="text-sm text-grafito-500">
                        Efectivo esperado en caja
                        {cashExpensesTotal > 0 && (
                          <span className="block text-[10px] text-grafito-400">apertura + ventas efectivo − gastos</span>
                        )}
                      </span>
                      <span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(expectedCash, currency)}</span>
                    </div>

                    {/* Conteo */}
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <p className="text-xs font-semibold text-grafito-700 dark:text-grafito-300 flex-1">Efectivo contado</p>
                        <div className="flex rounded-lg overflow-hidden border border-grafito-200 dark:border-white/10">
                          {['Directo', 'Denominaciones'].map((label, i) => (
                            <button key={label} type="button" onClick={() => setUseDenomin(i === 1)}
                              className={cn('px-3 py-1 text-xs font-semibold transition-colors',
                                (i === 1) === useDenomin
                                  ? 'bg-brand-500 text-white'
                                  : 'text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5'
                              )}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {!useDenomin ? (
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
                          <input type="number" min={0} step={100} value={manualCounted}
                            onChange={e => setManualCounted(e.target.value)} placeholder="0"
                            className={cn(inputCls, 'pl-9')} />
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {DENOMINATIONS.map(d => (
                            <div key={d.value} className="flex items-center gap-3">
                              <span className="w-20 text-xs font-medium text-grafito-500 shrink-0">{d.label}</span>
                              <input type="number" min={0} value={counts[d.value] ?? ''}
                                onChange={e => setCount(d.value, e.target.value)} placeholder="0"
                                className="w-20 rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 px-3 py-1.5 text-sm text-grafito-900 dark:text-white text-center outline-none focus:ring-2 focus:ring-brand-500/40" />
                              <span className="text-xs text-grafito-400 flex-1 text-right">
                                {counts[d.value] ? formatCurrency(d.value * counts[d.value], currency) : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Diferencia */}
                    <div className={cn('rounded-xl px-5 py-4 flex items-center justify-between',
                      diffPositive ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'
                    )}>
                      <div className="flex items-center gap-2">
                        {diffPositive
                          ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                          : <AlertTriangle className="h-4 w-4 text-red-500" />
                        }
                        <span className={cn('text-sm font-semibold', diffPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                          {diffPositive ? 'Sobrante' : 'Faltante'}
                        </span>
                      </div>
                      <span className={cn('text-xl font-black', diffPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {diffPositive ? '+' : ''}{formatCurrency(difference, currency)}
                      </span>
                    </div>
                  </>
                )}

                {/* Listado de ventas/comandas del turno */}
                {shiftSales.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-grafito-700 dark:text-grafito-300 mb-2">
                      {isCommandsOnly ? 'Comandas del turno' : 'Ventas del turno'}
                      <span className="ml-1.5 text-grafito-400 font-normal">({shiftSales.length})</span>
                    </p>
                    <div className="rounded-xl border border-grafito-200 dark:border-white/10 overflow-hidden divide-y divide-grafito-100 dark:divide-white/5 max-h-52 overflow-y-auto">
                      {shiftSales.map(sale => {
                        const isExpanded = expandedId === sale.id
                        const isPending  = sale.status === 'PENDING'
                        const isCancelled = sale.status === 'CANCELLED'
                        return (
                          <div key={sale.id}>
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-grafito-50 dark:hover:bg-white/[0.02] transition-colors"
                            >
                              <span className={cn(
                                'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                                isPending   ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                                isCancelled ? 'bg-red-500/15 text-red-500' :
                                              'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              )}>
                                {isPending ? 'Comanda' : isCancelled ? 'Anulada' : 'Pagada'}
                              </span>
                              <span className="flex-1 text-xs text-grafito-700 dark:text-grafito-300 font-medium truncate">
                                {sale.order_number}
                              </span>
                              <span className={cn('text-xs font-black shrink-0', isCancelled ? 'line-through text-grafito-400' : 'text-grafito-900 dark:text-white')}>
                                {formatCurrency(sale.total, sale.currency)}
                              </span>
                              <ChevronDown className={cn('h-3.5 w-3.5 text-grafito-400 shrink-0 transition-transform', isExpanded && 'rotate-180')} />
                            </button>
                            {isExpanded && (
                              <div className="px-3 pb-2 bg-grafito-50 dark:bg-white/[0.02]">
                                {sale.sale_items.map((it, i) => (
                                  <div key={i} className="flex justify-between text-xs py-1 text-grafito-500">
                                    <span>{it.quantity}× {it.name}</span>
                                    <span>{formatCurrency(it.total, sale.currency)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className="text-xs font-semibold text-grafito-700 dark:text-grafito-300 block mb-1.5">
                    Observaciones (opcional)
                  </label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={isCommandsOnly ? 'Ej: Turno sin novedades…' : 'Ej: Se encontró billete roto, diferencia justificada…'}
                    rows={2} className={cn(inputCls, 'resize-none')} />
                </div>

                {closeMutation.isError && (
                  <p className="text-xs text-red-500 text-center">
                    {(closeMutation.error as Error)?.message ?? 'Error al cerrar la caja'}
                  </p>
                )}

                {/* Imprimir el reporte antes de cerrar (misma impresora que la factura) */}
                <button type="button" onClick={handlePrintReport} disabled={printing}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-700 dark:text-grafito-200 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors disabled:opacity-60">
                  {printing
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Imprimiendo…</>
                    : <><Printer className="h-4 w-4" /> Imprimir reporte de cierre</>}
                </button>

                <div className="flex gap-3">
                  <button type="button" onClick={onClose}
                    className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={closeMutation.isPending}
                    className={cn(
                      'flex-[2] flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 transition-colors',
                      isCommandsOnly ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
                    )}>
                    {closeMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {isCommandsOnly ? 'Cerrando turno…' : 'Cerrando…'}</>
                    ) : isCommandsOnly ? (
                      <><StopCircle className="h-4 w-4" /> Cerrar Turno</>
                    ) : (
                      <><Lock className="h-4 w-4" /> Cerrar Caja</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StatCard({ icon: Icon, label, value, sub, colorCls, bgCls }: {
  icon: React.ElementType; label: string; value: string; sub: string; colorCls: string; bgCls: string
}) {
  return (
    <div className={cn('rounded-xl p-4', bgCls)}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn('h-3.5 w-3.5', colorCls)} />
        <span className="text-xs text-grafito-500">{label}</span>
      </div>
      <p className={cn('text-base font-black', colorCls)}>{value}</p>
      <p className="text-xs text-grafito-400 mt-0.5">{sub}</p>
    </div>
  )
}
