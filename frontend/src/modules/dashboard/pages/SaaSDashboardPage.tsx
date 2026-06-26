import { motion } from 'framer-motion'
import { Server, Database, Activity, RefreshCw } from 'lucide-react'

export default function SaaSDashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">SaaS Dashboard</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Consola de administración para la plataforma global de REG-X.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-grafito-900 dark:text-white">Estado de Servidores</h3>
            <Server className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-grafito-900 dark:text-white">99.98%</p>
          <p className="text-xs text-grafito-500 dark:text-grafito-400">Uptime global en las últimas 24 horas.</p>
        </div>

        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-grafito-900 dark:text-white">Bases de Datos Activas</h3>
            <Database className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-grafito-900 dark:text-white">3,240</p>
          <p className="text-xs text-grafito-500 dark:text-grafito-400">Instancias de Tenants aprovisionadas.</p>
        </div>

        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-grafito-900 dark:text-white">Solicitudes por Minuto</h3>
            <Activity className="h-5 w-5 text-brand-400" />
          </div>
          <p className="text-3xl font-bold text-grafito-900 dark:text-white">12,450 rpm</p>
          <p className="text-xs text-grafito-500 dark:text-grafito-400">Tráfico balanceado correctamente.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-grafito-200 dark:border-white/5 pb-4">
          <h2 className="text-lg font-bold text-grafito-900 dark:text-white">Tenants Recientes</h2>
          <button className="flex items-center gap-1.5 text-xs text-brand-400 hover:underline">
            <RefreshCw className="h-3.5 w-3.5" />
            Recargar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-grafito-600 dark:text-grafito-300">
            <thead>
              <tr className="text-xs font-semibold text-grafito-500 uppercase">
                <th className="py-2.5">Empresa</th>
                <th className="py-2.5">Slug</th>
                <th className="py-2.5">Plan</th>
                <th className="py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { name: 'Burger Palace', slug: 'burger-palace', plan: 'Enterprise', status: 'Activo' },
                { name: 'Modas Express', slug: 'modas-express', plan: 'Professional', status: 'Activo' },
                { name: 'Ferretería Central', slug: 'ferre-central', plan: 'Basic', status: 'En Espera' }
              ].map((t, i) => (
                <tr key={i} className="hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3 font-semibold text-grafito-900 dark:text-white">{t.name}</td>
                  <td className="py-3 font-mono text-xs">{t.slug}</td>
                  <td className="py-3">{t.plan}</td>
                  <td className="py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      t.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
