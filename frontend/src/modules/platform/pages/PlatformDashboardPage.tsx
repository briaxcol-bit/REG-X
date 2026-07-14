import { useQuery } from '@tanstack/react-query'
import { getPlatformStats, getAllTenants } from '@lib/db'
import {
  Building2, Users, CreditCard, TrendingUp,
  Loader2, Globe, CheckCircle, AlertCircle,
} from 'lucide-react'
import { formatCurrency } from '@shared/utils/format'
import { useAuthStore } from '@store/auth.store'

const PLAN_COLORS: Record<string, string> = {
  FREE:         'bg-grafito-500/10 text-grafito-400',
  BASIC:        'bg-blue-500/10 text-blue-400',
  PROFESSIONAL: 'bg-purple-500/10 text-purple-400',
  ENTERPRISE:   'bg-brand-500/10 text-brand-400',
}

const BUSINESS_LABELS: Record<string, string> = {
  STORE:      'Tienda',
  RESTAURANT: 'Restaurante',
  CAFE:       'Cafetería',
  BAR:        'Bar',
  SERVICE:    'Servicios',
  WHOLESALE:  'Mayorista',
  OTHER:      'Otro',
}

export default function PlatformDashboardPage() {
  const profile = useAuthStore((s) => s.profile)

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
    refetchInterval: 60_000,
  })

  const { data: tenants = [], isLoading: loadingTenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: getAllTenants,
    refetchInterval: 60_000,
  })

  const kpis = [
    {
      label: 'Tenants Activos',
      value: stats?.activeTenants ?? 0,
      sub: `${stats?.totalTenants ?? 0} total`,
      icon: Building2,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Suscripciones Activas',
      value: stats?.activeSubscriptions ?? 0,
      sub: 'en este momento',
      icon: CreditCard,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Dueños de Negocio',
      value: stats?.totalOwners ?? 0,
      sub: `${stats?.totalUsers ?? 0} usuarios en total (incluye empleados)`,
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'MRR',
      value: formatCurrency(stats?.mrr ?? 0, 'USD'),
      sub: `+${stats?.newThisMonth ?? 0} tenants este mes`,
      icon: TrendingUp,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
    },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">
          Panel de Plataforma
        </h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">
          Bienvenido, {profile?.fullName ?? 'Super Admin'} — visión global de REG-X.
        </p>
      </div>

      {/* KPI cards */}
      {loadingStats ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-grafito-400" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => {
            const Icon = k.icon
            return (
              <div
                key={k.label}
                className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 backdrop-blur-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-grafito-500 dark:text-grafito-400">{k.label}</p>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${k.bg}`}>
                    <Icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-grafito-900 dark:text-white">{k.value}</p>
                <p className="text-xs text-grafito-500 dark:text-grafito-400">{k.sub}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Plan breakdown + Recent tenants */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Plan distribution */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <h2 className="font-semibold text-grafito-900 dark:text-white">Distribución por Plan</h2>
          {(stats?.planBreakdown ?? []).length === 0 ? (
            <p className="text-sm text-grafito-400">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {stats!.planBreakdown.map((p) => {
                const pct = stats!.totalTenants > 0
                  ? Math.round((p.count / stats!.totalTenants) * 100)
                  : 0
                return (
                  <div key={p.plan} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className={`font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[p.plan] ?? 'bg-grafito-100 text-grafito-500'}`}>
                        {p.plan}
                      </span>
                      <span className="text-grafito-500 dark:text-grafito-400">{p.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-grafito-100 dark:bg-grafito-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent tenants */}
        <div className="lg:col-span-2 rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
          <div className="px-6 py-4 border-b border-grafito-200 dark:border-white/5 flex items-center justify-between">
            <h2 className="font-semibold text-grafito-900 dark:text-white">Tenants Recientes</h2>
            <Globe className="h-4 w-4 text-grafito-400" />
          </div>
          {loadingTenants ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-grafito-400" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-grafito-400">
              Sin tenants registrados
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5">
                  <th className="px-6 py-3">Empresa</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                {tenants.slice(0, 8).map((t) => (
                  <tr key={t.id} className="hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-semibold text-grafito-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-grafito-400 font-mono">{t.slug}</p>
                    </td>
                    <td className="px-6 py-3 text-grafito-500 dark:text-grafito-400 text-xs">
                      {BUSINESS_LABELS[t.business_type] ?? t.business_type}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${PLAN_COLORS[t.plan] ?? ''}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {t.is_active ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                          <CheckCircle className="h-3.5 w-3.5" /> Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                          <AlertCircle className="h-3.5 w-3.5" /> Inactivo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
