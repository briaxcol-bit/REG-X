import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, Printer, Ban, ChevronDown, CheckCircle2,
  Clock, XCircle, Receipt, Search, AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '@store/auth.store'
import { usePOSStore } from '@store/pos.store'
import { getSalesHistory, getOpenCashRegisters, cancelSale, type SaleHistoryRow, type CashRegisterRow } from '@lib/db'
import { type ReceiptData } from './ReceiptTemplate'
import type { ActiveCashRegister } from '@lib/db'
import { formatCurrency } from '@shared/utils/format'
import { cn } from '@shared/utils/cn'
import { toast } from 'sonner'

// ── Helpers ───────────────────────────────────────────────────
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia',
  QR: 'QR / App', GIFT_CARD: 'Gift Card', MIXED: 'Mixto',
}

function timeAgo(iso: string) {
  const ms   = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1)   return 'Ahora'
  if (mins < 60)  return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `Hace ${hrs}h`
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

const STATUS_CFG = {
  COMPLETED: { label: 'Completada', Icon: CheckCircle2, cls: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  CANCELLED: { label: 'Anulada',    Icon: XCircle,      cls: 'text-red-500',     bg: 'bg-red-500/10'     },
  PENDING:   { label: 'Pendiente',  Icon: Clock,        cls: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  REFUNDED:  { label: 'Devuelta',   Icon: ChevronDown,  cls: 'text-blue-500',    bg: 'bg-blue-500/10'    },
}

// ── Cancel confirm dialog ──────────────────────────────────────
function CancelDialog({
  sale, onConfirm, onClose, loading,
}: {
  sale: SaleHistoryRow
  onConfirm: (reason: string) => void
  onClose: () => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-6 shadow-2xl mx-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="font-bold text-grafito-900 dark:text-white">Anular venta</p>
            <p className="text-xs text-grafito-500">{sale.order_number} · {formatCurrency(sale.total, sale.currency)}</p>
          </div>
        </div>
        <p className="text-sm text-grafito-600 dark:text-grafito-300 mb-4">
          Esta acción no se puede deshacer. El inventario <strong>no</strong> será revertido automáticamente.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Motivo de anulación (opcional)"
          rows={2}
          className="w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 px-3 py-2.5 text-sm text-grafito-900 dark:text-white placeholder-grafito-400 resize-none outline-none focus:border-red-500 transition-colors mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Anulando…' : 'Sí, anular'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Sale row ──────────────────────────────────────────────────
function SaleRow({
  sale, canCancel, onPrint, onCancel, expanded, onToggle,
}: {
  sale: SaleHistoryRow
  canCancel: boolean
  onPrint: (sale: SaleHistoryRow) => void
  onCancel: (sale: SaleHistoryRow) => void
  expanded: boolean
  onToggle: () => void
}) {
  const cfg = STATUS_CFG[sale.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.PENDING
  const { Icon } = cfg
  const primaryPayment = sale.sale_payments[0]

  return (
    <div className="border-b border-grafito-100 dark:border-white/5 last:border-0">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-grafito-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        {/* Status icon */}
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cfg.bg)}>
          <Icon className={cn('h-4 w-4', cfg.cls)} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-grafito-900 dark:text-white">{sale.order_number}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cfg.bg, cfg.cls)}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-grafito-500 mt-0.5">
            <span>{timeAgo(sale.created_at)}</span>
            {sale.customers && (
              <>
                <span>·</span>
                <span className="truncate">{sale.customers.full_name}</span>
              </>
            )}
            {primaryPayment && (
              <>
                <span>·</span>
                <span>{METHOD_LABELS[primaryPayment.method] ?? primaryPayment.method}</span>
              </>
            )}
          </div>
        </div>

        {/* Total */}
        <span className={cn(
          'text-sm font-black shrink-0',
          sale.status === 'CANCELLED' ? 'line-through text-grafito-400' : 'text-grafito-900 dark:text-white'
        )}>
          {formatCurrency(sale.total, sale.currency)}
        </span>

        <ChevronDown className={cn('h-4 w-4 shrink-0 text-grafito-400 transition-transform', expanded && 'rotate-180')} />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Items */}
              <div className="rounded-xl bg-grafito-50 dark:bg-white/[0.03] divide-y divide-grafito-100 dark:divide-white/5">
                {sale.sale_items.map((it, i) => (
                  <div key={i} className="flex justify-between px-3 py-2 text-xs">
                    <span className="text-grafito-600 dark:text-grafito-300">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="font-semibold text-grafito-900 dark:text-white">
                      {formatCurrency(it.total, sale.currency)}
                    </span>
                  </div>
                ))}
                {sale.discount_total > 0 && (
                  <div className="flex justify-between px-3 py-2 text-xs text-emerald-500 font-semibold">
                    <span>Descuento</span>
                    <span>−{formatCurrency(sale.discount_total, sale.currency)}</span>
                  </div>
                )}
                {sale.tax_total > 0 && (
                  <div className="flex justify-between px-3 py-2 text-xs text-grafito-500">
                    <span>IVA</span>
                    <span>{formatCurrency(sale.tax_total, sale.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between px-3 py-2">
                  <span className="text-xs font-bold text-grafito-900 dark:text-white">Total</span>
                  <span className="text-sm font-black text-brand-500">{formatCurrency(sale.total, sale.currency)}</span>
                </div>
              </div>

              {/* Notes */}
              {sale.notes && (
                <p className="text-xs text-grafito-500 italic px-1">{sale.notes}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onPrint(sale)}
                  className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </button>
                {canCancel && sale.status === 'COMPLETED' && (
                  <button
                    onClick={() => onCancel(sale)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/20 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Anular venta
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  activeRegister: ActiveCashRegister | null
}

export function SalesHistoryModal({ open, onClose, activeRegister }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<SaleHistoryRow | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [selectedRegisterId, setSelectedRegisterId] = useState<string | null>(null)

  const { tenant, branch, hasRole } = useAuthStore()
  const { setLastReceipt } = usePOSStore()
  const qc = useQueryClient()

  const tenantId  = tenant?.tenantId ?? ''
  const branchId  = branch?.branchId ?? ''
  const canCancel = hasRole('OWNER') || hasRole('ADMIN')
  const isManager = canCancel

  // Al abrir, seleccionar la caja del usuario activo
  useEffect(() => {
    if (open && activeRegister?.id) setSelectedRegisterId(activeRegister.id)
  }, [open, activeRegister?.id])

  // Todas las cajas abiertas del branch (managers)
  const { data: openRegisters = [] } = useQuery({
    queryKey: ['open-registers', tenantId, branchId],
    queryFn:  () => getOpenCashRegisters(tenantId, branchId),
    enabled:  open && isManager && !!tenantId && !!branchId,
    refetchInterval: 10_000,
  })

  // Período desde la caja abierta más antigua del branch
  const earliestOpened = openRegisters.length > 0
    ? openRegisters.reduce((min, r) => r.opened_at < min ? r.opened_at : min, openRegisters[0].opened_at)
    : activeRegister?.opened_at

  // Todas las ventas del branch en el período actual
  const { data: allBranchSales = [], isLoading } = useQuery({
    queryKey: ['sales-history', tenantId, branchId, 'all', earliestOpened],
    queryFn:  () => getSalesHistory(tenantId, branchId, { since: earliestOpened, limit: 1000 }),
    enabled:  open && !!tenantId && !!branchId && !!earliestOpened,
    refetchInterval: 5_000,
  })

  // Tabs: si es manager mostramos todas las cajas abiertas, sino solo la activa
  const tabs: CashRegisterRow[] = isManager && openRegisters.length > 0
    ? openRegisters
    : activeRegister
      ? [{ id: activeRegister.id, name: activeRegister.name, status: 'OPEN', opened_at: activeRegister.opened_at, opening_cash: activeRegister.opening_cash, opened_by: activeRegister.opened_by, closed_at: null, closing_cash: null, expected_cash: null, cash_difference: null, closed_by: null, tenant_id: tenantId, branch_id: branchId }]
      : []

  const activeTab = tabs.find(t => t.id === selectedRegisterId) ?? tabs[0] ?? null

  const sales = allBranchSales.filter(s => s.cash_register_id === activeTab?.id)

  const cancelMutation = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason: string }) =>
      cancelSale(tenantId, saleId, reason),
    onSuccess: () => {
      toast.success('Venta anulada')
      setCancelTarget(null)
      qc.invalidateQueries({ queryKey: ['sales-history', tenantId, branchId] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: () => toast.error('No se pudo anular la venta'),
  })

  const handlePrint = (sale: SaleHistoryRow) => {
    const taxTotalAmt      = sale.tax_total
    const discountTotalAmt = sale.discount_total
    const subtotalAmt      = sale.subtotal
    const taxBaseAmt       = subtotalAmt - discountTotalAmt

    const receipt: ReceiptData = {
      businessName:  tenant?.tenantName ?? 'Mi Negocio',
      branchName:    branch?.branchName ?? '',
      nit:           '000.000.000-0',
      cashierName:   'Cajero',
      date:          new Date(sale.created_at),
      orderNumber:   sale.order_number,
      customer:      sale.customers ? { name: sale.customers.full_name } : undefined,
      items:         sale.sale_items.map(it => ({
        name:     it.name,
        qty:      it.quantity,
        price:    it.unit_price,
        total:    it.total,
        discount: it.discount_amount ?? 0,
        tax:      it.tax ?? 0,
        taxAmt:   it.tax_amount ?? 0,
      })),
      subtotal:      subtotalAmt,
      discountTotal: discountTotalAmt,
      taxBase:       taxBaseAmt,
      taxTotal:      taxTotalAmt,
      total:         sale.total,
      paymentMethod: METHOD_LABELS[sale.sale_payments[0]?.method ?? ''] ?? 'N/A',
      currency:      sale.currency,
    }
    setLastReceipt(receipt)
    setTimeout(() => window.print(), 80)
  }

  // Filtered list
  const filtered = sales.filter(s => {
    const matchStatus = filterStatus === 'ALL' || s.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q ||
      s.order_number.toLowerCase().includes(q) ||
      s.customers?.full_name.toLowerCase().includes(q) ||
      s.sale_items.some(it => it.name.toLowerCase().includes(q))
    return matchStatus && matchSearch
  })

  const totalCompleted = sales
    .filter(s => s.status === 'COMPLETED')
    .reduce((acc, s) => acc + s.total, 0)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm print:hidden"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="flex flex-col w-full sm:max-w-lg h-[90vh] sm:h-[80vh] rounded-t-3xl sm:rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-grafito-100 dark:border-white/5 px-5 pt-4 pb-0 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-brand-500" />
                  <p className="font-bold text-grafito-900 dark:text-white">
                    {activeTab ? `Ventas · ${activeTab.name}` : 'Historial de ventas'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-grafito-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block mr-1 animate-pulse" />
                    {sales.filter(s => s.status === 'COMPLETED').length} ventas · {formatCurrency(totalCompleted, branch?.currency ?? 'COP')}
                  </span>
                  <button onClick={onClose} className="rounded-xl p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors ml-1">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Tabs por caja */}
              {tabs.length > 1 && (
                <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none -mx-1 px-1">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedRegisterId(tab.id)}
                      className={cn(
                        'shrink-0 rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors border-b-2',
                        selectedRegisterId === tab.id
                          ? 'border-brand-500 text-brand-500 bg-brand-500/5'
                          : 'border-transparent text-grafito-500 hover:text-grafito-700 dark:hover:text-grafito-200 hover:bg-grafito-50 dark:hover:bg-white/5',
                      )}
                    >
                      {tab.name}
                      {tab.id === activeRegister?.id && (
                        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search + filtros de estado */}
            <div className="px-4 py-3 border-b border-grafito-100 dark:border-white/5 shrink-0 space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-grafito-400 shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por orden, cliente o producto…"
                  className="flex-1 bg-transparent text-xs text-grafito-900 dark:text-white placeholder-grafito-400 outline-none"
                />
              </div>
              <div className="flex gap-1">
                {(['ALL', 'COMPLETED', 'PENDING', 'CANCELLED'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                      filterStatus === s
                        ? 'bg-brand-500 text-white'
                        : 'bg-grafito-100 dark:bg-white/5 text-grafito-500 hover:bg-grafito-200 dark:hover:bg-white/10',
                    )}
                  >
                    {s === 'ALL' ? 'Todas' : s === 'COMPLETED' ? 'Completadas' : s === 'PENDING' ? 'Comandas' : 'Anuladas'}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-grafito-400">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-6 w-6 rounded-full border-2 border-grafito-200 border-t-brand-500"
                  />
                  <p className="text-sm">Cargando ventas…</p>
                </div>
              ) : !activeRegister ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-grafito-400">
                  <Receipt className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">No hay caja abierta</p>
                  <p className="text-xs text-center max-w-[200px] leading-relaxed">Abre una caja para ver las ventas del turno. El historial completo está en <strong>Reportes → Ventas</strong>.</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-grafito-400">
                  <Receipt className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">Sin ventas en este período</p>
                </div>
              ) : (
                filtered.map(sale => (
                  <SaleRow
                    key={sale.id}
                    sale={sale}
                    canCancel={canCancel}
                    onPrint={handlePrint}
                    onCancel={setCancelTarget}
                    expanded={expandedId === sale.id}
                    onToggle={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                  />
                ))
              )}
            </div>
          </motion.div>

          {/* Cancel dialog */}
          <AnimatePresence>
            {cancelTarget && (
              <CancelDialog
                sale={cancelTarget}
                loading={cancelMutation.isPending}
                onClose={() => setCancelTarget(null)}
                onConfirm={reason => cancelMutation.mutate({ saleId: cancelTarget.id, reason })}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
