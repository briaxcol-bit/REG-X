import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, Boxes,
  Users, BarChart3, Settings, ChefHat, CreditCard,
  Store, Puzzle, ChevronLeft, ChevronRight,
  Zap, Building2, ShieldCheck,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  permission?: string
  badge?: string | number
  group?: string
}

// Menu de negocio - admins, cajeros, etc.
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',   group: 'Principal' },
  { to: '/pos',           icon: Zap,             label: 'POS',         permission: 'sales.create', group: 'Principal' },
  { to: '/products',      icon: Package,         label: 'Productos',   permission: 'products.view', group: 'Catalogo' },
  { to: '/inventory',     icon: Boxes,           label: 'Inventario',  permission: 'inventory.view', group: 'Catalogo' },
  { to: '/customers',     icon: Users,           label: 'Clientes',    group: 'Catalogo' },
  { to: '/restaurant',    icon: ChefHat,         label: 'Restaurante', group: 'Servicio' },
  { to: '/reports',       icon: BarChart3,       label: 'Reportes',    permission: 'reports.view', group: 'Analisis' },
  { to: '/subscriptions', icon: CreditCard,      label: 'Suscripcion', group: 'Sistema' },
  { to: '/marketplace',   icon: Puzzle,          label: 'Marketplace', group: 'Sistema' },
  { to: '/settings',      icon: Settings,        label: 'Ajustes',     group: 'Sistema' },
]

// Menu de plataforma - solo SUPER_ADMIN
const PLATFORM_NAV_ITEMS: NavItem[] = [
  { to: '/admin',         icon: LayoutDashboard, label: 'Panel General', group: 'Plataforma' },
  { to: '/admin/tenants', icon: Building2,       label: 'Tenants',       group: 'Plataforma' },
  { to: '/admin/users',   icon: Users,           label: 'Usuarios',      group: 'Plataforma' },
  { to: '/admin/plans',   icon: CreditCard,      label: 'Suscripciones', group: 'Plataforma' },
  { to: '/settings',      icon: Settings,        label: 'Ajustes',       group: 'Sistema' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { hasPermission, tenant, profile } = useAuthStore()

  const isSuperAdmin = profile?.platformRole === 'SUPER_ADMIN'

  const visibleItems = isSuperAdmin
    ? PLATFORM_NAV_ITEMS
    : NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission))

  const groups = [...new Set(visibleItems.map((i) => i.group))]

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 shadow-sm dark:shadow-2xl transition-colors duration-200"
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="flex h-16 items-center border-b border-grafito-200 dark:border-white/5 px-3">
        {collapsed ? (
          /* Colapsado: logo centrado clickeable para expandir */
          <button
            onClick={onToggle}
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 hover:bg-brand-600 transition-colors"
            title="Expandir sidebar"
          >
            {isSuperAdmin ? (
              <ShieldCheck className="h-4 w-4 text-white" />
            ) : (
              <Store className="h-4 w-4 text-white" />
            )}
          </button>
        ) : (
          /* Expandido: logo + nombre + flecha */
          <>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500">
                {isSuperAdmin ? (
                  <ShieldCheck className="h-4 w-4 text-white" />
                ) : (
                  <Store className="h-4 w-4 text-white" />
                )}
              </div>
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col min-w-0"
              >
                <span className="text-sm font-bold text-grafito-900 dark:text-white">REG-X</span>
                <span className="text-[10px] text-grafito-500 dark:text-grafito-400 truncate max-w-[140px]">
                  {isSuperAdmin ? 'Super Admin' : (tenant?.tenantName ?? 'ERP/POS')}
                </span>
              </motion.div>
            </div>
            <button
              onClick={onToggle}
              className="shrink-0 rounded-md p-1 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-700 dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-grafito-200 dark:scrollbar-thumb-white/10">
        {groups.map((group) => (
          <div key={group} className="mb-1">
            <p
              style={{ opacity: collapsed ? 0 : 1, transition: 'opacity 0.2s' }}
              className="mb-0.5 h-4 px-4 text-[10px] font-semibold uppercase tracking-widest text-grafito-400 dark:text-grafito-500"
            >
              {group}
            </p>
            {visibleItems
              .filter((i) => i.group === group)
              .map((item) => {
                const Icon = item.icon
                const isActive = location.pathname.startsWith(item.to)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg mx-2 px-3 py-2 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-brand-500/10 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400'
                        : 'text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute left-0 h-full w-0.5 rounded-full bg-brand-500"
                      />
                    )}
                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-500 dark:text-brand-400' : '')} />
                    <span
                      style={{ opacity: collapsed ? 0 : 1, transition: 'opacity 0.2s', width: collapsed ? 0 : undefined, overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        style={{ opacity: collapsed ? 0 : 1, transition: 'opacity 0.2s' }}
                        className="ml-auto rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                )
              })}
          </div>
        ))}
      </nav>


    </motion.aside>
  )
}
