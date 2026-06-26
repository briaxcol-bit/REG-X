import { motion } from 'framer-motion'
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, TrendingDown, ArrowUpRight, Plus, Calendar, Loader2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { formatCurrency } from '@shared/utils/format'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useAuthStore } from '@store/auth.store'

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats()
  const branch = useAuthStore((s) => s.branch)

  const pct = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%'
    const p = ((current - previous) / previous) * 100
    return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`
  }

  const navigate = useNavigate()

  const statsCards = stats
    ? [
        {
          name: 'Ventas del Día',
          value: formatCurrency(stats.salesToday, branch?.currency),
          change: pct(stats.salesToday, stats.salesYesterday),
          positive: stats.salesToday >= stats.salesYesterday,
          icon: DollarSign,
          color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400',
          path: '/reports/sales',
        },
        {
          name: 'Órdenes Activas',
          value: String(stats.activeOrders),
          change: 'pendientes',
          positive: true,
          icon: ShoppingCart,
          color: 'from-blue-500/20 to-indigo-500/20 text-blue-400',
          path: '/pos',
        },
        {
          name: 'Clientes Nuevos',
          value: String(stats.newCustomersToday),
          change: pct(stats.newCustomersToday, stats.newCustomersYesterday),
          positive: stats.newCustomersToday >= stats.newCustomersYesterday,
          icon: Users,
          color: 'from-purple-500/20 to-pink-500/20 text-purple-400',
          path: '/customers',
        },
        {
          name: 'Productos en Stock',
          value: String(stats.totalStock),
          change: 'unidades',
          positive: true,
          icon: Package,
          color: 'from-amber-500/20 to-orange-500/20 text-amber-400',
          path: '/inventory',
        },
      ]
    : []

  // Calcular max para escalar el gráfico
  const maxMonthly = Math.max(...(stats?.monthlySales.map((m) => m.total) ?? [1]), 1)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Panel de Control</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Resumen y estado actual de tu negocio.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-4 py-2.5 text-sm text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all">
            <Calendar className="h-4 w-4" />
            Hoy ({new Date().toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })})
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

      {/* Stats grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-grafito-400" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat, i) => (
            <motion.div
              key={stat.name}
              onClick={() => navigate(stat.path)}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md cursor-pointer hover:border-brand-500/30 hover:scale-[1.02] hover:shadow-xl hover:shadow-brand-500/5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-grafito-500 dark:text-grafito-400 group-hover:text-grafito-900 dark:group-hover:text-white transition-colors">{stat.name}</span>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold text-grafito-900 dark:text-white">{stat.value}</span>
                <div className="mt-1 flex items-center gap-1.5">
                  {stat.positive
                    ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                    : <TrendingDown className="h-3 w-3 text-red-400" />
                  }
                  <span className={`text-xs font-semibold ${stat.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stat.change}
                  </span>
                  <span className="text-[10px] text-grafito-500">vs ayer</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales chart */}
        <div className="lg:col-span-2 rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-grafito-900 dark:text-white">Rendimiento de Ventas</h2>
            <span className="text-xs text-grafito-500 dark:text-grafito-400">Año actual — por mes</span>
          </div>
          <div className="relative h-60 w-full rounded-xl bg-white dark:bg-grafito-950 p-4 overflow-hidden border border-grafito-200 dark:border-white/5">
            <div className="absolute inset-0 bg-gradient-to-t from-brand-500/5 to-transparent opacity-60" />
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-grafito-400" />
              </div>
            ) : (
              <div className="flex h-full items-end justify-between gap-2 pt-6">
                {(stats?.monthlySales ?? Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 }))).map((m) => {
                  const pct = maxMonthly > 0 ? Math.max((m.total / maxMonthly) * 100, m.total > 0 ? 4 : 0) : 0
                  const months = ['E','F','M','A','M','J','J','A','S','O','N','D']
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="relative w-full">
                        {m.total > 0 && (
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-grafito-800 text-white text-[9px] rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                            {formatCurrency(m.total, branch?.currency)}
                          </div>
                        )}
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 transition-all cursor-pointer"
                          style={{ height: `${Math.max(pct, 2)}%`, minHeight: m.total > 0 ? '4px' : '2px' }}
                        />
                      </div>
                      <span className="text-[9px] text-grafito-600 dark:text-grafito-400 font-bold">{months[m.month - 1]}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent sales */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-grafito-900 dark:text-white">Últimas Actividades</h2>
            <p className="text-xs text-grafito-500 dark:text-grafito-400">Transacciones recientes.</p>
          </div>

          <div className="space-y-3 my-2 flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-5 w-5 animate-spin text-grafito-400" />
              </div>
            ) : stats?.recentSales.length === 0 ? (
              <p className="text-center text-sm text-grafito-400 py-8">Sin ventas aún</p>
            ) : (
              stats?.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between rounded-xl bg-grafito-100 dark:bg-grafito-800/40 p-3 border border-grafito-200 dark:border-white/5">
                  <div>
                    <p className="text-sm font-semibold text-grafito-900 dark:text-white">{sale.customer}</p>
                    <p className="text-[10px] text-grafito-500 dark:text-grafito-400">{sale.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-400">{formatCurrency(sale.amount, branch?.currency)}</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                      sale.status === 'Completado' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {sale.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link
            to="/reports/sales"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 py-2.5 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all"
          >
            Ver Todas las Ventas
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
