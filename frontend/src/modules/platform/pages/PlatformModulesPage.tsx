import { useState } from 'react'
import { CheckCircle, Clock, Lock, Puzzle } from 'lucide-react'
import { cn } from '@shared/utils/cn'

// ─── Roadmap interno de módulos (solo SUPER_ADMIN) ────────────────────────────
// Este es TU tablero de construcción: refleja qué módulos están realmente
// terminados, en desarrollo o pendientes. No lo ve el dueño del negocio.
// Al terminar un módulo, cámbiale el status a 'ready'.

type ModuleStatus = 'ready' | 'in_progress' | 'soon'

interface ModuleDef {
  slug: string
  name: string
  description: string
  status: ModuleStatus
}

const MODULES: { category: string; items: ModuleDef[] }[] = [
  {
    category: 'Core',
    items: [
      { slug: 'pos',          name: 'Punto de Venta',    description: 'Ventas, cobros, recibos, arqueo y cierre de caja', status: 'ready' },
      { slug: 'products',     name: 'Productos',         description: 'Catálogo, categorías, precios e imágenes',        status: 'ready' },
      { slug: 'inventory',    name: 'Inventario',        description: 'Stock, alertas, movimientos y valoración',        status: 'ready' },
      { slug: 'customers',    name: 'Clientes',          description: 'CRM básico e historial de compras',               status: 'ready' },
      { slug: 'reports',      name: 'Reportes',          description: 'Ventas, caja e inventario',                       status: 'ready' },
      { slug: 'cash_register',name: 'Caja y Arqueo',     description: 'Apertura, cierre y cuadre de caja por turno',     status: 'ready' },
      { slug: 'expenses',     name: 'Gastos Operativos', description: 'Registro y categorización de gastos',             status: 'soon' },
      { slug: 'suppliers',    name: 'Proveedores',       description: 'Gestión de proveedores y contactos',              status: 'soon' },
    ],
  },
  {
    category: 'Recursos Humanos',
    items: [
      { slug: 'employees',   name: 'Empleados',           description: 'Roles, permisos y datos laborales',        status: 'ready' },
      { slug: 'attendance',  name: 'Asistencia y Turnos', description: 'Control de entrada/salida y programación',  status: 'soon' },
      { slug: 'commissions', name: 'Comisiones',          description: 'Cálculo de comisiones por venta',           status: 'soon' },
    ],
  },
  {
    category: 'Restaurante / F&B',
    items: [
      { slug: 'kitchen_display', name: 'Pantalla de Cocina (KDS)', description: 'Órdenes en tiempo real para cocina',      status: 'ready' },
      { slug: 'tables',          name: 'Gestión de Mesas',         description: 'Mapa de mesas y estado de ocupación',     status: 'ready' },
      { slug: 'reservations',    name: 'Reservas',                 description: 'Agenda con confirmación y recordatorios', status: 'soon' },
      { slug: 'bar_tabs',        name: 'Comandas de Bar',          description: 'Tabs por mesa o cliente',                 status: 'soon' },
      { slug: 'delivery',        name: 'Delivery',                 description: 'Pedidos a domicilio y repartidores',      status: 'soon' },
      { slug: 'menu_digital',    name: 'Menú Digital QR',          description: 'Menú interactivo vía código QR',          status: 'soon' },
      { slug: 'tips',            name: 'Propinas',                 description: 'Gestión y distribución de propinas',      status: 'soon' },
      { slug: 'split_bill',      name: 'División de Cuenta',       description: 'Divide la cuenta entre comensales',       status: 'soon' },
    ],
  },
  {
    category: 'Retail',
    items: [
      { slug: 'promotions',     name: 'Promociones y Descuentos', description: 'Combos, 2x1 y descuentos automáticos',   status: 'soon' },
      { slug: 'loyalty',        name: 'Fidelización',             description: 'Puntos y recompensas por compra',        status: 'soon' },
      { slug: 'label_printer',  name: 'Impresora de Etiquetas',   description: 'Etiquetas de precio y código de barras', status: 'soon' },
      { slug: 'purchase_orders',name: 'Órdenes de Compra',        description: 'Pedidos a proveedores con seguimiento',  status: 'soon' },
      { slug: 'price_lists',    name: 'Listas de Precios',        description: 'Precios por cliente, canal o volumen',   status: 'soon' },
      { slug: 'gift_cards',     name: 'Tarjetas de Regalo',       description: 'Emisión y redención de gift cards',      status: 'soon' },
      { slug: 'layaway',        name: 'Apartados',                description: 'Ventas con abonos parciales',            status: 'soon' },
    ],
  },
  {
    category: 'Farmacia',
    items: [
      { slug: 'prescriptions',  name: 'Recetas Médicas',          description: 'Registro y validación de recetas',       status: 'soon' },
      { slug: 'expiry_control', name: 'Control de Vencimientos',  description: 'Alertas de productos próximos a vencer',  status: 'in_progress' },
      { slug: 'batch_tracking', name: 'Trazabilidad por Lotes',   description: 'Seguimiento de lotes proveedor → venta', status: 'soon' },
      { slug: 'drug_catalog',   name: 'Catálogo de Medicamentos', description: 'Principios activos y registros INVIMA',   status: 'soon' },
    ],
  },
  {
    category: 'Ferretería / Industrial',
    items: [
      { slug: 'quotes',          name: 'Cotizaciones',           description: 'Genera cotizaciones que se convierten en ventas', status: 'soon' },
      { slug: 'work_orders',     name: 'Órdenes de Trabajo',     description: 'Trabajos, servicios técnicos y reparaciones',     status: 'soon' },
      { slug: 'assemblies',      name: 'Ensambles y Kits',       description: 'Arma productos desde componentes',                status: 'soon' },
      { slug: 'unit_conversion', name: 'Conversión de Unidades', description: 'Vende por metro, vara, bulto o fracción',         status: 'soon' },
      { slug: 'serial_tracking', name: 'Seguimiento por Serial', description: 'Rastrea productos por número de serie',           status: 'soon' },
    ],
  },
  {
    category: 'Finanzas',
    items: [
      { slug: 'accounting',          name: 'Contabilidad',         description: 'Libro diario, plan de cuentas y balances', status: 'soon' },
      { slug: 'accounts_receivable', name: 'Cuentas por Cobrar',   description: 'Cartera de clientes y cobros',             status: 'soon' },
      { slug: 'accounts_payable',    name: 'Cuentas por Pagar',    description: 'Deudas a proveedores y pagos',             status: 'soon' },
      { slug: 'tax_reports',         name: 'Informes Tributarios', description: 'Reportes DIAN, IVA y factura electrónica', status: 'soon' },
      { slug: 'payroll',             name: 'Nómina',               description: 'Salarios, prestaciones y pagos',           status: 'soon' },
    ],
  },
  {
    category: 'Avanzado',
    items: [
      { slug: 'multi_branch',       name: 'Multi-Sucursal',           description: 'Gestión centralizada de sucursales',     status: 'in_progress' },
      { slug: 'warehouse_transfer', name: 'Transferencia de Bodegas', description: 'Movimientos entre sucursales y bodegas', status: 'ready' },
      { slug: 'ecommerce',          name: 'Tienda en Línea',          description: 'Catálogo web conectado al inventario',   status: 'soon' },
      { slug: 'webhooks',           name: 'Webhooks / API',           description: 'Integración con sistemas externos',      status: 'soon' },
      { slug: 'audit_log',          name: 'Auditoría',                description: 'Log de acciones críticas por usuario',   status: 'soon' },
    ],
  },
]

const STATUS_CFG = {
  ready:       { label: 'Disponible',    Icon: CheckCircle, cls: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  in_progress: { label: 'En desarrollo', Icon: Clock,       cls: 'text-amber-400',   bg: 'bg-amber-400/10'   },
  soon:        { label: 'Próximamente',  Icon: Lock,        cls: 'text-grafito-400 dark:text-grafito-500', bg: 'bg-grafito-100 dark:bg-white/5' },
}

export default function PlatformModulesPage() {
  const [filter, setFilter] = useState<ModuleStatus | 'all'>('all')

  const allItems      = MODULES.flatMap(g => g.items)
  const countReady    = allItems.filter(m => m.status === 'ready').length
  const countProgress = allItems.filter(m => m.status === 'in_progress').length
  const countSoon     = allItems.filter(m => m.status === 'soon').length

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5">
          <Puzzle className="h-5 w-5 text-brand-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Roadmap de Módulos</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">
            Estado real de construcción de la plataforma. Solo tú (super admin) ves esto.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Disponibles',   count: countReady,    ...STATUS_CFG.ready       },
          { label: 'En desarrollo', count: countProgress, ...STATUS_CFG.in_progress },
          { label: 'Próximamente',  count: countSoon,     ...STATUS_CFG.soon        },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-4 text-center', s.bg)}>
            <p className={cn('text-3xl font-black', s.cls)}>{s.count}</p>
            <p className="text-xs text-grafito-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'ready', 'in_progress', 'soon'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
              filter === f
                ? 'bg-brand-500 text-white border-brand-500'
                : 'border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5',
            )}
          >
            {f === 'all' ? 'Todos' : STATUS_CFG[f].label}
          </button>
        ))}
      </div>

      {/* Lista por categoría */}
      <div className="space-y-4">
        {MODULES.map(group => {
          const items = filter === 'all' ? group.items : group.items.filter(m => m.status === filter)
          if (!items.length) return null
          return (
            <div
              key={group.category}
              className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-grafito-100 dark:border-white/5 bg-grafito-50 dark:bg-white/[0.02]">
                <p className="text-xs font-bold uppercase tracking-wider text-grafito-500">{group.category}</p>
              </div>
              <div className="divide-y divide-grafito-100 dark:divide-white/5">
                {items.map(mod => {
                  const sc = STATUS_CFG[mod.status]
                  return (
                    <div key={mod.slug} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-grafito-900 dark:text-white">{mod.name}</p>
                        <p className="text-xs text-grafito-500 mt-0.5">{mod.description}</p>
                      </div>
                      <span className={cn(
                        'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap',
                        sc.bg, sc.cls,
                      )}>
                        <sc.Icon className="h-3 w-3" />
                        {sc.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
