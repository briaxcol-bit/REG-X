import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAllPlatformUsers } from '@lib/db'
import { Users, Search, Loader2, ShieldCheck } from 'lucide-react'
import { cn } from '@shared/utils/cn'

const PLATFORM_ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN:   'bg-brand-500/15 text-brand-400 border border-brand-500/20',
  SUPPORT:       'bg-blue-500/10 text-blue-400',
  SALES_MANAGER: 'bg-purple-500/10 text-purple-400',
}

const BIZ_ROLE_STYLES: Record<string, string> = {
  OWNER:             'bg-yellow-500/10 text-yellow-400',
  ADMIN:             'bg-orange-500/10 text-orange-400',
  CASHIER:           'bg-emerald-500/10 text-emerald-400',
  WAITER:            'bg-teal-500/10 text-teal-400',
  CHEF:              'bg-red-500/10 text-red-400',
  INVENTORY_MANAGER: 'bg-cyan-500/10 text-cyan-400',
}

export default function PlatformUsersPage() {
  const [search, setSearch] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['platform-users'],
    queryFn: getAllPlatformUsers,
  })

  const filtered = users.filter((u) =>
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">
          Usuarios de Plataforma
        </h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">
          {users.length} usuario{users.length !== 1 ? 's' : ''} registrados en total.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 text-grafito-900 dark:text-white placeholder-grafito-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-grafito-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-grafito-400">
            <Users className="h-8 w-8" />
            <p className="text-sm">Sin usuarios encontrados.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5">
                <th className="px-6 py-3">Usuario</th>
                <th className="px-6 py-3">Rol Plataforma</th>
                <th className="px-6 py-3">Tenants / Rol Negocio</th>
                <th className="px-6 py-3">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {filtered.map((u) => {
                const activeRoles = (u.user_tenant_roles ?? []).filter((r) => r.is_active)
                return (
                  <tr key={u.id} className="hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0',
                          u.platform_role === 'SUPER_ADMIN' ? 'bg-brand-500' : 'bg-grafito-600',
                        )}>
                          {(u.full_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-grafito-900 dark:text-white">
                            {u.full_name ?? 'Sin nombre'}
                          </p>
                          <p className="text-xs font-mono text-grafito-400">{u.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.platform_role ? (
                        <span className={cn(
                          'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold w-fit',
                          PLATFORM_ROLE_STYLES[u.platform_role] ?? 'bg-grafito-100 text-grafito-500',
                        )}>
                          <ShieldCheck className="h-3 w-3" />
                          {u.platform_role}
                        </span>
                      ) : (
                        <span className="text-xs text-grafito-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {activeRoles.length === 0 ? (
                        <span className="text-xs text-grafito-400">Sin asignar</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {activeRoles.slice(0, 2).map((r, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                              <span className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-bold',
                                BIZ_ROLE_STYLES[r.role] ?? 'bg-grafito-100 text-grafito-500',
                              )}>
                                {r.role}
                              </span>
                              <span className="text-grafito-400 truncate max-w-[100px]">
                                {(r.tenants as any)?.name ?? '—'}
                              </span>
                            </div>
                          ))}
                          {activeRoles.length > 2 && (
                            <span className="text-[10px] text-grafito-400">+{activeRoles.length - 2} más</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-grafito-400">
                      {new Date(u.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
