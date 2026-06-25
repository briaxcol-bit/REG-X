import { useState, useEffect } from 'react'
import { Package, RefreshCw, AlertTriangle, ArrowRightLeft, Loader2, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getInventory } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import type { InventoryRow } from '@lib/db'

export default function InventoryPage() {
  const { tenant, branch } = useAuthStore()
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')

  useEffect(() => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setLoading(true)
    getInventory(tenant.tenantId, branch.branchId)
      .then(setInventory)
      .catch(() => setInventory([]))
      .finally(() => setLoading(false))
  }, [tenant?.tenantId, branch?.branchId])

  const filtered = inventory.filter(row => {
    if (!search) return true
    const p = row.products as any
    return p?.name?.toLowerCase().includes(search.toLowerCase()) ||
           p?.sku?.toLowerCase().includes(search.toLowerCase())
  })

  const lowStock  = inventory.filter(r => {
    const p = r.products as any
    return p?.min_stock && Number(r.quantity) <= Number(p.min_stock)
  })

  const totalCost = inventory.reduce((s, r) => {
    const cost = Number((r.products as any)?.price ?? 0)
    return s + cost * Number(r.quantity)
  }, 0)

  const totalSale = inventory.reduce((s, r) => {
    const price = Number((r.products as any)?.price ?? 0)
    return s + price * Number(r.quantity)
  }, 0)

  const margin = totalSale > 0 ? ((totalSale - totalCost) / totalSale * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Inventario</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Control de stock, alertas y movimientos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/inventory/movements"
            className="flex items-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-4 py-2.5 text-sm text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Movimientos
          </Link>
          <Link
            to="/inventory/transfers"
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-all"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Transferencias
          </Link>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Alertas */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-grafito-900 dark:text-white">Alertas de Stock Bajo</h3>
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-grafito-400" /></div>
          ) : lowStock.length === 0 ? (
            <p className="text-sm text-grafito-400 text-center py-4">Sin alertas de stock. ✓</p>
          ) : (
            <div className="space-y-3">
              {lowStock.map((r) => {
                const p = r.products as any
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-xl bg-grafito-100 dark:bg-grafito-800/40 p-3 border border-grafito-200 dark:border-white/5">
                    <div>
                      <p className="text-sm font-semibold text-grafito-900 dark:text-white">{p?.name}</p>
                      <p className="text-[10px] text-grafito-500 dark:text-grafito-400">Mínimo: {p?.min_stock} uds</p>
                    </div>
                    <span className="text-sm font-bold text-yellow-400">{Number(r.quantity)} uds</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Valoración */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-grafito-900 dark:text-white">Valoración del Inventario</h3>
            <Package className="h-5 w-5 text-brand-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between border-b border-grafito-200 dark:border-white/5 pb-2">
              <span className="text-sm text-grafito-500 dark:text-grafito-400">Valor al costo:</span>
              <span className="text-sm font-bold text-grafito-900 dark:text-white">${totalCost.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-grafito-200 dark:border-white/5 pb-2">
              <span className="text-sm text-grafito-500 dark:text-grafito-400">Valor al precio de venta:</span>
              <span className="text-sm font-bold text-brand-400">${totalSale.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-grafito-500 dark:text-grafito-400">Margen promedio:</span>
              <span className="text-sm font-bold text-emerald-400">{margin}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla inventario */}
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-grafito-100 dark:border-white/5">
          <Search className="h-4 w-4 text-grafito-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-grafito-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando inventario...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-grafito-400">
            <Package className="h-10 w-10 opacity-30" />
            <p className="text-sm">Sin productos en inventario.</p>
            <Link to="/products/new" className="text-xs text-brand-400 hover:underline">Crear producto</Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5">
                <th className="px-6 pb-3 pt-4">Producto</th>
                <th className="pb-3 pt-4">SKU</th>
                <th className="pb-3 pt-4">Categoría</th>
                <th className="pb-3 pt-4 text-center">Stock</th>
                <th className="pb-3 pt-4 text-center">Mínimo</th>
                <th className="pb-3 pt-4 text-right pr-6">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {filtered.map((row) => {
                const p   = row.products as any
                const cat = p?.categories as any
                const qty = Number(row.quantity)
                const min = Number(p?.min_stock ?? 0)
                const isLow = min > 0 && qty <= min
                return (
                  <tr key={row.id} className="hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-grafito-100 dark:bg-grafito-800 shrink-0">
                          <Package className="h-4 w-4 text-grafito-400" />
                        </div>
                        <span className="font-semibold text-grafito-900 dark:text-white">{p?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 font-mono text-xs text-grafito-500 dark:text-grafito-400">{p?.sku ?? '—'}</td>
                    <td className="py-3.5">
                      {cat ? (
                        <span className="flex items-center gap-1.5 text-xs text-grafito-600 dark:text-grafito-300">
                          <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                          {cat.name}
                        </span>
                      ) : <span className="text-xs text-grafito-400">—</span>}
                    </td>
                    <td className="py-3.5 text-center">
                      <span className={`font-bold text-sm ${isLow ? 'text-yellow-400' : qty === 0 ? 'text-red-400' : 'text-grafito-900 dark:text-white'}`}>
                        {qty}
                      </span>
                    </td>
                    <td className="py-3.5 text-center text-xs text-grafito-400">{min}</td>
                    <td className="py-3.5 text-right pr-6 font-bold text-brand-500">${Number(p?.price ?? 0).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
