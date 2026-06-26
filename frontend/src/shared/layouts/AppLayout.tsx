import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@shared/components/Sidebar'
import { TopBar } from '@shared/components/TopBar'
import { cn } from '@shared/utils/cn'
import { useTenantTheme } from '@shared/hooks/useTenantTheme'

interface AppLayoutProps {
  children?: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useTenantTheme()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-grafito-100 dark:bg-grafito-950 text-grafito-900 dark:text-white transition-colors duration-200">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      {/* ── Main area ────────────────────────────────────── */}
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64',
        )}
      >
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}