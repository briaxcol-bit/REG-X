import { Bell, Search, Sun, Moon, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@store/auth.store'
import { supabase } from '@lib/supabase'
import { cn } from '@shared/utils/cn'
import { useTheme } from '@shared/hooks/useTheme'

export function TopBar() {
  const { profile, tenant, branch, logout } = useAuthStore()
  const { isDark, toggle } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 px-6 transition-colors duration-200">

      {/* ── Search ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-lg bg-grafito-100 dark:bg-grafito-800 px-3 py-2 w-72 border border-grafito-200 dark:border-transparent">
        <Search className="h-4 w-4 text-grafito-400" />
        <input
          placeholder="Buscar productos, clientes…"
          className="flex-1 text-sm text-grafito-700 dark:text-grafito-200 placeholder:text-grafito-400 dark:placeholder:text-grafito-500 outline-none"
          style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
        />
        <kbd className="rounded border border-grafito-300 dark:border-white/10 px-1.5 py-0.5 text-[10px] text-grafito-400 dark:text-grafito-500">
          Ctrl K
        </kbd>
      </div>

      {/* ── Right actions ──────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Branch badge */}
        {branch && (
          <span className="rounded-md border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 px-2.5 py-1 text-xs text-grafito-600 dark:text-grafito-300">
            📍 {branch.branchName}
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
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-brand-500/20 flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {profile?.fullName?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="hidden md:flex flex-col items-start">
              <span className="text-xs font-medium text-grafito-900 dark:text-white">{profile?.fullName ?? 'Usuario'}</span>
              <span className="text-[10px] text-grafito-500 dark:text-grafito-400">{profile?.businessRole ?? ''}</span>
            </div>
            <ChevronDown className="h-3 w-3 text-grafito-400" />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-lg shadow-black/10 dark:shadow-black/40 py-1 z-50"
              onMouseLeave={() => setUserMenuOpen(false)}
            >
              <div className="px-3 py-2 border-b border-grafito-100 dark:border-white/5">
                <p className="text-xs font-semibold text-grafito-900 dark:text-white truncate">
                  {profile?.fullName ?? 'Usuario'}
                </p>
                <p className="text-[10px] text-grafito-500 dark:text-grafito-400 truncate">
                  {profile?.email ?? ''}
                </p>
              </div>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white transition-colors">
                <User className="h-3.5 w-3.5" />
                Mi perfil
              </button>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white transition-colors">
                <Settings className="h-3.5 w-3.5" />
                Ajustes
              </button>
              <div className="border-t border-grafito-100 dark:border-white/5 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
