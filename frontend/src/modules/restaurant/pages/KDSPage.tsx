import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'

export default function KDSPage() {
  const navigate = useNavigate()

  const tickets = [
    { id: '1', order: '#1024', table: 'Mesa 2', items: ['1x Hamburguesa Triple', '1x Papas Fritas L'], time: '8 min' },
    { id: '2', order: '#1025', table: 'Llevar', items: ['1x Pizza Pepperoni Familiar'], time: '2 min' }
  ]

  return (
    <div className="space-y-6 p-6 min-h-screen bg-white dark:bg-grafito-950">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/restaurant')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">KDS — Pantalla de Cocina</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Control y despacho de comandas de alimentos y bebidas.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tickets.map((t) => (
          <div key={t.id} className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-grafito-200 dark:border-white/5 pb-2">
                <div>
                  <h3 className="font-bold text-grafito-900 dark:text-white text-lg">{t.order}</h3>
                  <p className="text-xs text-brand-400 font-semibold">{t.table}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                  <Clock className="h-4 w-4" />
                  <span>{t.time}</span>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-grafito-600 dark:text-grafito-300">
                {t.items.map((item, idx) => (
                  <li key={idx} className="font-medium text-grafito-900 dark:text-white">{item}</li>
                ))}
              </ul>
            </div>
            <button className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-grafito-900 dark:text-white hover:bg-brand-600 transition-colors">
              Despachar / Completar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
