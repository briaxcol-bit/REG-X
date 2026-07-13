import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Network, ArrowRight, ArrowDownRight, ZapOff, AlertTriangle,
  CheckCircle2, Info, Boxes, Puzzle, ExternalLink,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'

// Ruta real de cada módulo, para "entrar" a verlo como demo en vivo.
const ROUTE_BY_SLUG: Record<string, string> = {
  pos: '/pos',
  products: '/products',
  inventory: '/inventory',
  customers: '/customers',
  cash_register: '/pos',
  expenses: '/expenses',
  suppliers: '/suppliers',
  employees: '/employees',
  attendance: '/attendance',
  commissions: '/commissions',
  tips: '/tips',
  reservations: '/reservations',
  bar_tabs: '/bar-tabs',
  delivery: '/delivery',
  menu_digital: '/menu-qr',
  split_bill: '/split-bill',
  promotions: '/promotions',
  loyalty: '/loyalty',
  label_printer: '/labels',
  restaurant: '/restaurant',
  reports: '/reports',
  // Retail
  purchase_orders: '/purchase-orders',
  price_lists: '/price-lists',
  gift_cards: '/gift-cards',
  layaway: '/layaways',
  // Farmacia
  drug_catalog: '/drug-catalog',
  batch_tracking: '/batches',
  expiry_control: '/expiry-control',
  prescriptions: '/prescriptions',
  // Ferretería
  quotes: '/quotes',
  work_orders: '/work-orders',
  assemblies: '/assemblies',
  unit_conversion: '/unit-conversion',
  serial_tracking: '/serials',
  // Finanzas
  accounting: '/accounting',
  accounts_receivable: '/receivables',
  accounts_payable: '/payables',
  tax_reports: '/tax-reports',
  payroll: '/payroll',
  // Avanzado
  multi_branch: '/branches',
  warehouse_transfer: '/inventory/transfers',
  ecommerce: '/ecommerce',
  webhooks: '/webhooks',
  audit_log: '/audit',
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLORADOR DE MÓDULOS (solo SUPER_ADMIN)
// Mapa curado de cómo funciona cada módulo, cómo se conecta con los otros y
// qué se rompe / degrada si desconectas alguno. Las relaciones NO viven en la
// BD todavía, así que se mantienen aquí a mano. Al agregar un módulo nuevo,
// súmale su ficha y sus relaciones (needs / boostedBy).
// ─────────────────────────────────────────────────────────────────────────────

type Health = 'ok' | 'degraded' | 'broken'

interface ModuleNode {
  slug: string
  name: string
  category: string
  howItWorks: string          // cómo funciona por dentro
  needs: string[]             // dependencias DURAS: sin esto no funciona
  boostedBy: string[]         // dependencias BLANDAS: funciona mejor con esto
  ifDisconnected: string      // qué pasa en el negocio si lo apagas
}

// Catálogo de módulos ya construidos (los "Próximamente" no se mapean aún).
const NODES: ModuleNode[] = [
  {
    slug: 'products', name: 'Productos', category: 'Core',
    howItWorks: 'Mantiene el catálogo maestro: ítems, categorías, precios e imágenes. Es la fuente de verdad de "qué se vende".',
    needs: [],
    boostedBy: ['suppliers'],
    ifDisconnected: 'Nadie puede vender ni mover inventario: el POS se queda sin catálogo y el inventario sin ítems que contar. Es la base de casi todo.',
  },
  {
    slug: 'inventory', name: 'Inventario', category: 'Core',
    howItWorks: 'Lleva el stock por sucursal, registra movimientos (entradas/salidas), alertas de mínimos y valoración del inventario.',
    needs: ['products'],
    boostedBy: ['suppliers', 'pos'],
    ifDisconnected: 'Se pierde el control de existencias: el POS deja de descontar stock y no hay alertas de agotados. Se puede seguir vendiendo, pero a ciegas.',
  },
  {
    slug: 'cash_register', name: 'Caja y Arqueo', category: 'Core',
    howItWorks: 'Abre y cierra turnos de caja, registra entradas/salidas de efectivo y cuadra al final del turno.',
    needs: [],
    boostedBy: [],
    ifDisconnected: 'El POS no puede abrir turno para cobrar en efectivo y no hay cuadre de caja. Los reportes de caja quedan vacíos.',
  },
  {
    slug: 'pos', name: 'Punto de Venta', category: 'Core',
    howItWorks: 'El corazón operativo: arma la venta, cobra, emite recibo, descuenta inventario y registra el movimiento en la caja abierta.',
    needs: ['products', 'cash_register'],
    boostedBy: ['inventory', 'customers', 'restaurant', 'employees'],
    ifDisconnected: 'El negocio no puede facturar. Se detiene el flujo de ingresos y todo lo que depende de las ventas (reportes, comisiones, historial de cliente).',
  },
  {
    slug: 'customers', name: 'Clientes', category: 'Core',
    howItWorks: 'CRM básico: registra clientes y arma el historial de compras enlazado desde el POS.',
    needs: [],
    boostedBy: ['pos'],
    ifDisconnected: 'Se pierde el historial por cliente y la facturación con datos del comprador. Las ventas siguen, pero como anónimas.',
  },
  {
    slug: 'suppliers', name: 'Proveedores', category: 'Core',
    howItWorks: 'Directorio de proveedores y contactos. Es el "con quién compro" que alimenta compras, inventario y gastos.',
    needs: [],
    boostedBy: [],
    ifDisconnected: 'Los gastos y las entradas de inventario pierden el enlace a proveedor: puedes seguir registrándolos, pero sin saber a quién le compraste.',
  },
  {
    slug: 'expenses', name: 'Gastos Operativos', category: 'Core',
    howItWorks: 'Registra y categoriza egresos (arriendo, servicios, nómina, insumos), con método de pago, factura y proveedor opcional. Suma totales por período.',
    needs: [],
    boostedBy: ['suppliers', 'cash_register'],
    ifDisconnected: 'Desaparece la foto de egresos: el reporte de rentabilidad queda incompleto porque solo ves ingresos, no cuánto se fue.',
  },
  {
    slug: 'employees', name: 'Empleados', category: 'Recursos Humanos',
    howItWorks: 'Define usuarios del negocio, sus roles y permisos, y sus datos laborales. Es quién puede hacer qué.',
    needs: [],
    boostedBy: [],
    ifDisconnected: 'Sin control de roles: no sabes quién vendió ni quién movió caja, y se cae la base para comisiones y auditoría.',
  },
  {
    slug: 'attendance', name: 'Asistencia y Turnos', category: 'Recursos Humanos',
    howItWorks: 'Registra la entrada/salida de cada empleado y calcula horas trabajadas, y permite programar los turnos de la semana.',
    needs: ['employees'],
    boostedBy: [],
    ifDisconnected: 'Se pierde el control horario: no hay fichaje ni programación de turnos. La nómina por horas queda sin insumo.',
  },
  {
    slug: 'commissions', name: 'Comisiones', category: 'Recursos Humanos',
    howItWorks: 'Aplica un % de comisión (base por empleado + overrides por categoría) sobre las ventas de cada vendedor y arma el reporte por periodo.',
    needs: ['employees', 'pos'],
    boostedBy: ['products'],
    ifDisconnected: 'No se calculan comisiones: los vendedores dejan de ver su parte variable y el reporte de pagos queda incompleto.',
  },
  {
    slug: 'tips', name: 'Propinas', category: 'Restaurante',
    howItWorks: 'Guarda cada propina cobrada en el POS como dato real, arma el bote acumulado y lo reparte entre el equipo (partes iguales, por horas o por ventas).',
    needs: ['pos'],
    boostedBy: ['attendance', 'restaurant'],
    ifDisconnected: 'Las propinas vuelven a quedar solo como nota en la venta: no hay bote acumulado ni reparto entre el personal.',
  },
  {
    slug: 'reservations', name: 'Reservas', category: 'Restaurante',
    howItWorks: 'Agenda de reservas por día con estados (pendiente, confirmada, sentada, no llegó) y recordatorio al cliente por WhatsApp. Puede asignar mesa.',
    needs: [],
    boostedBy: ['restaurant'],
    ifDisconnected: 'Sin agenda de reservas: la asignación de mesas y la confirmación con el cliente se manejan por fuera del sistema.',
  },
  {
    slug: 'bar_tabs', name: 'Comandas de Bar', category: 'Restaurante',
    howItWorks: 'Abre cuentas (tabs) por mesa o cliente que acumulan consumos del catálogo hasta que se cierran. Muestra el total en vivo.',
    needs: ['products'],
    boostedBy: ['restaurant'],
    ifDisconnected: 'No hay cuentas abiertas acumulando consumo: cada pedido tendría que cobrarse suelto en el POS.',
  },
  {
    slug: 'delivery', name: 'Delivery', category: 'Restaurante',
    howItWorks: 'Tablero de pedidos a domicilio por estado (pendiente → preparando → en camino → entregado), asignación de repartidor y contacto por WhatsApp.',
    needs: [],
    boostedBy: ['pos'],
    ifDisconnected: 'Se pierde el seguimiento de domicilios y repartidores; los pedidos a domicilio quedan sin control de estado.',
  },
  {
    slug: 'menu_digital', name: 'Menú Digital QR', category: 'Restaurante',
    howItWorks: 'Genera un código QR que lleva a un menú público (sin login) con los productos activos y sus precios, agrupados por categoría.',
    needs: ['products'],
    boostedBy: [],
    ifDisconnected: 'El menú por QR deja de estar disponible para los clientes; hay que volver a la carta física.',
  },
  {
    slug: 'split_bill', name: 'División de Cuenta', category: 'Restaurante',
    howItWorks: 'Toma una comanda de bar o un total manual y lo divide entre comensales: partes iguales, por ítems asignados o montos personalizados, con propina incluida.',
    needs: [],
    boostedBy: ['bar_tabs'],
    ifDisconnected: 'Dividir la cuenta vuelve a ser manual (calculadora aparte); no queda registro de cómo se repartió.',
  },
  {
    slug: 'promotions', name: 'Promociones y Descuentos', category: 'Retail',
    howItWorks: 'Define reglas de descuento (porcentaje, monto fijo, 2x1 o combo) por todo el catálogo, una categoría o un producto, con vigencia y activación.',
    needs: ['products'],
    boostedBy: ['pos'],
    ifDisconnected: 'Se pierden las reglas de descuento; los precios especiales habría que aplicarlos a mano en cada venta.',
  },
  {
    slug: 'loyalty', name: 'Fidelización', category: 'Retail',
    howItWorks: 'Configura cuántos puntos gana el cliente por compra y cuánto vale cada punto, lleva el saldo por cliente y un catálogo de recompensas canjeables.',
    needs: ['customers'],
    boostedBy: ['pos'],
    ifDisconnected: 'Los clientes dejan de acumular y redimir puntos; se pierde el incentivo de recompra.',
  },
  {
    slug: 'label_printer', name: 'Impresora de Etiquetas', category: 'Retail',
    howItWorks: 'Genera etiquetas de precio con código de barras Code128 a partir de los productos, en la cantidad que elijas, listas para imprimir.',
    needs: ['products'],
    boostedBy: [],
    ifDisconnected: 'Hay que rotular precios y códigos a mano; el POS no puede escanear etiquetas generadas aquí.',
  },
  {
    slug: 'restaurant', name: 'Restaurante (Mesas / KDS)', category: 'Restaurante',
    howItWorks: 'Mapa de mesas, órdenes por mesa y pantalla de cocina en tiempo real. Empuja las comandas hacia el POS para cerrar la cuenta.',
    needs: ['products', 'pos'],
    boostedBy: [],
    ifDisconnected: 'El flujo de mesa y cocina se apaga; el negocio pasa a venta directa por mostrador en el POS.',
  },
  {
    slug: 'reports', name: 'Reportes', category: 'Core',
    howItWorks: 'Consolida y muestra: ventas (POS), caja (arqueo), inventario y gastos. Es puramente consumidor, no genera datos.',
    needs: ['pos'],
    boostedBy: ['inventory', 'cash_register', 'expenses', 'customers'],
    ifDisconnected: 'Pierdes la visión gerencial. La operación sigue, pero te quedas sin tablero para decidir.',
  },

  // ── Retail ──────────────────────────────────────────────────
  {
    slug: 'purchase_orders', name: 'Órdenes de Compra', category: 'Retail',
    howItWorks: 'Crea pedidos a un proveedor con productos y costos; al recibir cambias el estado y entra la mercancía.',
    needs: ['suppliers', 'products'],
    boostedBy: ['inventory', 'accounts_payable'],
    ifDisconnected: 'No hay pedidos formales a proveedores ni seguimiento de la compra; las entradas de inventario se registran sueltas.',
  },
  {
    slug: 'price_lists', name: 'Listas de Precios', category: 'Retail',
    howItWorks: 'Define precios alternos por cliente, canal o volumen sobre tus productos; el POS los aplica al cobrar.',
    needs: ['products'],
    boostedBy: ['pos', 'customers'],
    ifDisconnected: 'Todos venden al precio único del producto: se pierden los precios de mayorista, VIP o por volumen.',
  },
  {
    slug: 'gift_cards', name: 'Tarjetas de Regalo', category: 'Retail',
    howItWorks: 'Emite tarjetas con saldo y código único; se redimen contra las ventas hasta agotar el saldo.',
    needs: [],
    boostedBy: ['pos', 'customers'],
    ifDisconnected: 'No se pueden emitir ni redimir gift cards; se pierde esa forma de pago y de regalo.',
  },
  {
    slug: 'layaway', name: 'Apartados', category: 'Retail',
    howItWorks: 'Aparta productos para un cliente y registra abonos parciales hasta completar el pago.',
    needs: ['products'],
    boostedBy: ['customers', 'pos'],
    ifDisconnected: 'No hay apartados con abonos: el cliente tendría que pagar todo de una o se maneja en cuaderno.',
  },

  // ── Farmacia ────────────────────────────────────────────────
  {
    slug: 'drug_catalog', name: 'Catálogo de Medicamentos', category: 'Farmacia',
    howItWorks: 'Catálogo farmacológico con principio activo, concentración y registro INVIMA; marca qué requiere receta.',
    needs: [],
    boostedBy: ['products'],
    ifDisconnected: 'Se pierde la ficha farmacológica; las recetas quedan sin catálogo de referencia.',
  },
  {
    slug: 'batch_tracking', name: 'Trazabilidad por Lotes', category: 'Farmacia',
    howItWorks: 'Registra cada lote por producto (número, vencimiento, proveedor, cantidad) para trazar su origen.',
    needs: ['products'],
    boostedBy: ['suppliers', 'inventory'],
    ifDisconnected: 'Sin lotes no hay trazabilidad ni base para el control de vencimientos.',
  },
  {
    slug: 'expiry_control', name: 'Control de Vencimientos', category: 'Farmacia',
    howItWorks: 'Lee los lotes y alerta de lo vencido o por vencer en una ventana de 30/60/90 días.',
    needs: ['batch_tracking'],
    boostedBy: [],
    ifDisconnected: 'Nadie avisa de productos por vencer; hay que revisar fechas a mano.',
  },
  {
    slug: 'prescriptions', name: 'Recetas Médicas', category: 'Farmacia',
    howItWorks: 'Registra la receta (paciente, médico, medicamentos) y la valida antes de dispensar lo que requiere fórmula.',
    needs: [],
    boostedBy: ['drug_catalog', 'customers'],
    ifDisconnected: 'No queda registro de recetas dispensadas; el control de fórmulas se hace por fuera.',
  },

  // ── Ferretería / Industrial ─────────────────────────────────
  {
    slug: 'quotes', name: 'Cotizaciones', category: 'Ferretería',
    howItWorks: 'Arma una cotización con ítems y precios; al aceptarse se puede convertir en venta.',
    needs: ['products'],
    boostedBy: ['customers', 'pos'],
    ifDisconnected: 'Las cotizaciones se hacen por fuera (Excel) y no se convierten en venta con un clic.',
  },
  {
    slug: 'work_orders', name: 'Órdenes de Trabajo', category: 'Ferretería',
    howItWorks: 'Registra trabajos/servicios con repuestos y mano de obra, y sigue su estado hasta la entrega.',
    needs: [],
    boostedBy: ['customers', 'products'],
    ifDisconnected: 'No hay seguimiento de reparaciones/servicios; se controlan en papel.',
  },
  {
    slug: 'assemblies', name: 'Ensambles y Kits', category: 'Ferretería',
    howItWorks: 'Define kits compuestos por varios productos (componentes) con su precio de venta.',
    needs: ['products'],
    boostedBy: ['inventory'],
    ifDisconnected: 'No se pueden armar ni vender kits; hay que cobrar cada componente suelto.',
  },
  {
    slug: 'unit_conversion', name: 'Conversión de Unidades', category: 'Ferretería',
    howItWorks: 'Define unidades de venta por producto (metro, bulto, docena) con su factor y precio.',
    needs: ['products'],
    boostedBy: ['pos'],
    ifDisconnected: 'Solo se vende en la unidad base: no se puede vender por fracción, metro o bulto.',
  },
  {
    slug: 'serial_tracking', name: 'Seguimiento por Serial', category: 'Ferretería',
    howItWorks: 'Registra el número de serie de cada unidad y sigue su estado (en stock, vendido, devuelto, defectuoso).',
    needs: ['products'],
    boostedBy: ['inventory'],
    ifDisconnected: 'No hay rastreo por serial; se pierde el control de garantías y unidades individuales.',
  },

  // ── Finanzas ────────────────────────────────────────────────
  {
    slug: 'accounting', name: 'Contabilidad', category: 'Finanzas',
    howItWorks: 'Plan de cuentas + libro diario con asientos que deben cuadrar (débito = crédito) y genera el balance de comprobación.',
    needs: [],
    boostedBy: ['pos', 'expenses'],
    ifDisconnected: 'No hay libro contable ni balances; la contabilidad se lleva por fuera.',
  },
  {
    slug: 'accounts_receivable', name: 'Cuentas por Cobrar', category: 'Finanzas',
    howItWorks: 'Lleva lo que te deben los clientes y registra los cobros parciales hasta saldar la cuenta.',
    needs: [],
    boostedBy: ['customers', 'pos'],
    ifDisconnected: 'Se pierde el control de la cartera: no sabes quién te debe ni cuánto.',
  },
  {
    slug: 'accounts_payable', name: 'Cuentas por Pagar', category: 'Finanzas',
    howItWorks: 'Lleva lo que le debes a proveedores y registra los pagos hasta saldar la cuenta.',
    needs: [],
    boostedBy: ['suppliers', 'expenses', 'purchase_orders'],
    ifDisconnected: 'Se pierde el control de las deudas a proveedores y sus vencimientos.',
  },
  {
    slug: 'tax_reports', name: 'Informes Tributarios', category: 'Finanzas',
    howItWorks: 'Calcula base gravable, IVA generado y total facturado a partir de tus ventas en un período.',
    needs: ['pos'],
    boostedBy: [],
    ifDisconnected: 'No hay resumen de IVA/base gravable; el reporte tributario se arma a mano.',
  },
  {
    slug: 'payroll', name: 'Nómina', category: 'Finanzas',
    howItWorks: 'Registra salario base, bonos y deducciones por empleado; calcula el neto y marca el pago.',
    needs: [],
    boostedBy: ['employees', 'attendance'],
    ifDisconnected: 'La nómina se calcula por fuera; no queda registro de pagos al personal.',
  },

  // ── Avanzado ────────────────────────────────────────────────
  {
    slug: 'multi_branch', name: 'Multi-Sucursal', category: 'Avanzado',
    howItWorks: 'Gestiona varias sucursales (crear, editar, activar). Cada una tiene su caja, inventario y ventas, con vista centralizada.',
    needs: [],
    boostedBy: ['inventory', 'pos', 'reports'],
    ifDisconnected: 'Vuelves a operar como una sola sucursal; se pierde la gestión centralizada de puntos de venta.',
  },
  {
    slug: 'warehouse_transfer', name: 'Transferencia de Bodegas', category: 'Avanzado',
    howItWorks: 'Registra movimientos de stock entre bodegas y sucursales, descontando de origen y sumando en destino.',
    needs: ['inventory'],
    boostedBy: ['multi_branch'],
    ifDisconnected: 'No hay traslados formales entre bodegas; el stock se cuadra con ajustes manuales.',
  },
  {
    slug: 'ecommerce', name: 'Tienda en Línea', category: 'Avanzado',
    howItWorks: 'Publica un catálogo web conectado al inventario; los clientes ven productos y precios y piden por WhatsApp.',
    needs: ['products'],
    boostedBy: ['inventory'],
    ifDisconnected: 'Se apaga la vitrina web: solo queda la venta presencial en el POS.',
  },
  {
    slug: 'webhooks', name: 'Webhooks / API', category: 'Avanzado',
    howItWorks: 'Registra endpoints y API keys para integrar REG-X con sistemas externos, notificando eventos (ventas, stock bajo…).',
    needs: [],
    boostedBy: ['pos'],
    ifDisconnected: 'Se corta la integración con sistemas externos; los datos quedan solo dentro de REG-X.',
  },
  {
    slug: 'audit_log', name: 'Auditoría', category: 'Avanzado',
    howItWorks: 'Registra automáticamente quién creó, editó o eliminó datos críticos (ventas, productos, caja) con fecha y usuario.',
    needs: [],
    boostedBy: ['employees'],
    ifDisconnected: 'Se pierde la trazabilidad: no queda rastro de quién cambió qué en el sistema.',
  },
]

const BY_SLUG = Object.fromEntries(NODES.map(n => [n.slug, n])) as Record<string, ModuleNode>

// ── Motor de impacto ─────────────────────────────────────────────────────────
// Al apagar `offSlug`: se ROMPE todo módulo que lo necesita (needs), en cascada.
// Se DEGRADA todo módulo que lo tenía como boost, o que depende de algo roto de
// forma blanda.
function computeImpact(offSlug: string): Record<string, Health> {
  const health: Record<string, Health> = {}
  NODES.forEach(n => { health[n.slug] = 'ok' })
  health[offSlug] = 'broken'

  // Cascada de roturas por dependencia dura.
  let changed = true
  while (changed) {
    changed = false
    for (const n of NODES) {
      if (health[n.slug] === 'broken') continue
      const hardBroken = n.needs.some(d => health[d] === 'broken')
      if (hardBroken) { health[n.slug] = 'broken'; changed = true }
    }
  }

  // Degradaciones por dependencia blanda (si el boost está roto o apagado).
  for (const n of NODES) {
    if (health[n.slug] === 'broken') continue
    const softHit = n.boostedBy.some(d => health[d] === 'broken')
    if (softHit) health[n.slug] = 'degraded'
  }
  return health
}

const HEALTH_CFG: Record<Health, { label: string; dot: string; text: string; bg: string }> = {
  ok:       { label: 'Sin cambios', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  degraded: { label: 'Se degrada',  dot: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-400/10' },
  broken:   { label: 'Se rompe',    dot: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400',        bg: 'bg-rose-500/10' },
}

export default function PlatformModuleMapPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string>('pos')
  const [simOff, setSimOff]     = useState<string | null>(null)

  const node = BY_SLUG[selected]
  const demoRoute = ROUTE_BY_SLUG[selected]

  // Quién depende del módulo seleccionado (consumidores aguas abajo).
  const consumers = useMemo(() => {
    const hard = NODES.filter(n => n.needs.includes(selected)).map(n => n.slug)
    const soft = NODES.filter(n => n.boostedBy.includes(selected)).map(n => n.slug)
    return { hard, soft }
  }, [selected])

  const impact = useMemo(() => (simOff ? computeImpact(simOff) : null), [simOff])
  const impactList = impact
    ? NODES.filter(n => n.slug !== simOff && impact[n.slug] !== 'ok')
    : []

  const categories = [...new Set(NODES.map(n => n.category))]

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5">
          <Network className="h-5 w-5 text-brand-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Explorador de Módulos</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">
            Cómo funciona cada módulo, con qué se conecta y qué se rompe si lo desconectas. Solo tú (super admin) ves esto.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Columna izquierda: lista de módulos */}
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat} className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-grafito-100 dark:border-white/5 bg-grafito-50 dark:bg-white/[0.02]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-grafito-500">{cat}</p>
              </div>
              <div className="divide-y divide-grafito-100 dark:divide-white/5">
                {NODES.filter(n => n.category === cat).map(n => {
                  const h = impact ? impact[n.slug] : 'ok'
                  const isOff = simOff === n.slug
                  return (
                    <button
                      key={n.slug}
                      onClick={() => setSelected(n.slug)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
                        selected === n.slug ? 'bg-brand-500/10' : 'hover:bg-grafito-50 dark:hover:bg-white/5',
                      )}
                    >
                      <span className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        isOff ? 'bg-grafito-400' : impact ? HEALTH_CFG[h].dot : 'bg-brand-400/60',
                      )} />
                      <span className={cn(
                        'text-sm font-medium truncate',
                        selected === n.slug ? 'text-brand-600 dark:text-brand-300' : 'text-grafito-700 dark:text-grafito-200',
                      )}>
                        {n.name}
                      </span>
                      {isOff && <ZapOff className="h-3.5 w-3.5 text-grafito-400 ml-auto shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Columna derecha: detalle + impacto */}
        <div className="space-y-5">
          {/* Ficha del módulo */}
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-brand-500/10 p-2">
                  <Boxes className="h-4 w-4 text-brand-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-grafito-900 dark:text-white">{node.name}</h2>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-grafito-400">{node.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {demoRoute && (
                  <button
                    onClick={() => navigate(demoRoute)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver módulo
                  </button>
                )}
                <button
                  onClick={() => setSimOff(simOff === node.slug ? null : node.slug)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    simOff === node.slug
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10',
                  )}
                >
                  <ZapOff className="h-3.5 w-3.5" />
                  {simOff === node.slug ? 'Reconectar' : 'Simular desconexión'}
                </button>
              </div>
            </div>

            {/* Cómo funciona */}
            <div className="flex gap-2.5">
              <Info className="h-4 w-4 text-brand-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-grafito-500 mb-0.5">Cómo funciona</p>
                <p className="text-sm text-grafito-700 dark:text-grafito-200 leading-relaxed">{node.howItWorks}</p>
              </div>
            </div>

            {/* Conexiones */}
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              {/* Necesita (aguas arriba) */}
              <div className="rounded-xl bg-grafito-50 dark:bg-white/[0.02] p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-grafito-500 mb-2">
                  <ArrowRight className="h-3.5 w-3.5" /> Necesita
                </p>
                {node.needs.length || node.boostedBy.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {node.needs.map(s => (
                      <Chip key={s} onClick={() => setSelected(s)} tone="hard">{BY_SLUG[s]?.name ?? s}</Chip>
                    ))}
                    {node.boostedBy.map(s => (
                      <Chip key={s} onClick={() => setSelected(s)} tone="soft">{BY_SLUG[s]?.name ?? s}</Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-grafito-400">Es un módulo base: no depende de nadie.</p>
                )}
              </div>

              {/* Alimenta (aguas abajo) */}
              <div className="rounded-xl bg-grafito-50 dark:bg-white/[0.02] p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-grafito-500 mb-2">
                  <ArrowDownRight className="h-3.5 w-3.5" /> Alimenta a
                </p>
                {consumers.hard.length || consumers.soft.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {consumers.hard.map(s => (
                      <Chip key={s} onClick={() => setSelected(s)} tone="hard">{BY_SLUG[s]?.name ?? s}</Chip>
                    ))}
                    {consumers.soft.map(s => (
                      <Chip key={s} onClick={() => setSelected(s)} tone="soft">{BY_SLUG[s]?.name ?? s}</Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-grafito-400">Nadie depende de él: es un consumidor final.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-grafito-400 pt-0.5">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Dura (lo necesita)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Blanda (lo mejora)</span>
            </div>
          </div>

          {/* Panel de impacto */}
          <div className={cn(
            'rounded-2xl border p-5',
            simOff
              ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/[0.06]'
              : 'border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60',
          )}>
            {simOff ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <h3 className="text-sm font-bold text-grafito-900 dark:text-white">
                    Si desconectas «{BY_SLUG[simOff].name}»…
                  </h3>
                </div>
                <p className="text-xs text-grafito-500 mb-3">{BY_SLUG[simOff].ifDisconnected}</p>

                {impactList.length ? (
                  <div className="space-y-2">
                    {impactList.map(n => {
                      const h = impact![n.slug]
                      const cfg = HEALTH_CFG[h]
                      return (
                        <div key={n.slug} className={cn('flex items-center gap-3 rounded-lg px-3 py-2', cfg.bg)}>
                          <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
                          <span className="text-sm font-medium text-grafito-800 dark:text-grafito-100 flex-1">{n.name}</span>
                          <span className={cn('text-xs font-bold shrink-0', cfg.text)}>{cfg.label}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Ningún otro módulo se ve afectado. Se puede apagar de forma aislada.
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2.5 text-sm text-grafito-500">
                <Puzzle className="h-4 w-4 text-grafito-400" />
                Pulsa <span className="font-semibold text-rose-500">Simular desconexión</span> en cualquier módulo para ver, en cascada, qué se rompe y qué se degrada en el resto de la plataforma.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Chip clickeable para saltar a un módulo relacionado.
function Chip({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone: 'hard' | 'soft' }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 rounded-md text-xs font-medium border transition-colors',
        tone === 'hard'
          ? 'border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10'
          : 'border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-400/10',
      )}
    >
      {children}
    </button>
  )
}
