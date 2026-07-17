import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus,
  ShoppingBag, DollarSign, Receipt, CreditCard,
  Calendar, ChevronDown,
} from 'lucide-react'
import { useAuthStore } from '@store/auth.store'
import { getSalesHistory, getCashRegisterHistory } from '@lib/db'
import { formatCurrency } from '@shared/utils/format'
import { cn } from '@shared/utils/cn'

// ── Types ────────────────────────────────────────────────────
type Range = 'today' | '7d' | '30d' | '90d'

const RANGE_LABELS: Record<Range, string> = {
  today: 'Hoy',
  '7d':  'Últimos 7 días',
  '30d': 'Este mes (30 días)',
  '90d': 'Últimos 3 meses',
}

const METHOD_LABELS: Record<string, string> = {
  CASH:       'Efectivo',
  CARD:       'Tarjeta',
  TRANSFER:   'Transferencia',
  QR:         'QR / App',
  GIFT_CARD:  'Gift Card',
  MIXED:      'Mixto',
}

const METHOD_COLORS: Record<string, string> = {
  CASH:       '#6366f1',
  CARD:       '#10b981',
  TRANSFER:   '#f59e0b',
  QR:         '#3b82f6',
  GIFT_CARD:  '#ec4899',
  MIXED:      '#8b5cf6',
}

// ── Helpers ──────────────────────────────────────────────────
function getRangeDates(range: Range): { since: Date; until: Date; prevSince: Date; prevUntil: Date } {
  const until = new Date()
  const since = new Date()

  if (range === 'today') {
    since.setHours(0, 0, 0, 0)
  } else if (range === '7d') {
    since.setDate(since.getDate() - 7)
    since.setHours(0, 0, 0, 0)
  } else if (range === '30d') {
    since.setDate(since.getDate() - 30)
    since.setHours(0, 0, 0, 0)
  } else {
    since.setDate(since.getDate() - 90)
    since.setHours(0, 0, 0, 0)
  }

  const diff = until.getTime() - since.getTime()
  const prevUntil = new Date(since.getTime() - 1)
  const prevSince = new Date(prevUntil.getTime() - diff)

  return { since, until, prevSince, prevUntil }
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function fmtDiff(val: number | null, prev: number | null) {
  if (prev == null || prev === 0 || val == null) return null
  return ((val - prev) / prev) * 100
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, prev, icon: Icon, color, isCurrency = true, currency = 'COP' }: {
  label: string
  value: number
  prev?: number
  icon: React.ElementType
  color: string
  isCurrency?: boolean
  currency?: string
}) {
  const diff = prev != null ? fmtDiff(value, prev) : null
  const up = diff != null && diff > 0
  const down = diff != null && diff < 0

  return (
    <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        {diff != null && (
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
            up   ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
            down ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' :
                   'bg-grafito-100 dark:bg-white/5 text-grafito-500',
          )}>
            {up ? <TrendingUp className="h-3 w-3" /> : down ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(diff).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-grafito-500 mb-1">{label}</p>
      <p className="text-2xl font-black text-grafito-900 dark:text-white">
        {isCurrency ? formatCurrency(value, currency) : value.toLocaleString('es-CO')}
      </p>
      {prev != null && (
        <p className="text-[10px] text-grafito-400 mt-1">
          Anterior: {isCurrency ? formatCurrency(prev, currency) : prev.toLocaleString('es-CO')}
        </p>
      )}
    </div>
  )
}

// ── Custom tooltip ───────────────────────────────────────────
function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-3 shadow-lg text-xs">
      <p className="font-semibold text-grafito-700 dark:text-grafito-300 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-grafito-500">{p.name}:</span>
          <span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(p.value, currency)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function SalesReportPage() {
  const [range, setRange]           = useState<Range>('30d')
  const [rangeOpen, setRangeOpen]   = useState(false)
  const [showCurrent, setShowCurrent] = useState(true)
  const [showPrev, setShowPrev]       = useState(true)

  const { tenant, branch } = useAuthStore()
  const tenantId = tenant?.tenantId ?? ''
  const branchId = branch?.branchId ?? ''
  const currency = branch?.currency ?? 'COP'

  const { since, until, prevSince, prevUntil } = useMemo(() => getRangeDates(range), [range])

  // Fetch current + previous period together
  const { data: allSales = [], isLoading } = useQuery({
    queryKey: ['sales-report', tenantId, branchId, range],
    queryFn: () => getSalesHistory(tenantId, branchId, {
      since:  prevSince.toISOString(),
      until:  until.toISOString(),
      limit:  2000,
    }),
    enabled: !!tenantId && !!branchId,
    staleTime: 60_000,
  })

  const { data: registers = [] } = useQuery({
    queryKey: ['cash-registers-history', tenantId, branchId, range],
    queryFn: () => getCashRegisterHistory(tenantId, branchId, since.toISOString()),
    enabled: !!tenantId && !!branchId,
    staleTime: 60_000,
  })

  // Split current vs previous
  const currentSales = useMemo(() =>
    allSales.filter(s => new Date(s.created_at) >= since && s.status === 'COMPLETED'),
    [allSales, since],
  )
  const prevSales = useMemo(() =>
    allSales.filter(s => {
      const d = new Date(s.created_at)
      return d >= prevSince && d < since && s.status === 'COMPLETED'
    }),
    [allSales, prevSince, since],
  )

  // KPIs
  const kpiTotal     = currentSales.reduce((a, s) => a + s.total, 0)
  const kpiPrevTotal = prevSales.reduce((a, s) => a + s.total, 0)
  const kpiCount     = currentSales.length
  const kpiPrevCount = prevSales.length
  const kpiAvg       = kpiCount > 0 ? kpiTotal / kpiCount : 0
  const kpiPrevAvg   = kpiPrevCount > 0 ? kpiPrevTotal / kpiPrevCount : 0
  const kpiTax       = currentSales.reduce((a, s) => a + s.tax_total, 0)

  // ── Revenue chart (daily) ──────────────────────────────────
  const chartData = useMemo(() => {
    const days: Record<string, { date: string; current: number; anterior: number }> = {}

    // Fill days for current period
    const cur = new Date(since)
    while (cur <= until) {
      const key = cur.toISOString().split('T')[0]
      days[key] = { date: fmtDay(cur.toISOString()), current: 0, anterior: 0 }
      cur.setDate(cur.getDate() + 1)
    }

    // Aggregate current
    for (const s of currentSales) {
      const key = s.created_at.split('T')[0]
      if (days[key]) days[key].current += s.total
    }

    // Aggregate previous (aligned to same index offset)
    const prevDays = Object.keys(days).sort()
    for (const s of prevSales) {
      const d = new Date(s.created_at)
      const diffMs = d.getTime() - prevSince.getTime()
      const daysOffset = Math.floor(diffMs / 86_400_000)
      if (daysOffset >= 0 && daysOffset < prevDays.length) {
        const key = prevDays[daysOffset]
        if (days[key]) days[key].anterior += s.total
      }
    }

    return Object.values(days)
  }, [currentSales, prevSales, since, until, prevSince])

  // ── Payment methods ───────────────────────────────────────
  const paymentData = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const s of currentSales) {
      for (const p of s.sale_payments) {
        totals[p.method] = (totals[p.method] ?? 0) + p.amount
      }
    }
    return Object.entries(totals)
      .map(([method, amount]) => ({ method, label: METHOD_LABELS[method] ?? method, amount, color: METHOD_COLORS[method] ?? '#6366f1' }))
      .sort((a, b) => b.amount - a.amount)
  }, [currentSales])

  const paymentTotal = paymentData.reduce((a, p) => a + p.amount, 0)

  // ── Top products ─────────────────────────────────────────
  const topProducts = useMemo(() => {
    const totals: Record<string, { name: string; revenue: number; qty: number }> = {}
    for (const s of currentSales) {
      for (const it of s.sale_items) {
        if (!totals[it.name]) totals[it.name] = { name: it.name, revenue: 0, qty: 0 }
        totals[it.name].revenue += it.total
        totals[it.name].qty    += it.quantity
      }
    }
    return Object.values(totals).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [currentSales])

  const maxProductRevenue = topProducts[0]?.revenue ?? 1

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-grafito-50 dark:bg-grafito-950 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-grafito-900 dark:text-white tracking-tight">Ventas</h1>
          <p className="text-sm text-grafito-500 mt-0.5">Análisis de ingresos y rendimiento del negocio</p>
        </div>

        {/* Period picker */}
        <div className="relative">
          <button
            onClick={() => setRangeOpen(o => !o)}
            className="flex items-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 px-4 py-2.5 text-sm font-semibold text-grafito-700 dark:text-grafito-200 hover:border-brand-500/40 transition-colors shadow-sm"
          >
            <Calendar className="h-4 w-4 text-grafito-400" />
            {RANGE_LABELS[range]}
            <ChevronDown className={cn('h-4 w-4 text-grafito-400 transition-transform', rangeOpen && 'rotate-180')} />
          </button>
          {rangeOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-xl overflow-hidden">
              {(Object.entries(RANGE_LABELS) as [Range, string][]).map(([key, lbl]) => (
                <button key={key} onClick={() => { setRange(key); setRangeOpen(false) }}
                  className={cn(
                    'flex w-full items-center px-4 py-2.5 text-sm transition-colors',
                    range === key
                      ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
                      : 'text-grafito-700 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-white/5',
                  )}>
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 rounded-full border-2 border-grafito-200 border-t-brand-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total ingresos"    value={kpiTotal}     prev={kpiPrevTotal} icon={DollarSign}   color="bg-brand-500"   currency={currency} />
            <KpiCard label="Transacciones"     value={kpiCount}     prev={kpiPrevCount} icon={ShoppingBag}  color="bg-emerald-500" isCurrency={false} />
            <KpiCard label="Ticket promedio"   value={kpiAvg}       prev={kpiPrevAvg}   icon={Receipt}      color="bg-amber-500"   currency={currency} />
            <KpiCard label="IVA recaudado"     value={kpiTax}                           icon={CreditCard}   color="bg-violet-500"  currency={currency} />
          </div>

          {/* Revenue chart */}
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="font-bold text-grafito-900 dark:text-white">Ingresos por día</p>
                <p className="text-xs text-grafito-400 mt-0.5">Comparación con período anterior</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCurrent(v => !v)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all',
                    showCurrent
                      ? 'border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'border-grafito-200 dark:border-white/10 bg-transparent text-grafito-400 dark:text-grafito-600',
                  )}
                >
                  <span className={cn('h-2 w-4 rounded-full inline-block transition-colors', showCurrent ? 'bg-indigo-500' : 'bg-grafito-300 dark:bg-grafito-700')} />
                  Actual
                </button>
                <button
                  onClick={() => setShowPrev(v => !v)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all',
                    showPrev
                      ? 'border-grafito-400/40 bg-grafito-100 dark:bg-white/5 text-grafito-600 dark:text-grafito-300'
                      : 'border-grafito-200 dark:border-white/10 bg-transparent text-grafito-400 dark:text-grafito-600',
                  )}
                >
                  <span className={cn('h-2 w-4 rounded-full inline-block transition-colors', showPrev ? 'bg-grafito-400 dark:bg-grafito-500' : 'bg-grafito-200 dark:bg-grafito-800')} />
                  Anterior
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#9ca3af" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-grafito-100 dark:text-white/5" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-grafito-400" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-grafito-400" tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                {showPrev    && <Area type="monotone" dataKey="anterior" name="Anterior" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#gradPrev)"     dot={false} />}
                {showCurrent && <Area type="monotone" dataKey="current"  name="Actual"   stroke="#6366f1" strokeWidth={2.5}                   fill="url(#gradCurrent)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom grid: payment methods + top products */}
          <div className="grid lg:grid-cols-2 gap-4">

            {/* Payment methods */}
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 p-6">
              <p className="font-bold text-grafito-900 dark:text-white mb-5">Métodos de pago</p>
              {paymentData.length === 0 ? (
                <p className="text-sm text-grafito-400 text-center py-8">Sin datos</p>
              ) : (
                <div className="space-y-4">
                  {paymentData.map(p => (
                    <div key={p.method}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="text-sm font-medium text-grafito-700 dark:text-grafito-300">{p.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-grafito-400">{paymentTotal > 0 ? ((p.amount / paymentTotal) * 100).toFixed(1) : 0}%</span>
                          <span className="text-sm font-bold text-grafito-900 dark:text-white w-24 text-right">{formatCurrency(p.amount, currency)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-grafito-100 dark:bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${paymentTotal > 0 ? (p.amount / paymentTotal) * 100 : 0}%`, backgroundColor: p.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top products */}
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 p-6">
              <p className="font-bold text-grafito-900 dark:text-white mb-5">Productos más vendidos</p>
              {topProducts.length === 0 ? (
                <p className="text-sm text-grafito-400 text-center py-8">Sin datos</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="text-[11px] font-black text-grafito-300 dark:text-grafito-600 w-4 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-grafito-700 dark:text-grafito-300 truncate">{p.name}</span>
                          <span className="text-xs font-bold text-grafito-900 dark:text-white ml-2 shrink-0">{formatCurrency(p.revenue, currency)}</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-grafito-100 dark:bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-brand-500 transition-all duration-500"
                            style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-grafito-400 shrink-0">{p.qty} uds</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cash register closings */}
          {registers.length > 0 && (
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 overflow-hidden">
              <div className="px-6 py-4 border-b border-grafito-100 dark:border-white/5">
                <p className="font-bold text-grafito-900 dark:text-white">Cierres de caja</p>
                <p className="text-xs text-grafito-400 mt-0.5">{registers.length} registro{registers.length !== 1 ? 's' : ''} en el período</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grafito-100 dark:border-white/5">
                      {['Apertura', 'Cierre', 'Responsable', 'Apertura ($)', 'Ventas', 'Contado', 'Diferencia', 'Estado'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-grafito-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                    {registers.map(r => {
                      const diff = r.cash_difference
                      return (
                        <tr key={r.id} className="hover:bg-grafito-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-grafito-700 dark:text-grafito-300 whitespace-nowrap text-xs">
                            {new Date(r.opened_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-grafito-700 dark:text-grafito-300 whitespace-nowrap text-xs">
                            {r.closed_at
                              ? new Date(r.closed_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : <span className="flex items-center gap-1 text-emerald-500 font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />Abierta</span>}
                          </td>
                          <td className="px-4 py-3 text-grafito-700 dark:text-grafito-300 whitespace-nowrap text-xs">
                            {(r.opened_by_profile as any)?.full_name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-grafito-900 dark:text-white font-semibold whitespace-nowrap text-xs">
                            {formatCurrency(r.opening_cash, currency)}
                          </td>
                          <td className="px-4 py-3 text-grafito-900 dark:text-white font-bold whitespace-nowrap text-xs">
                            {r.expected_cash != null ? formatCurrency(r.expected_cash - r.opening_cash, currency) : '—'}
                          </td>
                          <td className="px-4 py-3 text-grafito-900 dark:text-white font-semibold whitespace-nowrap text-xs">
                            {r.closing_cash != null ? formatCurrency(r.closing_cash, currency) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold">
                            {diff != null ? (
                              <span className={cn(
                                diff === 0 ? 'text-grafito-500' :
                                diff > 0   ? 'text-emerald-500' : 'text-red-500',
                              )}>
                                {diff > 0 ? '+' : ''}{formatCurrency(diff, currency)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold',
                              r.status === 'OPEN'   ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                              r.status === 'CLOSED' ? 'bg-grafito-100 dark:bg-white/10 text-grafito-500' :
                                                      'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
                            )}>
                              {r.status === 'OPEN' ? 'Abierta' : r.status === 'CLOSED' ? 'Cerrada' : 'Pausada'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
