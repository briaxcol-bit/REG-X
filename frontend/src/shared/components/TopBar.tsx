import { Bell, Search, Sun, Moon, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@store/auth.store'
import { supabase } from '@lib/supabase'
import { cn } from '@shared/utils/cn'

export function TopBar() {
  const { profile, tenant, branch, logout } = useAuthStore()
  const [darkMode, setDarkMode] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-grafito-900 px-6">
      {/* ── Search ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-lg bg-grafito-800 px-3 py-2 w-72">
        <Search className="h-4 w-4 text-grafito-400" />
        <input
          placeholder="Buscar productos, clientes…"
          className="flex-1 bg-transparent text-sm text-grafito-200 placeholder:text-grafito-500 outline-none"
        />
        <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-grafito-500">
          Ctrl K
        </kbd>
      </div>

      {/* ── Right actions ──────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Branch badge */}
        {branch && (
          <span className="rounded-md border border-white/10 bg-grafito-800 px-2.5 py-1 text-xs text-grafito-300">
            📍 {branch.branchName}
          </span>
        )}

        {/* Plan badge */}
        {tenant && (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
              tenant.plan === 'ENTERPRISE' && 'bg-brand-500/20 text-brand-400',
              tenant.plan === 'PROFESSIONAL' && 'bg-blue-500/20 text-blue-400',
              tenant.plan === 'BASIC' && 'bg-green-500/20 text-green-400',
              tenant.plan === 'FREE' && 'bg-grafito-700 text-grafito-400',
            )}
          >
            {tenant.plan}
          </span>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode((v) => !v)}
          className="rounded-lg p-2 text-grafito-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-grafito-400 hover:bg-white/5 hover:text-white transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-brand-500/20 flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-400">
                {profile?.fullName?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="hidden md:flex flex-col items-start">
              <span className="text-xs font-medium text-white">{profile?.fullName ?? 'Usuario'}</span>
              <span className="text-[10px] text-grafito-400">{profile?.businessRole ?? ''}</span>
            </div>
            <ChevronDown className="h-3 w-3 text-grafito-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-grafito-800 shadow-xl py-1 z-50">
              <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-grafito-200 hover:bg-white/5">
                <User className="h-4 w-4" /> Perfil
              </button>
              <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-grafito-200 hover:bg-white/5">
                <Settings className="h-4 w-4" /> Configuración
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
