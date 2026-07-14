import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Wifi, WifiOff, Sun, Moon, Boxes, LogOut, User, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePOSStore } from '@store/pos.store'
import { useAuthStore } from '@store/auth.store'
import { supabase } from '@lib/supabase'
import { useTheme } from '@shared/hooks/useTheme'
import { cn } from '@shared/utils/cn'

interface POSLayoutProps {
  children: React.ReactNode
}

export function POSLayout({ children }: POSLayoutProps) {
  const isOffline = usePOSStore((s) => s.isOffline)
  const pendingCount = usePOSStore((s) => s.pendingSync.filter(p => p.status === 'PENDING').length)
  const reviewCount  = usePOSStore((s) => s.pendingSync.filter(p => p.status === 'REVIEW').length)
  const { branch, tenant, profile, hasRole, logout } = useAuthStore()
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const isCashier = hasRole('CASHIER')

  const handleLogout = async () => {
    setMenuOpen(false)
    await supabase.auth.signOut()
    logout()
    navigate('/auth/login', { replace: true })
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-grafito-50 dark:bg-grafito-950 text-grafito-900 dark:text-white overflow-hidden transition-colors duration-200">

      {/* ── POS Top Bar ─────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 px-4 transition-colors duration-200">
        <div className="flex items-center gap-3">
          {/* Ir a dashboard — solo para no cajeros */}
          {!isCashier && (
            <>
              <Link
                to="/dashboard"
                className="rounded-lg p-2 text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white transition-colors"
                title="Ir al dashboard"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Link>
              <div className="h-4 w-px bg-grafito-200 dark:bg-white/10" />
            </>
          )}

          <span className="text-sm font-semibold text-grafito-900 dark:text-white">POS</span>
          {branch && (
            <span className="text-xs text-grafito-500 dark:text-grafito-400">
              — {branch.branchName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Offline indicator */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              isOffline
                ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                : 'bg-green-500/15 text-green-600 dark:text-green-400',
            )}
          >
            {isOffline ? (
              <><WifiOff className="h-3 w-3" /> Sin conexión</>
            ) : (
              <><Wifi className="h-3 w-3" /> En línea</>
            )}
          </div>

          {/* Ventas offline pendientes de sincronizar */}
          {pendingCount > 0 && (
            <span className="rounded-full bg-yellow-500/15 px-2.5 py-1 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
              {pendingCount} venta{pendingCount !== 1 ? 's' : ''} por sincronizar
            </span>
          )}
          {reviewCount > 0 && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-500" title="Ventas offline rechazadas por el servidor (p.ej. stock insuficiente)">
              {reviewCount} requiere{reviewCount !== 1 ? 'n' : ''} revisión
            </span>
          )}

          {/* Clock (oculto en pantallas pequeñas) */}
          <div className="hidden sm:block"><ClockDisplay /></div>

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

          {/* Menú de usuario: inventario + logout */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:block max-w-[100px] truncate">
                {profile?.full_name ?? tenant?.tenantName ?? 'Usuario'}
              </span>
              <ChevronDown className={cn('h-3 w-3 transition-transform', menuOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-xl z-50 overflow-hidden"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  {/* Nombre */}
                  <div className="px-3 py-2.5 border-b border-grafito-100 dark:border-white/5">
                    <p className="text-xs font-bold text-grafito-900 dark:text-white truncate">
                      {profile?.full_name ?? 'Usuario'}
                    </p>
                    <p className="text-[10px] text-grafito-400 truncate">
                      {isCashier ? 'Cajero' : (profile?.businessRole ?? '')}
                    </p>
                  </div>

                  {/* Cerrar sesión */}
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ── POS Content ─────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}

function ClockDisplay() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="text-sm font-mono text-grafito-600 dark:text-grafito-300">
      {time.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}
