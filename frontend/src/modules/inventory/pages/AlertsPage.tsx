import { useState, useEffect } from 'react'
import { AlertTriangle, Loader2, Package, Search } from 'lucide-react'
import { getInventory } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import type { InventoryRow } from '@lib/db'

export default function AlertsPage() {
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

  // Filter low stock
  const lowStock = inventory.filter(row => {
    const p = row.products as any
    const min = Number(p?.min_stock ?? 0)
    const qty = Number(row.quantity)
    return qty <= min || qty === 0
  })

  const filtered = lowStock.filter(row => {
    if (!search) return true
    const p = row.products as any
    return p?.name?.toLowerCase().includes(search.toLowerCase()) ||
           p?.sku?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Alertas de Stock</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Productos con inventario bajo o agotado.</p>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-grafito-100 dark:border-white/5">
          <Search className="h-4 w-4 text-grafito-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en alertas..."
            className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-grafito-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando alertas...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-grafito-400">
            <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center mb-2">
              <Package className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-sm font-medium text-grafito-900 dark:text-white">¡Todo está bien!</p>
            <p className="text-xs">No hay productos con stock bajo.</p>
          </div>
        ) : (
          <div className="divide-y divide-grafito-100 dark:divide-white/5">
            {filtered.map((row) => {
              const p = row.products as any
              const cat = p?.categories as any
              const qty = Number(row.quantity)
              const min = Number(p?.min_stock ?? 0)
              const isOut = qty === 0

              return (
                <div key={row.id} className="flex items-center gap-4 p-4 hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors">
                  <div className="h-12 w-12 rounded-xl bg-grafito-100 dark:bg-grafito-800 flex items-center justify-center shrink-0 overflow-hidden">
                    {p?.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-grafito-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-grafito-900 dark:text-white truncate">{p?.name}</h3>
                      {isOut ? (
                         <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-500">AGOTADO</span>
                      ) : (
                         <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold text-orange-500">STOCK BAJO</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-grafito-500 dark:text-grafito-400">
                      <span>SKU: {p?.sku || 'N/A'}</span>
                      {cat && (
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: cat.color }}></span>
                          {cat.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-grafito-900 dark:text-white">{qty} uds</p>
                    <p className="text-xs text-grafito-500">Mínimo: {min}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
