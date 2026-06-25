import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@shared/utils/format'

export default function SalesReportPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/reports')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Reporte de Ventas</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Detalle de ingresos y ventas en el período seleccionado.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-grafito-100 dark:bg-grafito-800 p-4 border border-grafito-200 dark:border-white/5">
            <p className="text-xs text-grafito-500 dark:text-grafito-400">Total Ingresos</p>
            <p className="text-2xl font-bold text-grafito-900 dark:text-white mt-1">{formatCurrency(1420.50)}</p>
          </div>
          <div className="rounded-xl bg-grafito-100 dark:bg-grafito-800 p-4 border border-grafito-200 dark:border-white/5">
            <p className="text-xs text-grafito-500 dark:text-grafito-400">Ticket Promedio</p>
            <p className="text-2xl font-bold text-grafito-900 dark:text-white mt-1">{formatCurrency(33.82)}</p>
          </div>
          <div className="rounded-xl bg-grafito-100 dark:bg-grafito-800 p-4 border border-grafito-200 dark:border-white/5">
            <p className="text-xs text-grafito-500 dark:text-grafito-400">Total Transacciones</p>
            <p className="text-2xl font-bold text-grafito-900 dark:text-white mt-1">42</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-grafito-900 dark:text-white">Ingresos por Método de Pago</h3>
          <div className="space-y-2">
            {[
              { name: 'Efectivo', amount: 840.50, percent: 59.2 },
              { name: 'Tarjeta de Crédito', amount: 480.00, percent: 33.8 },
              { name: 'Transferencia Bancaria', amount: 100.00, percent: 7.0 }
            ].map((m, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs text-grafito-600 dark:text-grafito-300">
                  <span>{m.name}</span>
                  <span className="font-semibold">{formatCurrency(m.amount)} ({m.percent}%)</span>
                </div>
                <div className="h-1.5 w-full bg-grafito-100 dark:bg-grafito-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${m.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
