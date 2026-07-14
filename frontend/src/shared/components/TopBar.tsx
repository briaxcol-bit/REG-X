import { Bell, Search, Sun, Moon, ChevronDown, LogOut, User, Settings, ShieldCheck, AlertTriangle, PackageX, Menu } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@store/auth.store'
import { supabase } from '@lib/supabase'
import { cn } from '@shared/utils/cn'
import { useTheme } from '@shared/hooks/useTheme'
import { useInventory } from '@modules/inventory/hooks/useInventory'

// Role display config
const ROLE_DISPLAY: Record<string, { label: string; style: string }> = {
  // Platform roles
  SUPER_ADMIN:       { label: 'Super Admin',        style: 'bg-brand-500/15 text-brand-500 dark:text-brand-400 border border-brand-500/25' },
  SUPPORT:           { label: 'Soporte',             style: 'bg-blue-500/15 text-blue-500 dark:text-blue-400' },
  SALES_MANAGER:     { label: 'Gerente de Ventas',   style: 'bg-purple-500/15 text-purple-500 dark:text-purple-400' },
  // Business roles
  OWNER:             { label: 'Propietario',         style: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  ADMIN:             { label: 'Administrador',       style: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  CASHIER:           { label: 'Cajero',              style: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  WAITER:            { label: 'Mesero',              style: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  CHEF:              { label: 'Chef',                style: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  BARTENDER:         { label: 'Bartender',           style: 'bg-pink-500/15 text-pink-600 dark:text-pink-400' },
  ACCOUNTANT:        { label: 'Contador',            style: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  INVENTORY_MANAGER: { label: 'Inventario',          style: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' },
}

export function TopBar({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const { profile, tenant, branch, logout } = useAuthStore()
  const { isDark, toggle } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Vista de plataforma (/admin): el super admin gobierna tenants, no opera
  // un negocio — ahí no aplican alertas de stock ni badges de sucursal/plan.
  const isPlatformView = location.pathname.startsWith('/admin')

  // Load inventory for alerts (en /admin ni siquiera se consulta)
  const { data: inventory = [] } = useInventory(!isPlatformView)

  const alerts = isPlatformView ? [] : inventory.filter(row => {
    const p = row.products as any
    const qty = Number(row.quantity)
    const min = Number(p?.min_stock ?? 0)
    return qty === 0 || (min > 0 && qty <= min)
  })

  // ── Browser push notifications ───────────────────────────────
  const pushNotifiedRef = useRef<Set<string>>((() => {
    try {
      const stored = localStorage.getItem('regx-push-notified')
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
    } catch { return new Set<string>() }
  })())

  // Request permission once on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Fire a browser notification for each NEW alert (independent of dismissed state)
  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (alerts.length === 0) return

    alerts.forEach(row => {
      if (pushNotifiedRef.current.has(row.id)) return

      pushNotifiedRef.current.add(row.id)
      // Persist so we don't re-notify on page reload
      localStorage.setItem('regx-push-notified', JSON.stringify([...pushNotifiedRef.current]))

      const p = row.products as any
      const qty = Number(row.quantity)
      const isOut = qty === 0
      const min = Number(p?.min_stock ?? 0)

      new Notification(isOut ? '🚨 Producto agotado — REG-X' : '⚠️ Stock bajo — REG-X', {
        body: isOut
          ? `"${p?.name ?? 'Producto'}" se ha agotado en ${branch?.branchName ?? 'tu sucursal'}.`
          : `"${p?.name ?? 'Producto'}" tiene solo ${qty} ud (mínimo: ${min}) en ${branch?.branchName ?? 'tu sucursal'}.`,
        icon:   '/favicon.ico',
        tag:    row.id,
        silent: false,
      })
    })

    // Clean up: remove IDs from pushNotifiedRef that are no longer in alerts
    // so if the stock recovers and drops again, it will notify again
    const alertIds = new Set(alerts.map(r => r.id))
    pushNotifiedRef.current.forEach(id => {
      if (!alertIds.has(id)) pushNotifiedRef.current.delete(id)
    })
    localStorage.setItem('regx-push-notified', JSON.stringify([...pushNotifiedRef.current]))
  }, [alerts.map(r => r.id).join(',')])

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await supabase.auth.signOut()
    logout()
    navigate('/auth/login', { replace: true })
  }

  // Determine active role for display
  const activeRole = profile?.platformRole ?? profile?.businessRole
  const roleInfo = activeRole ? ROLE_DISPLAY[activeRole] : null

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 px-4 sm:px-6 transition-colors duration-200">

      {/* Left: hamburguesa (solo móvil) */}
      <div>
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="rounded-lg p-2 text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white transition-colors lg:hidden"
            title="Menú"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">

        {/* Branch badge (oculto en pantallas pequeñas) */}
        {!isPlatformView && branch && (
          <span className="hidden sm:inline-block rounded-md border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 px-2.5 py-1 text-xs text-grafito-600 dark:text-grafito-300">
            {branch.branchName}
          </span>
        )}

        {/* Plan badge (oculto en pantallas pequeñas) */}
        {!isPlatformView && tenant && (
          <span className={cn(
            'hidden sm:inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
            tenant.plan === 'ENTERPRISE'   && 'bg-brand-500/15 text-brand-600 dark:text-brand-400',
            tenant.plan === 'PROFESSIONAL' && 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
            tenant.plan === 'BASIC'        && 'bg-green-500/15 text-green-600 dark:text-green-400',
            tenant.plan === 'FREE'         && 'bg-grafito-200 dark:bg-grafito-700 text-grafito-500 dark:text-grafito-400',
          )}>
            {tenant.plan}
          </span>
        )}

        {/* Theme toggle */}
        <motion.button
          onClick={toggle}
          whileTap={{ scale: 0.88 }}
          className="rounded-lg p-2 text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white transition-colors"
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          <motion.div
            key={isDark ? 'sun' : 'moon'}
            initial={{ rotate: -20, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.div>
        </motion.button>

        {/* Notifications (solo en contexto de negocio) */}
        {!isPlatformView && (
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative rounded-lg p-2 text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white transition-colors"
            title="Notificaciones"
          >
            <Bell className="h-4 w-4" />
            {alerts.length > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-grafito-900" />
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotifOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 shadow-xl dark:shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-grafito-100 dark:border-white/5 shrink-0">
                    <span className="text-sm font-bold text-grafito-900 dark:text-white">Alertas de Stock</span>
                    {alerts.length > 0 && (
                      <span className="text-[10px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                        {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="overflow-y-auto">
                    {alerts.length === 0 ? (
                      <div className="p-6 text-center">
                        <Bell className="h-8 w-8 text-grafito-300 dark:text-grafito-600 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium text-grafito-900 dark:text-white">Estás al día</p>
                        <p className="text-xs text-grafito-500 mt-1">No tienes productos con bajo stock o agotados.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-grafito-100 dark:divide-white/5">
                        {alerts.map(row => {
                          const p = row.products as any
                          const qty = Number(row.quantity)
                          const min = Number(p?.min_stock ?? 0)
                          const isOut = qty === 0

                          return (
                            <div
                              key={row.id}
                              className="p-4 flex items-start gap-3 hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              onClick={() => { 
                                if (location.pathname !== '/inventory/alerts') {
                                  navigate('/inventory/alerts')
                                  setNotifOpen(false)
                                }
                              }}
                            >
                              <div className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5",
                                isOut ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              )}>
                                {isOut ? <PackageX className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-grafito-900 dark:text-white line-clamp-1">{p?.name ?? 'Producto desconocido'}</p>
                                <p className="text-xs text-grafito-500 dark:text-grafito-400 mt-0.5">
                                  {isOut 
                                    ? "Se ha agotado por completo en esta sucursal."
                                    : `Quedan ${qty} unidades (Mínimo: ${min}).`
                                  }
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  
                  {alerts.length > 0 && (
                    <div className="p-2 border-t border-grafito-100 dark:border-white/5 shrink-0 bg-grafito-50 dark:bg-grafito-900/50">
                      <button
                        onClick={() => { navigate('/inventory/alerts'); setNotifOpen(false) }}
                        className="w-full py-2 text-xs font-semibold text-brand-500 hover:text-brand-600 transition-colors"
                      >
                        Ver todas las alertas
                      </button>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
          >
            {/* Avatar */}
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
              profile?.platformRole === 'SUPER_ADMIN'
                ? 'bg-brand-500'
                : 'bg-grafito-200 dark:bg-grafito-700',
            )}>
              {profile?.platformRole === 'SUPER_ADMIN'
                ? <ShieldCheck className="h-4 w-4 text-white" />
                : <span className="text-xs font-bold text-grafito-700 dark:text-grafito-200">
                    {profile?.fullName?.[0]?.toUpperCase() ?? '?'}
                  </span>
              }
            </div>

            {/* Name + role */}
            <div className="hidden md:flex flex-col items-start">
              <span className="text-xs font-semibold text-grafito-900 dark:text-white leading-tight">
                {profile?.fullName ?? 'Usuario'}
              </span>
              {roleInfo && (
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0 rounded leading-tight mt-0.5',
                  roleInfo.style,
                )}>
                  {roleInfo.label}
                </span>
              )}
            </div>

            <ChevronDown className={cn(
              'h-3.5 w-3.5 text-grafito-400 transition-transform duration-200',
              userMenuOpen && 'rotate-180',
            )} />
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 shadow-xl dark:shadow-2xl overflow-hidden"
                >
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-grafito-100 dark:border-white/5">
                    <p className="text-sm font-semibold text-grafito-900 dark:text-white truncate">
                      {profile?.fullName ?? 'Usuario'}
                    </p>
                    {roleInfo && (
                      <span className={cn(
                        'inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1',
                        roleInfo.style,
                      )}>
                        {roleInfo.label}
                      </span>
                    )}
                    {tenant && (
                      <p className="text-[10px] text-grafito-400 mt-1 truncate">{tenant.tenantName}</p>
                    )}
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/settings') }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-grafito-700 dark:text-grafito-200 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <User className="h-4 w-4 text-grafito-400" />
                      Mi Perfil
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/settings') }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-grafito-700 dark:text-grafito-200 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Settings className="h-4 w-4 text-grafito-400" />
                      Configuracion
                    </button>
                  </div>

                  <div className="p-1.5 border-t border-grafito-100 dark:border-white/5">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar Sesion
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
