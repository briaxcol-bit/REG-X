import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'

export default function TablesPage() {
  const navigate = useNavigate()

  const tables = [
    { id: '1', number: 'Mesa 1', status: 'Disponible', capacity: 4 },
    { id: '2', number: 'Mesa 2', status: 'Ocupada', capacity: 2 },
    { id: '3', number: 'Mesa 3', status: 'Sucia/Reservada', capacity: 6 },
    { id: '4', number: 'Mesa 4', status: 'Disponible', capacity: 4 }
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/restaurant')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Mapa de Mesas</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Distribución física y estado actual de las mesas.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tables.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl border p-5 space-y-4 backdrop-blur-md transition-all ${
              t.status === 'Disponible' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' :
              t.status === 'Ocupada' ? 'border-brand-500/20 bg-brand-500/5 text-brand-400' :
              'border-yellow-500/20 bg-yellow-500/5 text-yellow-400'
            }`}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-grafito-900 dark:text-white text-lg">{t.number}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                t.status === 'Disponible' ? 'bg-emerald-500/10 text-emerald-400' :
                t.status === 'Ocupada' ? 'bg-brand-500/10 text-brand-400' :
                'bg-yellow-500/10 text-yellow-400'
              }`}>
                {t.status}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-grafito-500 dark:text-grafito-400">
              <User className="h-3.5 w-3.5" />
              <span>Capacidad: {t.capacity} personas</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
