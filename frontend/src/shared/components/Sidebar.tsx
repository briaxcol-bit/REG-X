import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, Boxes,
  Users, BarChart3, Settings, ChefHat, CreditCard,
  Puzzle, ChevronLeft, ChevronRight,
  Zap, Building2, ShieldCheck, ChevronDown, AlertTriangle, DollarSign,
  UserCog, TrendingUp, Truck, Wallet, Network, Landmark, Clock, Percent, Coins,
  CalendarClock, Beer, Bike, QrCode, Split, Tag, Gift, Tags, ClipboardList, PiggyBank,
  Pill, CalendarX, Stethoscope, FileText, Wrench, Layers, Ruler, ScanBarcode,
  BookOpen, CircleDollarSign, Receipt, Banknote, Globe, Webhook,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { getMyModuleSlugs } from '@lib/db'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  permission?: string
  badge?: string | number
  group?: string
  module?: string            // si está, el ítem solo aparece si el módulo está activo en el tenant
  cashierVisible?: boolean   // true = también aparece para el rol CASHIER
  waiterVisible?: boolean    // true = también aparece para el rol WAITER (mesero)
  subItems?: { to: string; label: string; icon?: React.ElementType; permission?: string }[]
}

// Menu de negocio
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',   group: 'Principal' },
  { to: '/pos',           icon: Zap,             label: 'POS',         permission: 'sales.create', group: 'Principal', cashierVisible: true },
  { to: '/products',      icon: Package,         label: 'Productos',   permission: 'products.view', group: 'Catalogo' },
  {
    to: '/inventory',
    icon: Boxes,
    label: 'Inventario',
    permission: 'inventory.view',
    group: 'Catalogo',
    cashierVisible: true,
    subItems: [
      { to: '/inventory/alerts',    label: 'Alertas stock',         icon: AlertTriangle, permission: 'inventory.view' },
      { to: '/inventory/valuation', label: 'Valoración inventario', icon: DollarSign,    permission: 'inventory.view' },
      { to: '/inventory/movements', label: 'Movimientos',           icon: Boxes },
    ]
  },
  { to: '/customers',     icon: Users,    label: 'Clientes',    group: 'Catalogo' },
  { to: '/suppliers',     icon: Truck,    label: 'Proveedores', group: 'Catalogo', module: 'suppliers' },
  { to: '/employees',     icon: UserCog,  label: 'Empleados',   group: 'Catalogo' },
  { to: '/attendance',    icon: Clock,    label: 'Asistencia',  group: 'Catalogo', module: 'attendance' },
  { to: '/commissions',   icon: Percent,  label: 'Comisiones',  group: 'Catalogo', module: 'commissions' },
  { to: '/restaurant',    icon: ChefHat,  label: 'Restaurante', permission: 'restaurant.view', group: 'Servicio', waiterVisible: true },
  { to: '/tips',          icon: Coins,    label: 'Propinas',    group: 'Servicio', module: 'tips' },
  { to: '/reservations',  icon: CalendarClock, label: 'Reservas', group: 'Servicio', module: 'reservations' },
  { to: '/bar-tabs',      icon: Beer,     label: 'Comandas Bar', group: 'Servicio', module: 'bar_tabs' },
  { to: '/delivery',      icon: Bike,     label: 'Delivery',    group: 'Servicio', module: 'delivery' },
  { to: '/menu-qr',       icon: QrCode,   label: 'Menú QR',     group: 'Servicio', module: 'menu_digital' },
  { to: '/split-bill',    icon: Split,    label: 'Dividir Cuenta', group: 'Servicio', module: 'split_bill' },
  { to: '/promotions',    icon: Tag,      label: 'Promociones', group: 'Retail', module: 'promotions' },
  { to: '/loyalty',       icon: Gift,     label: 'Fidelización', group: 'Retail', module: 'loyalty' },
  { to: '/labels',        icon: Tags,     label: 'Etiquetas',   group: 'Retail', module: 'label_printer' },
  { to: '/expenses',      icon: Wallet,   label: 'Gastos',      group: 'Analisis', module: 'expenses' },
  { to: '/purchase-orders', icon: ClipboardList, label: 'Órdenes de Compra', group: 'Catalogo', module: 'purchase_orders' },
  { to: '/price-lists',   icon: Tags,     label: 'Listas de Precios', group: 'Catalogo', module: 'price_lists' },
  { to: '/gift-cards',    icon: Gift,     label: 'Tarjetas Regalo', group: 'Servicio', module: 'gift_cards' },
  { to: '/layaways',      icon: PiggyBank,label: 'Apartados',   group: 'Servicio', module: 'layaway' },
  { to: '/drug-catalog',  icon: Pill,     label: 'Medicamentos', group: 'Farmacia', module: 'drug_catalog' },
  { to: '/batches',       icon: Boxes,    label: 'Lotes',        group: 'Farmacia', module: 'batch_tracking' },
  { to: '/expiry-control',icon: CalendarX,label: 'Vencimientos', group: 'Farmacia', module: 'expiry_control' },
  { to: '/prescriptions', icon: Stethoscope, label: 'Recetas',   group: 'Farmacia', module: 'prescriptions' },
  { to: '/quotes',        icon: FileText,   label: 'Cotizaciones', group: 'Ferretería', module: 'quotes' },
  { to: '/work-orders',   icon: Wrench,     label: 'Órdenes Trabajo', group: 'Ferretería', module: 'work_orders' },
  { to: '/assemblies',    icon: Layers,     label: 'Ensambles',   group: 'Ferretería', module: 'assemblies' },
  { to: '/unit-conversion',icon: Ruler,     label: 'Unidades',    group: 'Ferretería', module: 'unit_conversion' },
  { to: '/serials',       icon: ScanBarcode,label: 'Seriales',    group: 'Ferretería', module: 'serial_tracking' },
  { to: '/accounting',    icon: BookOpen,   label: 'Contabilidad', group: 'Finanzas', module: 'accounting' },
  { to: '/receivables',   icon: CircleDollarSign,  label: 'Cuentas x Cobrar', group: 'Finanzas', module: 'accounts_receivable' },
  { to: '/payables',      icon: Receipt,    label: 'Cuentas x Pagar', group: 'Finanzas', module: 'accounts_payable' },
  { to: '/tax-reports',   icon: Landmark,   label: 'Tributario',  group: 'Finanzas', module: 'tax_reports' },
  { to: '/payroll',       icon: Banknote,   label: 'Nómina',      group: 'Finanzas', module: 'payroll' },
  { to: '/branches',      icon: Building2,   label: 'Sucursales',  group: 'Avanzado', module: 'multi_branch' },
  { to: '/ecommerce',     icon: Globe,       label: 'Tienda en Línea', group: 'Avanzado', module: 'ecommerce' },
  { to: '/webhooks',      icon: Webhook,     label: 'Webhooks / API', group: 'Avanzado', module: 'webhooks' },
  { to: '/audit',         icon: ShieldCheck, label: 'Auditoría',   group: 'Avanzado', module: 'audit_log' },
  {
    to: '/reports',
    icon: BarChart3,
    label: 'Reportes',
    permission: 'reports.view',
    group: 'Analisis',
    subItems: [
      { to: '/reports/sales', label: 'Ventas', icon: TrendingUp },
    ]
  },
  { to: '/subscriptions', icon: CreditCard, label: 'Suscripcion', group: 'Sistema' },
  { to: '/settings',      icon: Settings,   label: 'Ajustes',     group: 'Sistema' },
]

// Menu de plataforma - solo SUPER_ADMIN
const PLATFORM_NAV_ITEMS: NavItem[] = [
  { to: '/admin',         icon: LayoutDashboard, label: 'Panel General', group: 'Plataforma' },
  { to: '/admin/tenants', icon: Building2,       label: 'Tenants',       group: 'Plataforma' },
  { to: '/admin/users',   icon: Users,           label: 'Usuarios',      group: 'Plataforma' },
  { to: '/admin/plans',   icon: CreditCard,      label: 'Suscripciones', group: 'Plataforma' },
  { to: '/admin/payments', icon: Landmark,       label: 'Pasarela',      group: 'Plataforma' },
  { to: '/admin/modules', icon: Puzzle,          label: 'Módulos',       group: 'Plataforma' },
  { to: '/admin/module-map', icon: Network,      label: 'Explorador',    group: 'Plataforma' },
  { to: '/settings',      icon: Settings,        label: 'Ajustes',       group: 'Sistema' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { hasPermission, hasRole, tenant, profile } = useAuthStore()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  const isSuperAdmin = profile?.platformRole === 'SUPER_ADMIN'
  const isCashier    = hasRole('CASHIER')
  const isWaiter     = hasRole('WAITER')

  // Módulos activos del tenant, para gatear ítems que dependen de un módulo.
  const { data: moduleSlugs } = useQuery({
    queryKey: ['my-module-slugs', tenant?.tenantId],
    queryFn: () => getMyModuleSlugs(tenant!.tenantId),
    enabled: !!tenant?.tenantId && !isSuperAdmin,
  })
  // Fallback seguro: sin datos (cargando) o lista vacía => no ocultar.
  const moduleOk = (mod?: string) => {
    if (!mod) return true
    if (!moduleSlugs || moduleSlugs.length === 0) return true
    return moduleSlugs.includes(mod)
  }

  const baseItems = isSuperAdmin
    ? PLATFORM_NAV_ITEMS
    : isWaiter
      ? NAV_ITEMS.filter(i => i.waiterVisible)
      : isCashier
        ? NAV_ITEMS.filter(i => i.cashierVisible)
        : NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission))

  const visibleItems = baseItems.filter((item) => moduleOk(item.module))

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
          /* Colapsado: ícono R clickeable para expandir */
          <button
            onClick={onToggle}
            className="mx-auto flex h-9 w-9 items-center justify-center hover:opacity-80 transition-opacity"
            title="Expandir sidebar"
          >
            <img src="/logo-icon.png" alt="RegX" className="h-9 w-9 object-contain" />
          </button>
        ) : (
          /* Expandido: R + nombre */
          <>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <img src="/logo-icon.png" alt="RegX" className="h-8 w-8 object-contain shrink-0" />
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col min-w-0"
              >
                <span className="text-sm font-bold text-grafito-900 dark:text-white leading-tight">RegX</span>
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
                // '/admin' es la ruta índice de plataforma: solo activa con match
                // exacto (si no, "Panel General" queda encendido también en
                // /admin/tenants, /admin/users, etc. junto al ítem real).
                const isActive = item.to === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname === item.to || location.pathname.startsWith(item.to + '/')
                const hasSubItems = item.subItems && item.subItems.length > 0
                const isExpanded = expandedMenus[item.to] !== undefined ? expandedMenus[item.to] : isActive

                return (
                  <div key={item.to} className="flex flex-col">
                    <NavLink
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg mx-2 px-3 py-2 text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-primary/10 dark:bg-primary/15 text-primary'
                          : 'text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:hover:text-white',
                      )}
                    >
                      {isActive && !hasSubItems && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute left-0 h-full w-0.5 rounded-full bg-primary"
                        />
                      )}
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : '')} />
                      <span
                        style={{ opacity: collapsed ? 0 : 1, transition: 'opacity 0.2s', width: collapsed ? 0 : undefined, overflow: 'hidden', whiteSpace: 'nowrap' }}
                        className="flex-1"
                      >
                        {item.label}
                      </span>
                      
                      {!collapsed && hasSubItems && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedMenus(prev => ({ ...prev, [item.to]: !isExpanded }));
                          }}
                          className="p-1 -mr-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        >
                          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
                        </button>
                      )}

                      {item.badge && !collapsed && (
                        <span
                          className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white"
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>

                    {/* Subitems */}
                    {!collapsed && hasSubItems && (
                      <motion.div
                        initial={false}
                        animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 py-1 pl-10 pr-2">
                          {item.subItems!.filter(sub => isCashier ? !sub.permission : (!sub.permission || hasPermission(sub.permission))).map(sub => {
                            const isSubActive = location.pathname === sub.to
                            const SubIcon = sub.icon
                            return (
                              <NavLink
                                key={sub.to}
                                to={sub.to}
                                className={cn(
                                  'flex items-center gap-2 text-sm px-3 py-1.5 rounded-md transition-colors',
                                  isSubActive
                                    ? 'text-primary font-semibold bg-primary/5'
                                    : 'text-grafito-500 hover:text-grafito-900 dark:text-grafito-400 dark:hover:text-white hover:bg-grafito-50 dark:hover:bg-white/5'
                                )}
                              >
                                {SubIcon && <SubIcon className="h-3.5 w-3.5" />}
                                {sub.label}
                              </NavLink>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )
              })}
          </div>
        ))}
      </nav>


    </motion.aside>
  )
}
