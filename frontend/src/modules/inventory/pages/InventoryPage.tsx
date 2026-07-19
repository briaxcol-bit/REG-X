import { useState, useEffect } from 'react'
import { Package, Loader2, Search, Tag, X, Pencil, Plus, Minus, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { getInventory, updateStock, deleteProduct } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { usePOSTerminal } from '@modules/pos/hooks/usePOSTerminal'
import { cn } from '@shared/utils/cn'
import { toast } from 'sonner'
import type { InventoryRow } from '@lib/db'
// ── Modal edición de stock ──────────────────────────────────────
interface EditStockModalProps {
  row: InventoryRow
  onClose: () => void
  onSaved: () => void
}

function EditStockModal({ row, onClose, onSaved }: EditStockModalProps) {
  const { tenant, branch, user } = useAuthStore()
  const p    = row.products as any
  const prev = Number(row.quantity)

  const [qtyStr, setQtyStr] = useState(String(Math.max(0, prev)))
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  const qty   = Math.max(0, parseInt(qtyStr) || 0)
  const delta = qty - prev

  const handleSave = async () => {
    if (!tenant?.tenantId || !branch?.branchId || !user?.id) return
    if (qty === prev) { onClose(); return }
    setSaving(true)
    try {
      await updateStock(
        tenant.tenantId,
        branch.branchId,
        user.id,
        row.id,
        row.product_id,
        qty,
        prev,
        notes.trim() || undefined,
      )
      toast.success(`Stock de "${p?.name}" actualizado a ${qty} uds.`)
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al actualizar el stock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div>
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Editar stock</h3>
          <p className="text-sm text-grafito-500 dark:text-grafito-400 mt-0.5 line-clamp-1">{p?.name ?? '—'}</p>
        </div>

        {/* Cantidad actual */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setQtyStr(String(Math.max(0, qty - 1)))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            <Minus className="h-4 w-4 text-grafito-600 dark:text-grafito-300" />
          </button>

          <div className="text-center">
            <input
              type="number"
              min={0}
              value={qtyStr}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '')
                setQtyStr(raw === '' ? '' : String(parseInt(raw)))
              }}
              onBlur={() => setQtyStr(String(qty))}
              className="w-24 text-center text-3xl font-black text-grafito-900 dark:text-white bg-transparent outline-none border-b-2 border-brand-500 pb-1"
            />
            <p className="text-xs text-grafito-400 mt-1">unidades</p>
          </div>

          <button
            onClick={() => setQtyStr(String(qty + 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            <Plus className="h-4 w-4 text-grafito-600 dark:text-grafito-300" />
          </button>
        </div>

        {/* Delta */}
        {qty !== Math.max(0, prev) && (
          <p className="text-center text-sm font-semibold text-emerald-500">
            Stock: {qty} unidades
          </p>
        )}

        {/* Nota */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-grafito-500 dark:text-grafito-400">
            Motivo del ajuste <span className="text-grafito-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ej: Conteo físico, devolución..."
            className="w-full rounded-xl bg-grafito-100 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 px-3 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || qty === prev}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal confirmación eliminar ────────────────────────────────
interface DeleteConfirmProps {
  name: string
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}
function DeleteConfirmModal({ name, onConfirm, onCancel, deleting }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-red-200 dark:border-red-500/20 bg-white dark:bg-grafito-900 shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/10 shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-grafito-900 dark:text-white">Eliminar producto</h3>
            <p className="text-sm text-grafito-500 dark:text-grafito-400 mt-0.5 line-clamp-2">¿Eliminar <span className="font-semibold text-grafito-700 dark:text-grafito-200">"{name}"</span>? Esta acción no se puede deshacer.</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} disabled={deleting} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-all disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-all disabled:opacity-50">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function InventoryPage() {
  const { tenant, branch, hasRole } = useAuthStore()
  const isOwner = hasRole('OWNER')
  // Categorías permitidas por la terminal asignada (null = todas)
  const { allowedCategories } = usePOSTerminal()
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [editing, setEditing]           = useState<InventoryRow | null>(null)
const [deletingRow, setDeletingRow]   = useState<InventoryRow | null>(null)
  const [deletingLoading, setDeletingLoading] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')

  const load = () => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setLoading(true)
    getInventory(tenant.tenantId, branch.branchId)
      .then(setInventory)
      .catch(() => setInventory([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tenant?.tenantId, branch?.branchId])

  const handleDelete = async () => {
    if (!deletingRow || !tenant?.tenantId) return
    const p = deletingRow.products as any
    const productId = deletingRow.product_id
    const productName = p?.name ?? 'Producto'
    setDeletingLoading(true)
    try {
      await deleteProduct(tenant.tenantId, productId)
      toast.success(`"${productName}" eliminado del catálogo.`)
      setDeletingRow(null)
      load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al eliminar el producto.')
    } finally {
      setDeletingLoading(false)
    }
  }

  const filtered = inventory.filter(row => {
    const p = row.products as any
    // Categorías "sin stock" (platos preparados) no se listan en inventario
    if ((p?.categories as any)?.track_inventory === false) return false
    // Restricción por terminal: solo categorías permitidas (los sin categoría siguen visibles)
    if (allowedCategories && p?.category_id && !allowedCategories.includes(p.category_id)) return false
    if (categoryId && p?.category_id !== categoryId) return false
    if (!search) return true
    return p?.name?.toLowerCase().includes(search.toLowerCase()) ||
           p?.sku?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6 p-6">
      {/* Delete confirm modal */}
      {deletingRow && (
        <DeleteConfirmModal
          name={(deletingRow.products as any)?.name ?? ''}
          onConfirm={handleDelete}
          onCancel={() => setDeletingRow(null)}
          deleting={deletingLoading}
        />
      )}

      {/* Edit stock modal */}
      {editing && (
        <EditStockModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
            {filtered.map((row) => {
              const p   = row.products as any
              const cat = p?.categories as any
              const qty = Number(row.quantity)
              const min = Number(p?.min_stock ?? 0)
              const isLow  = min > 0 && qty > 0 && qty <= min
              const isEmpty = qty === 0
              return (
                <div
                  key={row.id}
                  className={cn(
                    'group flex flex-col rounded-2xl bg-white dark:bg-grafito-900/80 border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300',
                    isEmpty ? 'border-red-300 dark:border-red-500/30' :
                    isLow   ? 'border-yellow-300 dark:border-yellow-500/30' :
                              'border-grafito-200 dark:border-white/5 hover:border-brand-500/30 hover:shadow-brand-500/5'
                  )}
                >
                  {/* Imagen & Badges */}
                  <div className="h-44 bg-white dark:bg-grafito-800/50 flex items-center justify-center relative overflow-hidden">
                    {p?.image_url ? (
                      <img src={p.image_url} alt={p?.name ?? 'Producto'} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <Package className="h-10 w-10 text-grafito-300 dark:text-grafito-600" />
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
                      'absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-sm border',
                      isEmpty ? 'bg-red-500/95 text-white border-red-600/20' :
                      isLow   ? 'bg-yellow-400/95 text-yellow-900 border-yellow-500/20' :
                                'bg-white/95 dark:bg-grafito-900/95 text-grafito-700 dark:text-grafito-200 border-black/5 dark:border-white/10'
                    )}>
                      {qty} uds
                    </span>
                  </div>

                  {/* Info & Acciones */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-base text-grafito-900 dark:text-white line-clamp-1" title={p?.name ?? ''}>{p?.name ?? '—'}</h3>
                    <p className="font-mono text-xs text-grafito-500 dark:text-grafito-400 mt-1">{p?.sku ?? '—'}</p>

                    <div className="mt-4 pt-4 border-t border-grafito-100 dark:border-white/5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-lg font-black text-brand-500 block leading-tight">${Number(p?.price ?? 0).toLocaleString('es-CO')}</span>
                        {min > 0 && <span className="text-xs text-grafito-400">Mínimo: {min} uds</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setEditing(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-grafito-50 dark:bg-white/5 text-grafito-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                          title="Ajustar stock"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
{isOwner && (
                          <button
                            onClick={() => setDeletingRow(row)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-grafito-50 dark:bg-white/5 text-grafito-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
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
