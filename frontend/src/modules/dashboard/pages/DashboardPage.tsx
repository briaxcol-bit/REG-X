import { motion } from 'framer-motion'
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, ArrowUpRight, Plus, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@shared/utils/format'

export default function DashboardPage() {
  const stats = [
    { name: 'Ventas del Día', value: formatCurrency(1420.50), change: '+12.5%', changeType: 'positive', icon: DollarSign, color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400' },
    { name: 'Órdenes Activas', value: '42', change: '+8.2%', changeType: 'positive', icon: ShoppingCart, color: 'from-blue-500/20 to-indigo-500/20 text-blue-400' },
    { name: 'Clientes Nuevos', value: '18', change: '+22.1%', changeType: 'positive', icon: Users, color: 'from-purple-500/20 to-pink-500/20 text-purple-400' },
    { name: 'Productos en Stock', value: '245', change: '-2 items', changeType: 'neutral', icon: Package, color: 'from-amber-500/20 to-orange-500/20 text-amber-400' }
  ]

  const recentSales = [
    { id: '1', customer: 'Carlos Gómez', amount: 45.90, time: 'Hace 5 min', status: 'Completado' },
    { id: '2', customer: 'María Restrepo', amount: 120.00, time: 'Hace 12 min', status: 'Completado' },
    { id: '3', customer: 'Juan Pérez', amount: 15.50, time: 'Hace 24 min', status: 'Completado' },
    { id: '4', customer: 'Ana Rodríguez', amount: 82.30, time: 'Hace 45 min', status: 'Pendiente' }
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Control</h1>
          <p className="text-sm text-grafito-400">Resumen y estado actual de tu negocio.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-white/5 bg-grafito-800 px-4 py-2.5 text-sm text-grafito-300 hover:bg-grafito-700 transition-all">
            <Calendar className="h-4 w-4" />
            Hoy (24 Jun, 2026)
          </button>
          <Link
            to="/pos"
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" />
            Nueva Venta (POS)
          </Link>
        </div>
      </div>

      {/* Grid de Estadísticas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative overflow-hidden rounded-2xl border border-white/5 bg-grafito-900/60 p-6 backdrop-blur-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-grafito-400">{stat.name}</span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-bold text-white">{stat.value}</span>
              <div className="mt-1 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-semibold">{stat.change}</span>
                <span className="text-[10px] text-grafito-500">vs ayer</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Grid Principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gráfico / Info Principal (2/3 de ancho) */}
        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Rendimiento de Ventas</h2>
            <span className="text-xs text-grafito-400 hover:underline cursor-pointer">Ver reporte completo</span>
          </div>
          {/* Un placeholder gráfico con gradiente y líneas simuladas */}
          <div className="relative h-60 w-full rounded-xl bg-grafito-950 p-4 overflow-hidden border border-white/5">
            <div className="absolute inset-0 bg-gradient-to-t from-brand-500/5 to-transparent opacity-60"></div>
            {/* Barras/líneas simuladas para hacerlo ver sofisticado */}
            <div className="flex h-full items-end justify-between gap-2 pt-6">
              {[40, 55, 45, 60, 75, 50, 65, 80, 70, 85, 90, 100].map((height, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 transition-all cursor-pointer"
                    style={{ height: `${height}%` }}
                  ></div>
                  <span className="text-[9px] text-grafito-600 font-bold">M{i+1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ventas Recientes (1/3 de ancho) */}
        <div className="rounded-2xl border border-white/5 bg-grafito-900/60 p-6 backdrop-blur-md space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Últimas Actividades</h2>
            <p className="text-xs text-grafito-400">Monitoreo en tiempo real de transacciones.</p>
          </div>
          <div className="space-y-3.5 my-4">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-xl bg-grafito-800/40 p-3 border border-white/5">
                <div>
                  <p className="text-sm font-semibold text-white">{sale.customer}</p>
                  <p className="text-[10px] text-grafito-400">{sale.time}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-400">{formatCurrency(sale.amount)}</p>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                    sale.status === 'Completado' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {sale.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/reports/sales"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/5 bg-grafito-800 py-2.5 text-xs text-grafito-300 hover:bg-grafito-700 transition-all"
          >
            Ver Todas las Ventas
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
