import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'

export default function CategoriesPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/products')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-grafito-800 text-grafito-300 hover:bg-grafito-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Categorías</h1>
          <p className="text-sm text-grafito-400">Organiza tus productos en categorías y colores.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {[
          { name: 'Alimentos', color: 'bg-red-500', count: 12 },
          { name: 'Bebidas', color: 'bg-blue-500', count: 32 },
          { name: 'Postres', color: 'bg-pink-500', count: 8 },
          { name: 'Acompañamientos', color: 'bg-yellow-500', count: 15 }
        ].map((c) => (
          <div key={c.name} className="flex items-center justify-between rounded-2xl border border-white/5 bg-grafito-900/60 p-5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className={`h-4 w-4 rounded-full ${c.color}`}></span>
              <div>
                <h3 className="font-bold text-white text-sm">{c.name}</h3>
                <p className="text-xs text-grafito-400">{c.count} productos</p>
              </div>
            </div>
          </div>
        ))}

        <button className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-grafito-400 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all">
          <Plus className="h-5 w-5" />
          <span className="text-xs font-semibold">Nueva Categoría</span>
        </button>
      </div>
    </div>
  )
}
