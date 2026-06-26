import { Bell, Search, Sun, Moon, ChevronDown, LogOut, User, Settings, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/auth.store'
import { supabase } from '@lib/supabase'
import { cn } from '@shared/utils/cn'
import { useTheme } from '@shared/hooks/useTheme'

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

export function TopBar() {
  const { profile, tenant, branch, logout } = useAuthStore()
  const { isDark, toggle } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()

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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 px-6 transition-colors duration-200">

      {/* Left section (empty for now, could put breadcrumbs or title here) */}
      <div></div>

      {/* Right actions */}
      <div className="flex items-center gap-2">

        {/* Branch badge */}
        {branch && (
          <span className="rounded-md border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 px-2.5 py-1 text-xs text-grafito-600 dark:text-grafito-300">
            {branch.branchName}
          </span>
        )}

        {/* Plan badge */}
        {tenant && (
          <span className={cn(
            'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
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

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
        </button>

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
