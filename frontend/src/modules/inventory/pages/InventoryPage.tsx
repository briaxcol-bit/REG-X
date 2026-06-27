import { useState, useEffect } from 'react'
import { Package, Loader2, Search, Tag, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { getInventory } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'
import type { InventoryRow } from '@lib/db'

export default function InventoryPage() {
  const { tenant, branch } = useAuthStore()
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')

  useEffect(() => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setLoading(true)
    getInventory(tenant.tenantId, branch.branchId)
      .then(setInventory)
      .catch(() => setInventory([]))
      .finally(() => setLoading(false))
  }, [tenant?.tenantId, branch?.branchId])

  const filtered = inventory.filter(row => {
    const p = row.products as any
    if (categoryId && p?.category_id !== categoryId) return false
    if (!search) return true
    return p?.name?.toLowerCase().includes(search.toLowerCase()) ||
           p?.sku?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Inventario</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Control de stock de productos.</p>
      </div>

      {/* Tabla inventario */}
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-grafito-100 dark:border-white/5">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-grafito-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400"
            />
            {categoryId && (
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams)
                  newParams.delete('category')
                  setSearchParams(newParams)
                }}
                className="flex items-center gap-1 rounded-md bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-500 hover:bg-brand-500/20 transition-colors"
                title="Quitar filtro de categoría"
              >
                Categoría <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Link
            to="/products/categories?from=inventory"
            className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-3.5 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all shrink-0 w-fit"
          >
            <Tag className="h-3.5 w-3.5" />
            Categorías
          </Link>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((row) => {
              const p   = row.products as any
              const cat = p?.categories as any
              const qty = Number(row.quantity)
              const min = Number(p?.min_stock ?? 0)
              const isLow = min > 0 && qty <= min
              return (
                <div key={row.id} className="group flex flex-col rounded-2xl bg-white dark:bg-grafito-900/80 border border-grafito-200 dark:border-white/5 overflow-hidden hover:shadow-xl hover:shadow-brand-500/5 hover:-translate-y-1 hover:border-brand-500/30 transition-all duration-300">
                  
                  {/* Imagen & Badges */}
                  <div className="h-44 bg-white dark:bg-grafito-800/50 flex items-center justify-center relative overflow-hidden">
                    {p?.image_url ? (
                      <img src={p.image_url} alt={p?.name ?? 'Producto'} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <Package className="h-10 w-10 text-grafito-300 dark:text-grafito-600 group-hover:scale-110 transition-transform duration-500" />
                    )}
                    
                    {/* Category Badge */}
                    {cat?.name && (
                      <span className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 dark:bg-grafito-900/95 backdrop-blur-sm text-[10px] font-bold shadow-sm border border-black/5 dark:border-white/10">
                        <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                        <span className="text-grafito-700 dark:text-grafito-200">{cat.name}</span>
                      </span>
                    )}
                    
                    {/* Stock Badge */}
                    <span className={cn(
                      "absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-sm border",
                      isLow ? 'bg-yellow-400/95 text-yellow-900 border-yellow-500/20' : 
                      qty === 0 ? 'bg-red-500/95 text-white border-red-600/20' :
                      'bg-white/95 dark:bg-grafito-900/95 text-grafito-700 dark:text-grafito-200 border-black/5 dark:border-white/10'
                    )}>
                      {qty} uds
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-base text-grafito-900 dark:text-white line-clamp-1" title={p?.name ?? ''}>{p?.name ?? '—'}</h3>
                    <p className="font-mono text-xs text-grafito-500 dark:text-grafito-400 mt-1">{p?.sku ?? '—'}</p>
                    
                    <div className="mt-4 pt-4 border-t border-grafito-100 dark:border-white/5 flex items-center justify-between">
                      <span className="text-lg font-black text-brand-500">${Number(p?.price ?? 0).toLocaleString('es-CO')}</span>
                      <div className="text-xs text-grafito-400 font-medium">
                        Mínimo: {min}
                      </div>
                    </div>
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
