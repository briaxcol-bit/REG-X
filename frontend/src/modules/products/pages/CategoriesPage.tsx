import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, Pencil, Trash2, Boxes, ChefHat } from 'lucide-react'
import { getCategories, createCategory, updateCategory, deleteCategory, setCategoryTrackInventory } from '@lib/db'
import type { CategoryRow } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') || 'products'
  const { tenant } = useAuthStore()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<CategoryRow | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#10B981')
  const [savingCat, setSavingCat] = useState(false)

  const handleSaveCategory = async () => {
    if (!tenant || !newCatName.trim()) return
    try {
      setSavingCat(true)
      if (editingCategory) {
        const cat = await updateCategory(tenant.tenantId, editingCategory.id, newCatName, newCatColor)
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? cat : c))
        toast.success('Categoría actualizada exitosamente')
      } else {
        const cat = await createCategory(tenant.tenantId, newCatName, newCatColor)
        setCategories(prev => [...prev, cat])
        toast.success('Categoría creada exitosamente')
      }
      setIsModalOpen(false)
      setEditingCategory(null)
      setNewCatName('')
      setNewCatColor('#10B981')
    } catch (error) {
      console.error(error)
      toast.error(editingCategory ? 'Error al actualizar la categoría' : 'Error al crear la categoría')
    } finally {
      setSavingCat(false)
    }
  }

  const openEditModal = (e: React.MouseEvent, c: CategoryRow) => {
    e.stopPropagation()
    setEditingCategory(c)
    setNewCatName(c.name)
    setNewCatColor(c.color || '#10B981')
    setIsModalOpen(true)
  }

  const handleToggleStock = async (e: React.MouseEvent, c: CategoryRow) => {
    e.stopPropagation()
    if (!tenant) return
    const next = !(c.track_inventory ?? true)
    try {
      const updated = await setCategoryTrackInventory(tenant.tenantId, c.id, next)
      setCategories(prev => prev.map(x => x.id === c.id ? updated : x))
      toast.success(next
        ? `"${c.name}" ahora maneja stock: sus productos validan inventario.`
        : `"${c.name}" ya no maneja stock: sus productos se venden sin límite (ideal para platos preparados).`)
    } catch {
      toast.error('Error al cambiar el control de stock')
    }
  }

  const handleDeleteCategory = async () => {
    if (!tenant || !deletingCategory) return
    try {
      setSavingCat(true)
      await deleteCategory(tenant.tenantId, deletingCategory.id)
      setCategories(prev => prev.filter(c => c.id !== deletingCategory.id))
      setDeletingCategory(null)
      toast.success('Categoría eliminada exitosamente')
    } catch (error) {
      console.error(error)
      toast.error('Error al eliminar la categoría')
    } finally {
      setSavingCat(false)
    }
  }

  useEffect(() => {
    if (!tenant) return
    getCategories(tenant.tenantId)
      .then(setCategories)
      .finally(() => setLoading(false))
  }, [tenant])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/products')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Categorías</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Organiza tus productos en categorías y colores.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-grafito-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {categories.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/${from}?category=${c.id}`)}
              className="group flex items-center justify-between rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 backdrop-blur-md cursor-pointer hover:border-brand-500/50 hover:bg-brand-500/5 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-4 w-4 rounded-full flex-none" style={{ background: c.color }}></span>
                <div className="min-w-0">
                  <h3 className="font-bold text-grafito-900 dark:text-white text-sm group-hover:text-brand-500 transition-colors truncate">{c.name}</h3>
                  {/* Toggle: ¿los productos de esta categoría manejan stock? */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleStock(e, c)}
                    title={(c.track_inventory ?? true)
                      ? 'Click para vender sin control de stock (p. ej. platos de comida)'
                      : 'Click para volver a controlar el stock'}
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-colors ${
                      (c.track_inventory ?? true)
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/20'
                    }`}
                  >
                    {(c.track_inventory ?? true)
                      ? <><Boxes className="h-3 w-3" /> Con stock</>
                      : <><ChefHat className="h-3 w-3" /> Sin stock</>}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => openEditModal(e, c)}
                  className="p-2 text-grafito-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDeletingCategory(c) }}
                  className="p-2 text-grafito-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <button 
            onClick={() => {
              setEditingCategory(null)
              setNewCatName('')
              setNewCatColor('#10B981')
              setIsModalOpen(true)
            }}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-grafito-200 dark:border-white/10 bg-white/5 p-5 text-grafito-500 dark:text-grafito-400 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all h-[88px]"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-semibold">Nueva Categoría</span>
          </button>
        </div>
      )}

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-xs rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-grafito-900 dark:text-white">
              {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
            </h3>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wider">Nombre</label>
              <input
                autoFocus
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="Ej: Bebidas, Snacks…"
                className="w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 px-4 py-3 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
                onKeyDown={e => e.key === 'Enter' && handleSaveCategory()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wider">Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newCatColor}
                  onChange={e => setNewCatColor(e.target.value)}
                  className="h-10 w-10 rounded-lg cursor-pointer border border-grafito-200 dark:border-white/10 bg-transparent p-0"
                />
                <span className="text-sm text-grafito-500">{newCatColor}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-medium text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-grafito-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                disabled={!newCatName.trim() || savingCat}
                className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-40 transition-colors"
              >
                {savingCat ? 'Guardando…' : (editingCategory ? 'Guardar' : 'Crear')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deletingCategory && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingCategory(null)} />
          <div className="relative w-full max-w-xs rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-grafito-900 dark:text-white">Eliminar categoría</h3>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">¿Estás seguro de que deseas eliminar la categoría <strong className="text-grafito-900 dark:text-white">{deletingCategory.name}</strong>?</p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-medium text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-grafito-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={savingCat}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                {savingCat ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
