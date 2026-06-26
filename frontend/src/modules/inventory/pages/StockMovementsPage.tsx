import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Loader2, Package, ChevronDown, Filter, RefreshCw } from 'lucide-react'
import { getStockMovements, getInventory } from '@lib/db'
import { supabase } from '@lib/supabase'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'
import type { StockMovementRow } from '@lib/db'

// ── Movement type config ──────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  IN:           { label: 'Entrada',               color: 'bg-emerald-500/10 text-emerald-500' },
  OUT:          { label: 'Salida',                color: 'bg-red-500/10 text-red-400' },
  PURCHASE:     { label: 'Compra',                color: 'bg-emerald-500/10 text-emerald-500' },
  SALE:         { label: 'Venta',                 color: 'bg-blue-500/10 text-blue-400' },
  ADJUSTMENT:   { label: 'Ajuste',               color: 'bg-orange-500/10 text-orange-400' },
  TRANSFER_IN:  { label: 'Transferencia Entrada', color: 'bg-teal-500/10 text-teal-400' },
  TRANSFER_OUT: { label: 'Transferencia Salida',  color: 'bg-purple-500/10 text-purple-400' },
  RETURN:       { label: 'Devolución',            color: 'bg-yellow-500/10 text-yellow-500' },
  WASTE:        { label: 'Descarte',              color: 'bg-red-500/10 text-red-400' },
  PRODUCTION:   { label: 'Producción',            color: 'bg-cyan-500/10 text-cyan-400' },
}

const POSITIVE_TYPES = new Set(['IN', 'PURCHASE', 'TRANSFER_IN', 'RETURN', 'PRODUCTION'])

function isPositive(type: string, qty: number) {
  return POSITIVE_TYPES.has(type) || (type === 'ADJUSTMENT' && qty > 0)
}

// ── Native dropdown ───────────────────────────────────────────
function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 pl-3.5 pr-8 py-2.5 text-sm text-grafito-700 dark:text-grafito-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
    </div>
  )
}

// ── Date helpers ──────────────────────────────────────────────
function getSince(range: string): string | undefined {
  const now = new Date()
  switch (range) {
    case 'today': {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return d.toISOString()
    }
    case 'week': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString()
    }
    case 'month': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return d.toISOString()
    }
    default: return undefined
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Seed initial movements from existing inventory ────────────
async function seedMovementsFromInventory(tenantId: string, branchId: string) {
  const inventory = await getInventory(tenantId, branchId)
  if (inventory.length === 0) return 0

  const rows = inventory
    .filter(inv => Number(inv.quantity) > 0)
    .map(inv => ({
      tenant_id:      tenantId,
      branch_id:      branchId,
      warehouse_id:   inv.warehouse_id,
      product_id:     inv.product_id,
      type:           'IN',
      quantity:       Number(inv.quantity),
      reference_type: 'INITIAL_STOCK',
      notes:          'Stock inicial (importado)',
    }))

  if (rows.length === 0) return 0

  const { error } = await supabase.from('stock_movements').insert(rows)
  if (error) throw error
  return rows.length
}

// ── Page ─────────────────────────────────────────────────────
export default function StockMovementsPage() {
  const navigate = useNavigate()
  const { tenant, branch } = useAuthStore()

  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [seeding, setSeeding]     = useState(false)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter]   = useState('ALL')
  const [dateRange, setDateRange]     = useState('all')

  useEffect(() => {
    if (!tenant?.tenantId || !branch?.branchId) {
      console.warn('[StockMovements] Sin tenant/branch:', { tenant, branch })
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    console.log('[StockMovements] Fetching...', { tenantId: tenant.tenantId, branchId: branch.branchId, typeFilter, dateRange })
    getStockMovements(tenant.tenantId, branch.branchId, {
      type:  typeFilter !== 'ALL' ? typeFilter : undefined,
      since: getSince(dateRange),
    })
      .then(data => {
        console.log('[StockMovements] Resultado:', data)
        setMovements(data)
      })
      .catch(err => {
        console.error('[StockMovements] Error:', err)
        setError(String(err?.message ?? err))
        setMovements([])
      })
      .finally(() => setLoading(false))
  }, [tenant?.tenantId, branch?.branchId, typeFilter, dateRange])

  // Client-side product search
  const filtered = useMemo(() => {
    if (!search.trim()) return movements
    const q = search.toLowerCase()
    return movements.filter(m => {
      const p = m.products as any
      return p?.name?.toLowerCase().includes(q) || p?.sku?.toLowerCase().includes(q)
    })
  }, [movements, search])

  const refresh = () => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setLoading(true)
    setError(null)
    getStockMovements(tenant.tenantId, branch.branchId, {
      type:  typeFilter !== 'ALL' ? typeFilter : undefined,
      since: getSince(dateRange),
    })
      .then(setMovements)
      .catch(err => { setError(String(err?.message ?? err)); setMovements([]) })
      .finally(() => setLoading(false))
  }

  const handleSeed = async () => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setSeeding(true)
    try {
      const count = await seedMovementsFromInventory(tenant.tenantId, branch.branchId)
      console.log(`[StockMovements] Seeded ${count} movements`)
      refresh()
    } catch (err) {
      console.error('[StockMovements] Seed error:', err)
      setError(String((err as any)?.message ?? err))
    } finally {
      setSeeding(false)
    }
  }

  const typeOptions = [
    { value: 'ALL',          label: 'Todos los tipos' },
    { value: 'PURCHASE',     label: 'Compra' },
    { value: 'IN',           label: 'Entrada' },
    { value: 'SALE',         label: 'Venta' },
    { value: 'OUT',          label: 'Salida' },
    { value: 'ADJUSTMENT',   label: 'Ajuste' },
    { value: 'TRANSFER_IN',  label: 'Transferencia Entrada' },
    { value: 'TRANSFER_OUT', label: 'Transferencia Salida' },
    { value: 'RETURN',       label: 'Devolución' },
    { value: 'WASTE',        label: 'Descarte' },
    { value: 'PRODUCTION',   label: 'Producción' },
  ]

  const dateOptions = [
    { value: 'all',   label: 'Todo el historial' },
    { value: 'today', label: 'Hoy' },
    { value: 'week',  label: 'Última semana' },
    { value: 'month', label: 'Último mes' },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/inventory')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Movimientos de Stock</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Registro histórico de entradas, salidas y ajustes de inventario.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center bg-white dark:bg-grafito-900/60 p-4 rounded-2xl border border-grafito-200 dark:border-white/5">
        {/* Búsqueda */}
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-grafito-100 dark:bg-grafito-800 px-3 py-2.5">
          <Search className="h-4 w-4 text-grafito-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por producto o SKU..."
            className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400"
          />
        </div>

        {/* Tipo */}
        <div className="flex items-center gap-2 sm:w-56">
          <Filter className="h-4 w-4 text-grafito-400 shrink-0" />
          <Select value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
        </div>

        {/* Fecha */}
        <div className="sm:w-44">
          <Select value={dateRange} onChange={setDateRange} options={dateOptions} />
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-grafito-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando movimientos...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-red-400">
            <Package className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Error al cargar movimientos</p>
            <p className="text-xs text-grafito-400 max-w-md text-center">{error}</p>
            <button onClick={refresh} className="mt-2 flex items-center gap-1.5 text-xs text-brand-500 hover:underline">
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-grafito-400">
            <Package className="h-10 w-10 opacity-30" />
            <p className="text-sm">No hay movimientos con los filtros seleccionados.</p>
            {movements.length === 0 && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="mt-2 flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {seeding ? 'Importando...' : 'Importar stock actual como movimientos'}
              </button>
            )}
            {movements.length > 0 && search && (
              <p className="text-xs">Prueba borrando la búsqueda o cambiando los filtros.</p>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm text-grafito-600 dark:text-grafito-300">
              <thead>
                <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5">
                  <th className="px-6 pb-3 pt-5">Fecha</th>
                  <th className="pb-3 pt-5">Producto</th>
                  <th className="pb-3 pt-5">Tipo</th>
                  <th className="pb-3 pt-5">Cantidad</th>
                  <th className="pb-3 pt-5 pr-6">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                {filtered.map(m => {
                  const p   = m.products as any
                  const cfg = TYPE_CONFIG[m.type] ?? { label: m.type, color: 'bg-grafito-500/10 text-grafito-400' }
                  const pos     = isPositive(m.type, Number(m.quantity))
                  const qty     = Math.abs(Number(m.quantity))

                  return (
                    <tr key={m.id} className="hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors" data-id={m.id}>
                      <td className="px-6 py-3.5 text-xs text-grafito-500 dark:text-grafito-400 whitespace-nowrap">
                        {formatDate(m.created_at)}
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          {p?.image_url ? (
                            <img src={p.image_url} alt={p?.name} className="h-8 w-8 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-grafito-100 dark:bg-grafito-800 flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-grafito-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-grafito-900 dark:text-white text-sm">{p?.name ?? '—'}</p>
                            {p?.sku && <p className="text-[11px] text-grafito-400 font-mono">{p.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span className={cn('text-[11px] px-2 py-1 rounded-full font-bold', cfg.color)}>
                          {cfg.label}
                        </span>
                        {m.notes && (
                          <p className="text-[11px] text-grafito-400 mt-0.5 max-w-[180px] truncate">{m.notes}</p>
                        )}
                      </td>
                      <td className="py-3.5">
                        <span className={cn('font-bold text-sm', pos ? 'text-emerald-500' : 'text-red-400')}>
                          {pos ? '+' : '-'}{qty}
                        </span>
                        {m.unit_cost != null && (
                          <p className="text-[11px] text-grafito-400">${Number(m.unit_cost).toLocaleString('es-CO')}/u</p>
                        )}
                      </td>
                      <td className="py-3.5 pr-6 text-xs text-grafito-400 font-mono">
                        {m.created_by ? m.created_by.slice(0, 8) + '…' : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Footer count */}
            <div className="px-6 py-3 border-t border-grafito-100 dark:border-white/5 text-xs text-grafito-400">
              {filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}
              {search && ` · filtrando por "${search}"`}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
