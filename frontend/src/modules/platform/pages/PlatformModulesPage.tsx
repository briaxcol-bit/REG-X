import { useState } from 'react'
import { CheckCircle, Clock, Lock, Puzzle, X, Link2, AlertTriangle, ArrowRight, PlugZap } from 'lucide-react'
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
      { slug: 'expenses',     name: 'Gastos Operativos', description: 'Registro y categorización de gastos',             status: 'ready' },
      { slug: 'suppliers',    name: 'Proveedores',       description: 'Gestión de proveedores y contactos',              status: 'ready' },
    ],
  },
  {
    category: 'Recursos Humanos',
    items: [
      { slug: 'employees',   name: 'Empleados',           description: 'Roles, permisos y datos laborales',        status: 'ready' },
      { slug: 'attendance',  name: 'Asistencia y Turnos', description: 'Control de entrada/salida y programación',  status: 'ready' },
      { slug: 'commissions', name: 'Comisiones',          description: 'Cálculo de comisiones por venta',           status: 'ready' },
    ],
  },
  {
    category: 'Restaurante / F&B',
    items: [
      { slug: 'kitchen_display', name: 'Pantalla de Cocina (KDS)', description: 'Órdenes en tiempo real para cocina',      status: 'ready' },
      { slug: 'tables',          name: 'Gestión de Mesas',         description: 'Mapa de mesas y estado de ocupación',     status: 'ready' },
      { slug: 'reservations',    name: 'Reservas',                 description: 'Agenda con confirmación y recordatorios', status: 'ready' },
      { slug: 'bar_tabs',        name: 'Comandas de Bar',          description: 'Tabs por mesa o cliente',                 status: 'ready' },
      { slug: 'delivery',        name: 'Delivery',                 description: 'Pedidos a domicilio y repartidores',      status: 'ready' },
      { slug: 'menu_digital',    name: 'Menú Digital QR',          description: 'Menú interactivo vía código QR',          status: 'ready' },
      { slug: 'tips',            name: 'Propinas',                 description: 'Gestión y distribución de propinas',      status: 'ready' },
      { slug: 'split_bill',      name: 'División de Cuenta',       description: 'Divide la cuenta entre comensales',       status: 'ready' },
    ],
  },
  {
    category: 'Retail',
    items: [
      { slug: 'promotions',     name: 'Promociones y Descuentos', description: 'Combos, 2x1 y descuentos automáticos',   status: 'ready' },
      { slug: 'loyalty',        name: 'Fidelización',             description: 'Puntos y recompensas por compra',        status: 'ready' },
      { slug: 'label_printer',  name: 'Impresora de Etiquetas',   description: 'Etiquetas de precio y código de barras', status: 'ready' },
      { slug: 'purchase_orders',name: 'Órdenes de Compra',        description: 'Pedidos a proveedores con seguimiento',  status: 'ready' },
      { slug: 'price_lists',    name: 'Listas de Precios',        description: 'Precios por cliente, canal o volumen',   status: 'ready' },
      { slug: 'gift_cards',     name: 'Tarjetas de Regalo',       description: 'Emisión y redención de gift cards',      status: 'ready' },
      { slug: 'layaway',        name: 'Apartados',                description: 'Ventas con abonos parciales',            status: 'ready' },
    ],
  },
  {
    category: 'Farmacia',
    items: [
      { slug: 'prescriptions',  name: 'Recetas Médicas',          description: 'Registro y validación de recetas',       status: 'ready' },
      { slug: 'expiry_control', name: 'Control de Vencimientos',  description: 'Alertas de productos próximos a vencer',  status: 'ready' },
      { slug: 'batch_tracking', name: 'Trazabilidad por Lotes',   description: 'Seguimiento de lotes proveedor → venta', status: 'ready' },
      { slug: 'drug_catalog',   name: 'Catálogo de Medicamentos', description: 'Principios activos y registros INVIMA',   status: 'ready' },
    ],
  },
  {
    category: 'Ferretería / Industrial',
    items: [
      { slug: 'quotes',          name: 'Cotizaciones',           description: 'Genera cotizaciones que se convierten en ventas', status: 'ready' },
      { slug: 'work_orders',     name: 'Órdenes de Trabajo',     description: 'Trabajos, servicios técnicos y reparaciones',     status: 'ready' },
      { slug: 'assemblies',      name: 'Ensambles y Kits',       description: 'Arma productos desde componentes',                status: 'ready' },
      { slug: 'unit_conversion', name: 'Conversión de Unidades', description: 'Vende por metro, vara, bulto o fracción',         status: 'ready' },
      { slug: 'serial_tracking', name: 'Seguimiento por Serial', description: 'Rastrea productos por número de serie',           status: 'ready' },
    ],
  },
  {
    category: 'Finanzas',
    items: [
      { slug: 'accounting',          name: 'Contabilidad',         description: 'Libro diario, plan de cuentas y balances', status: 'ready' },
      { slug: 'accounts_receivable', name: 'Cuentas por Cobrar',   description: 'Cartera de clientes y cobros',             status: 'ready' },
      { slug: 'accounts_payable',    name: 'Cuentas por Pagar',    description: 'Deudas a proveedores y pagos',             status: 'ready' },
      { slug: 'tax_reports',         name: 'Informes Tributarios', description: 'Reportes DIAN, IVA y factura electrónica', status: 'ready' },
      { slug: 'payroll',             name: 'Nómina',               description: 'Salarios, prestaciones y pagos',           status: 'ready' },
    ],
  },
  {
    category: 'Avanzado',
    items: [
      { slug: 'multi_branch',       name: 'Multi-Sucursal',           description: 'Gestión centralizada de sucursales',     status: 'ready' },
      { slug: 'warehouse_transfer', name: 'Transferencia de Bodegas', description: 'Movimientos entre sucursales y bodegas', status: 'ready' },
      { slug: 'ecommerce',          name: 'Tienda en Línea',          description: 'Catálogo web conectado al inventario',   status: 'ready' },
      { slug: 'webhooks',           name: 'Webhooks / API',           description: 'Integración con sistemas externos',      status: 'ready' },
      { slug: 'audit_log',          name: 'Auditoría',                description: 'Log de acciones críticas por usuario',   status: 'ready' },
    ],
  },
]

const STATUS_CFG = {
  ready:       { label: 'Disponible',    Icon: CheckCircle, cls: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  in_progress: { label: 'En desarrollo', Icon: Clock,       cls: 'text-amber-400',   bg: 'bg-amber-400/10'   },
  soon:        { label: 'Próximamente',  Icon: Lock,        cls: 'text-grafito-400 dark:text-grafito-500', bg: 'bg-grafito-100 dark:bg-white/5' },
}

// ─── Mapa de dependencias entre módulos (curado) ──────────────────────────────
// slug -> módulos que NECESITA activos para funcionar bien.
const MODULE_DEPS: Record<string, string[]> = {
  inventory: ['products'],
  pos: ['products', 'inventory'],
  cash_register: ['pos'],
  reports: ['pos', 'inventory'],
  // Restaurante
  tables: ['pos'],
  kitchen_display: ['pos', 'tables'],
  bar_tabs: ['pos', 'tables'],
  reservations: ['tables'],
  delivery: ['pos'],
  menu_digital: ['products', 'tables'],
  tips: ['pos'],
  split_bill: ['pos', 'tables'],
  // Retail
  promotions: ['pos', 'products'],
  loyalty: ['customers', 'pos'],
  label_printer: ['products'],
  purchase_orders: ['suppliers', 'inventory'],
  price_lists: ['products'],
  gift_cards: ['pos'],
  layaway: ['pos', 'customers'],
  // Finanzas
  accounting: ['pos', 'expenses'],
  accounts_receivable: ['customers', 'pos'],
  accounts_payable: ['suppliers', 'expenses'],
  tax_reports: ['pos'],
  payroll: ['employees'],
  // RRHH
  commissions: ['employees', 'pos'],
  attendance: ['employees'],
  // Farmacia
  expiry_control: ['batch_tracking'],
  batch_tracking: ['products', 'inventory'],
  prescriptions: ['drug_catalog', 'customers'],
  drug_catalog: ['products'],
  // Ferretería
  quotes: ['products', 'customers'],
  work_orders: ['customers'],
  assemblies: ['products', 'inventory'],
  unit_conversion: ['products'],
  serial_tracking: ['products', 'inventory'],
  // Avanzado
  warehouse_transfer: ['inventory'],
  multi_branch: ['inventory'],
  ecommerce: ['products', 'inventory'],
}

// Explicación "cómo funciona" para los módulos clave (los demás usan su descripción).
const MODULE_HOW: Record<string, string> = {
  pos: 'Es el corazón operativo: toma productos del catálogo, descuenta stock del inventario y registra el cobro en la caja abierta. Casi todo lo demás cuelga de aquí.',
  products: 'Catálogo base. Define qué se vende, con precio, categoría e impuesto. Lo consumen POS, inventario, promociones y más.',
  inventory: 'Lleva el stock por bodega. Se alimenta de las compras y se descuenta con cada venta del POS.',
  customers: 'Registro de clientes e historial. Habilita fidelización, cuentas por cobrar y facturación con datos del cliente.',
  reports: 'Lee ventas, caja e inventario para armar los informes. No genera datos propios: depende de que esos módulos existan.',
  cash_register: 'Apertura y cierre de caja por turno. Cuadra el efectivo contra las ventas del POS.',
  expenses: 'Registra las salidas de dinero del negocio y las categoriza. Puede enlazar cada gasto con un proveedor.',
  suppliers: 'Directorio de proveedores. Lo usan Gastos (para saber a quién le pagas) y, a futuro, Órdenes de Compra y Cuentas por Pagar.',
  kitchen_display: 'Muestra en cocina las órdenes que entran por el POS y las mesas. Sin POS/Mesas no recibe comandas.',
  tables: 'Mapa de mesas. Abre cuentas que luego cobra el POS.',
  // Retail
  purchase_orders: 'Creas pedidos a un proveedor con productos y costos; al recibir cambias el estado. Es la base de Cuentas por Pagar y de la entrada de inventario.',
  price_lists: 'Defines listas de precios (por cliente, canal o volumen) con un precio por producto; el POS las aplicará al cobrar.',
  gift_cards: 'Emites tarjetas con saldo y código único; se redimen contra las ventas hasta agotar el saldo.',
  layaway: 'Apartas productos para un cliente y registras abonos parciales hasta completar el pago.',
  // Farmacia
  prescriptions: 'Registras la receta (paciente, médico, medicamentos) y la validas antes de dispensar lo que requiere fórmula. Se apoya en el Catálogo de Medicamentos.',
  expiry_control: 'Lee los lotes y te alerta de los que están vencidos o por vencer en una ventana de 30/60/90 días. Depende de Trazabilidad por Lotes.',
  batch_tracking: 'Registra cada lote (número, vencimiento, proveedor, cantidad) para trazar el origen de lo que vendes y alimentar Vencimientos.',
  drug_catalog: 'Catálogo de medicamentos con principio activo, concentración y registro INVIMA; marca cuáles requieren receta.',
  // Ferretería
  quotes: 'Armas una cotización con ítems y precios; al aceptarse se puede convertir en venta.',
  work_orders: 'Registras trabajos/servicios con repuestos y mano de obra, y sigues su estado hasta entregar.',
  assemblies: 'Defines kits compuestos por varios productos (componentes) con su precio de venta.',
  unit_conversion: 'Defines unidades de venta por producto (metro, bulto, docena) con su factor y precio.',
  serial_tracking: 'Registras el número de serie de cada unidad y sigues su estado (en stock, vendido, devuelto, defectuoso).',
  // Finanzas
  accounting: 'Plan de cuentas + libro diario con asientos que deben cuadrar (débito = crédito). Genera el balance de comprobación.',
  accounts_receivable: 'Lleva lo que te deben los clientes y registras los cobros parciales hasta saldar la cuenta.',
  accounts_payable: 'Lleva lo que le debes a proveedores y registras los pagos hasta saldar la cuenta.',
  tax_reports: 'Calcula base gravable, IVA generado y total facturado a partir de tus ventas en un período. Base para la factura electrónica DIAN.',
  payroll: 'Registras salario base, bonos y deducciones por empleado; calcula el neto y marcas el pago.',
}

const ALL_MODULES = MODULES.flatMap(g => g.items)
const nameOf = (slug: string) => ALL_MODULES.find(m => m.slug === slug)?.name ?? slug
const statusOf = (slug: string) => ALL_MODULES.find(m => m.slug === slug)?.status
const dependentsOf = (slug: string) =>
  Object.entries(MODULE_DEPS).filter(([, deps]) => deps.includes(slug)).map(([s]) => s)

// ─── Panel de detalle de un módulo ────────────────────────────────────────────
function ModuleDetail({ mod, onClose }: { mod: ModuleDef; onClose: () => void }) {
  const deps = MODULE_DEPS[mod.slug] ?? []
  const dependents = dependentsOf(mod.slug)
  const sc = STATUS_CFG[mod.status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-lg font-bold text-grafito-900 dark:text-white">{mod.name}</h3>
            <p className="text-[10px] font-mono uppercase tracking-wide text-grafito-400">{mod.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap', sc.bg, sc.cls)}>
              <sc.Icon className="h-3 w-3" /> {sc.label}
            </span>
            <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Cómo funciona */}
        <section className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-grafito-400 mb-1">Cómo funciona</p>
          <p className="text-sm text-grafito-700 dark:text-grafito-200">{MODULE_HOW[mod.slug] ?? mod.description}</p>
        </section>

        {/* Depende de */}
        <section className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-grafito-400 mb-1 flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Depende de</p>
          {deps.length === 0 ? (
            <p className="text-sm text-grafito-500">No necesita otros módulos. Es autónomo.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {deps.map(d => (
                <span key={d} className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg',
                  statusOf(d) === 'ready' ? 'bg-grafito-100 dark:bg-white/10 text-grafito-700 dark:text-grafito-200' : 'bg-amber-400/10 text-amber-600 dark:text-amber-400')}>
                  {nameOf(d)}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Lo necesitan */}
        <section className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-grafito-400 mb-1 flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5" /> Lo necesitan</p>
          {dependents.length === 0 ? (
            <p className="text-sm text-grafito-500">Ningún otro módulo depende de este.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {dependents.map(d => (
                <span key={d} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-grafito-100 dark:bg-white/10 text-grafito-700 dark:text-grafito-200">{nameOf(d)}</span>
              ))}
            </div>
          )}
        </section>

        {/* Impacto al desconectar */}
        <section className={cn('mt-5 rounded-xl border p-4', dependents.length ? 'border-red-500/20 bg-red-500/10' : 'border-emerald-500/20 bg-emerald-500/10')}>
          <p className={cn('text-sm font-semibold flex items-center gap-2', dependents.length ? 'text-red-500' : 'text-emerald-500')}>
            {dependents.length ? <AlertTriangle className="h-4 w-4" /> : <PlugZap className="h-4 w-4" />}
            Si desconectas “{mod.name}”
          </p>
          {dependents.length ? (
            <p className="text-xs text-red-500/90 mt-1">
              Se afectan {dependents.length} módulo{dependents.length > 1 ? 's' : ''}: {dependents.map(nameOf).join(', ')}.
              Dejan de funcionar o pierden funciones hasta que lo reactives.
            </p>
          ) : (
            <p className="text-xs text-emerald-600/90 dark:text-emerald-400/90 mt-1">
              Se puede desconectar sin afectar a otros módulos.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

export default function PlatformModulesPage() {
  const [filter, setFilter] = useState<ModuleStatus | 'all'>('all')
  const [selected, setSelected] = useState<ModuleDef | null>(null)

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
                    <button
                      key={mod.slug}
                      onClick={() => setSelected(mod)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-grafito-900 dark:text-white flex items-center gap-1.5">
                          {mod.name}
                          {(MODULE_DEPS[mod.slug]?.length || dependentsOf(mod.slug).length) ? <Link2 className="h-3 w-3 text-grafito-400" /> : null}
                        </p>
                        <p className="text-xs text-grafito-500 mt-0.5">{mod.description}</p>
                      </div>
                      <span className={cn(
                        'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap',
                        sc.bg, sc.cls,
                      )}>
                        <sc.Icon className="h-3 w-3" />
                        {sc.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {selected && <ModuleDetail mod={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
