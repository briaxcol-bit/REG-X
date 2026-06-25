import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Tag, Eye, Package, Loader2 } from 'lucide-react'
import { getProducts } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import type { ProductRow } from '@lib/db'

export default function ProductsPage() {
  const { tenant } = useAuthStore()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    if (!tenant?.tenantId) return
    setLoading(true)
    getProducts(tenant.tenantId, { search: search || undefined })
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [tenant?.tenantId, search])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Productos</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Catálogo general de tus artículos y servicios.</p>
        </div>
        <Link
          to="/products/new"
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuevo Producto
        </Link>
      </div>

      {/* Barra búsqueda */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-grafito-900/60 p-4 rounded-xl border border-grafito-200 dark:border-white/5">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-grafito-100 dark:bg-grafito-800 px-3 py-2">
          <Search className="h-4 w-4 text-grafito-500 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o código de barra..."
            className="flex-1 bg-transparent text-sm placeholder:text-grafito-400 dark:placeholder:text-grafito-600 outline-none text-grafito-900 dark:text-white"
          />
        </div>
        <Link
          to="/products/categories"
          className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-3.5 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all"
        >
          <Tag className="h-3.5 w-3.5" />
          Categorías
        </Link>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-grafito-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando productos...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-grafito-400">
            <Package className="h-10 w-10 opacity-30" />
            <p className="text-sm">No hay productos registrados.</p>
            <Link
              to="/products/new"
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear primer producto
            </Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-grafito-600 dark:text-grafito-300">
            <thead>
              <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5">
                <th className="px-6 pb-3 pt-5">Producto</th>
                <th className="pb-3 pt-5">SKU</th>
                <th className="pb-3 pt-5">Categoría</th>
                <th className="pb-3 pt-5">Precio</th>
                <th className="pb-3 pt-5">Stock</th>
                <th className="pb-3 pt-5 text-right pr-6">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {products.map((p) => {
                const stock = (p.inventory ?? []).reduce((s, i) => s + Number(i.quantity), 0)
                const cat = p.categories as any
                return (
                  <tr key={p.id} className="hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-grafito-100 dark:bg-grafito-800 shrink-0">
                            <Package className="h-4 w-4 text-grafito-400" />
                          </div>
                        )}
                        <span className="font-semibold text-grafito-900 dark:text-white">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 font-mono text-xs">{p.sku}</td>
                    <td className="py-3.5">
                      {cat ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-xs text-grafito-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 font-bold text-brand-500">${Number(p.price).toFixed(2)}</td>
                    <td className="py-3.5">
                      <span className={
                        stock === 0 ? 'text-red-400 font-semibold' :
                        stock <= 5  ? 'text-yellow-400 font-semibold' : ''
                      }>
                        {stock} uds
                      </span>
                    </td>
                    <td className="py-3.5 text-right pr-6">
                      <Link
                        to={`/products/${p.id}/edit`}
                        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Editar
                      </Link>
                    </td>
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
