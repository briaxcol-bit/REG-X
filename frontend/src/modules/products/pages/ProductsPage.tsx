import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, Tag, Eye, Package, Loader2, Trash2, AlertTriangle, X } from 'lucide-react'
import { getProducts, deleteProduct } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import type { ProductRow } from '@lib/db'
import { cn } from '@shared/utils/cn'

// ── Confirmation Modal ────────────────────────────────────────
function DeleteModal({
  product,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  product: ProductRow
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
  error?: string | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl p-6 space-y-4">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-lg text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon + title */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-grafito-900 dark:text-white">
              Eliminar producto
            </h3>
            <p className="mt-1 text-sm text-grafito-500 dark:text-grafito-400">
              ¿Estás seguro de que quieres eliminar{' '}
              <span className="font-semibold text-grafito-700 dark:text-grafito-200">
                {product.name}
              </span>
              ? Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-center text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function ProductsPage() {
  const { tenant } = useAuthStore()
  const [products, setProducts]     = useState<ProductRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [toDelete, setToDelete]     = useState<ProductRow | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')

  const loadProducts = () => {
    if (!tenant?.tenantId) return
    setLoading(true)
    getProducts(tenant.tenantId, { search: search || undefined, categoryId: categoryId || undefined })
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProducts() }, [tenant?.tenantId, search, categoryId])

  const handleDelete = async () => {
    if (!toDelete || !tenant?.tenantId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteProduct(tenant.tenantId, toDelete.id)
      setToDelete(null)
      loadProducts()
    } catch (err: any) {
      setDeleteError(err?.message ?? 'Error al eliminar el producto.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Modal confirmación */}
      {toDelete && (
        <DeleteModal
          product={toDelete}
          onConfirm={handleDelete}
          onCancel={() => { setToDelete(null); setDeleteError(null) }}
          loading={deleting}
          error={deleteError}
        />
      )}

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
          to="/products/categories"
          className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-3.5 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all"
        >
          <Tag className="h-3.5 w-3.5" />
          Categorías
        </Link>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-grafito-400 bg-white dark:bg-grafito-900/60 rounded-2xl border border-grafito-200 dark:border-white/5">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando productos...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-grafito-400 bg-white dark:bg-grafito-900/60 rounded-2xl border border-grafito-200 dark:border-white/5">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((p) => {
            const stock = (p.inventory ?? []).reduce((s, i) => s + Number(i.quantity), 0)
            const cat = p.categories as any
            return (
              <div key={p.id} className="group flex flex-col rounded-2xl bg-white dark:bg-grafito-900/80 border border-grafito-200 dark:border-white/5 overflow-hidden hover:shadow-xl hover:shadow-brand-500/5 hover:-translate-y-1 hover:border-brand-500/30 transition-all duration-300">
                
                {/* Imagen & Badges */}
                <div className="aspect-[4/3] bg-grafito-100 dark:bg-grafito-800/50 flex items-center justify-center relative overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                    stock === 0 ? 'bg-red-500/95 text-white border-red-600/20' :
                    stock <= 5  ? 'bg-yellow-400/95 text-yellow-900 border-yellow-500/20' : 
                                  'bg-white/95 dark:bg-grafito-900/95 text-grafito-700 dark:text-grafito-200 border-black/5 dark:border-white/10'
                  )}>
                    {stock} uds
                  </span>
                </div>

                {/* Info & Acciones */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-base text-grafito-900 dark:text-white line-clamp-1" title={p.name}>{p.name}</h3>
                  <p className="font-mono text-xs text-grafito-500 dark:text-grafito-400 mt-1">{p.sku || 'Sin SKU'}</p>
                  
                  <div className="mt-4 pt-4 border-t border-grafito-100 dark:border-white/5 flex items-center justify-between">
                    <span className="text-lg font-black text-brand-500">${Number(p.price).toLocaleString('es-CO')}</span>
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/products/${p.id}/edit`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-grafito-50 dark:bg-white/5 text-grafito-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                        title="Editar"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setToDelete(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-grafito-50 dark:bg-white/5 text-grafito-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
