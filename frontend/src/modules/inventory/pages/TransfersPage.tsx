import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'

export default function TransfersPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Transferencias</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Transferencia de productos entre sucursales o bodegas.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-grafito-900 dark:text-white hover:bg-brand-600 transition-all">
          <Plus className="h-4 w-4" />
          Nueva Transferencia
        </button>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md text-center py-12 space-y-4">
        <p className="text-sm text-grafito-500 dark:text-grafito-400">No hay transferencias registradas en este momento.</p>
      </div>
    </div>
  )
}
