import { Link } from 'react-router-dom'
import { LayoutDashboard, Wifi, WifiOff } from 'lucide-react'
import { usePOSStore } from '@store/pos.store'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'

interface POSLayoutProps {
  children: React.ReactNode
}

export function POSLayout({ children }: POSLayoutProps) {
  const isOffline = usePOSStore((s) => s.isOffline)
  const { branch, tenant } = useAuthStore()

  return (
    <div className="flex h-screen w-screen flex-col bg-grafito-950 text-white overflow-hidden">
      {/* ── POS Top Bar ────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-grafito-900 px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-lg p-2 text-grafito-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-sm font-semibold text-white">POS</span>
          {branch && (
            <span className="text-xs text-grafito-400">— {branch.branchName}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Offline indicator */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              isOffline
                ? 'bg-yellow-500/15 text-yellow-400'
                : 'bg-green-500/15 text-green-400',
            )}
          >
            {isOffline ? (
              <><WifiOff className="h-3 w-3" /> Sin conexión</>
            ) : (
              <><Wifi className="h-3 w-3" /> En línea</>
            )}
          </div>

          {/* Time */}
          <ClockDisplay />

          {/* Tenant */}
          {tenant && (
            <span className="text-xs text-grafito-400">{tenant.tenantName}</span>
          )}
        </div>
      </header>

      {/* ── POS Content ────────────────────────────────── */}
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
    <span className="text-sm font-mono text-grafito-300">
      {time.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

// Fix missing imports
import { useState, useEffect } from 'react'
