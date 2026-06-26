import { Link } from 'react-router-dom'
import { BarChart3, LineChart, PieChart, TrendingUp } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Reportes y Estadísticas</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Analiza el rendimiento general de tu negocio.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/reports/sales"
          className="flex flex-col justify-between rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md hover:border-brand-500/30 transition-all space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-grafito-900 dark:text-white">Reporte de Ventas</h3>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Ingresos, transacciones promedio y métodos de pago.</p>
        </Link>

        <Link
          to="/inventory/movements"
          className="flex flex-col justify-between rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md hover:border-brand-500/30 transition-all space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-grafito-900 dark:text-white">Reporte de Inventario</h3>
            <BarChart3 className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Rotación de stock y movimientos de productos.</p>
        </Link>

        <Link
          to="/inventory/valuation"
          className="flex flex-col justify-between rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md hover:border-brand-500/30 transition-all space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-grafito-900 dark:text-white">Márgenes y Costos</h3>
            <LineChart className="h-5 w-5 text-brand-400" />
          </div>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Análisis de rentabilidad y valorización del inventario.</p>
        </Link>
      </div>
    </div>
  )
}
