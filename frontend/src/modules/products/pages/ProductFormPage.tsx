import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'

export default function ProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/products')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">
            {isEdit ? 'Editar Producto' : 'Crear Producto'}
          </h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">
            {isEdit ? 'Modifica los detalles del producto existente.' : 'Registra un nuevo producto en tu catálogo.'}
          </p>
        </div>
      </div>

      <form className="space-y-4 rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wider">Nombre del Producto</label>
          <input
            placeholder="Ej. Coca-Cola 350ml"
            className="w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-950 px-3.5 py-2.5 text-grafito-900 dark:text-white focus:border-brand-500 transition-colors outline-none text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wider">Precio de Venta</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-950 px-3.5 py-2.5 text-grafito-900 dark:text-white focus:border-brand-500 transition-colors outline-none text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wider">Stock Inicial</label>
            <input
              type="number"
              placeholder="0"
              className="w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-950 px-3.5 py-2.5 text-grafito-900 dark:text-white focus:border-brand-500 transition-colors outline-none text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wider">Código SKU / Código de barras</label>
          <input
            placeholder="Ej. SKU-770123"
            className="w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-950 px-3.5 py-2.5 text-grafito-900 dark:text-white focus:border-brand-500 transition-colors outline-none text-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => navigate('/products')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-grafito-900 dark:text-white hover:bg-brand-600 active:scale-[0.98] transition-all"
        >
          <Save className="h-4 w-4" />
          Guardar Producto
        </button>
      </form>
    </div>
  )
}
