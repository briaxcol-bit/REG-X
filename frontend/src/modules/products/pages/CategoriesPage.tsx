import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'
import { getCategories } from '@lib/db'
import type { CategoryRow } from '@lib/db'
import { useAuthStore } from '@store/auth.store'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from') || 'products'
  const { tenant } = useAuthStore()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)

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
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ background: c.color }}></span>
                <div>
                  <h3 className="font-bold text-grafito-900 dark:text-white text-sm group-hover:text-brand-500 transition-colors">{c.name}</h3>
                </div>
              </div>
            </div>
          ))}

          <button className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-grafito-200 dark:border-white/10 bg-white/5 p-5 text-grafito-500 dark:text-grafito-400 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all h-[88px]">
            <Plus className="h-5 w-5" />
            <span className="text-xs font-semibold">Nueva Categoría</span>
          </button>
        </div>
      )}
    </div>
  )
}
