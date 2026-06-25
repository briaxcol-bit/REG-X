import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Wifi, WifiOff, Sun, Moon } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePOSStore } from '@store/pos.store'
import { useAuthStore } from '@store/auth.store'
import { useTheme } from '@shared/hooks/useTheme'
import { cn } from '@shared/utils/cn'

interface POSLayoutProps {
  children: React.ReactNode
}

export function POSLayout({ children }: POSLayoutProps) {
  const isOffline = usePOSStore((s) => s.isOffline)
  const { branch, tenant } = useAuthStore()
  const { isDark, toggle } = useTheme()

  return (
    <div className="flex h-screen w-screen flex-col bg-grafito-50 dark:bg-grafito-950 text-grafito-900 dark:text-white overflow-hidden transition-colors duration-200">

      {/* ── POS Top Bar ─────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 px-4 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-lg p-2 text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
          </Link>
          <div className="h-4 w-px bg-grafito-200 dark:bg-white/10" />
          <span className="text-sm font-semibold text-grafito-900 dark:text-white">POS</span>
          {branch && (
            <span className="text-xs text-grafito-500 dark:text-grafito-400">
              — {branch.branchName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
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

          {/* Clock */}
          <ClockDisplay />

          {/* Tenant */}
          {tenant && (
            <span className="text-xs text-grafito-500 dark:text-grafito-400">
              {tenant.tenantName}
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
