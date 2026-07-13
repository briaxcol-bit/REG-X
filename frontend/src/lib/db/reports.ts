/**
 * REG-X — Capa de datos Supabase · dominio: reports
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { SaleRow } from './sales'

export interface DashboardStats {
  salesToday: number
  salesYesterday: number
  activeOrders: number
  newCustomersToday: number
  newCustomersYesterday: number
  totalStock: number
  recentSales: {
    id: string
    customer: string
    amount: number
    time: string
    status: string
  }[]
  monthlySales: { month: number; total: number }[]
}

// ── Dashboard ──────────────────────────────────────────────────
export async function getDashboardStats(
  tenantId: string,
  branchId: string,
): Promise<DashboardStats> {
  const now  = new Date()
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()

  // Ventas de hoy
  const { data: salesTodayRows } = await supabase
    .from('sales')
    .select('total, status')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('status', 'COMPLETED')
    .gte('created_at', todayStart)

  // Ventas de ayer
  const { data: salesYesterdayRows } = await supabase
    .from('sales')
    .select('total')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('status', 'COMPLETED')
    .gte('created_at', yesterdayStart)
    .lt('created_at', todayStart)

  // Órdenes activas (PENDING)
  const { count: activeOrders } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('status', 'PENDING')

  // Clientes nuevos hoy
  const { count: newCustomersToday } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', todayStart)

  // Clientes nuevos ayer
  const { count: newCustomersYesterday } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', yesterdayStart)
    .lt('created_at', todayStart)

  // Stock total
  const { data: stockRows } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)

  // Últimas ventas
  const { data: recentRows } = await supabase
    .from('sales')
    .select('id, total, status, created_at, customers(full_name)')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Ventas por mes (año actual)
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString()
  const { data: monthlyRows } = await supabase
    .from('sales')
    .select('created_at, total')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('status', 'COMPLETED')
    .gte('created_at', yearStart)

  // Agrupar mensual
  const monthly: { [k: number]: number } = {}
  for (let i = 1; i <= 12; i++) monthly[i] = 0
  for (const row of monthlyRows ?? []) {
    const m = new Date(row.created_at).getMonth() + 1
    monthly[m] = (monthly[m] ?? 0) + Number(row.total)
  }

  const salesToday     = (salesTodayRows ?? []).reduce((s, r) => s + Number(r.total), 0)
  const salesYesterday = (salesYesterdayRows ?? []).reduce((s, r) => s + Number(r.total), 0)
  const totalStock     = (stockRows ?? []).reduce((s, r) => s + Number(r.quantity), 0)

  const recentSales = (recentRows ?? []).map((r) => {
    const created = new Date(r.created_at)
    const diffMin = Math.round((Date.now() - created.getTime()) / 60000)
    const time    = diffMin < 60
      ? `Hace ${diffMin} min`
      : diffMin < 1440
        ? `Hace ${Math.round(diffMin / 60)} h`
        : `Hace ${Math.round(diffMin / 1440)} días`
    return {
      id:       r.id,
      customer: (r.customers as any)?.full_name ?? 'Cliente anónimo',
      amount:   Number(r.total),
      time,
      status:   r.status === 'COMPLETED' ? 'Completado' : 'Pendiente',
    }
  })

  return {
    salesToday,
    salesYesterday,
    activeOrders:          activeOrders ?? 0,
    newCustomersToday:     newCustomersToday ?? 0,
    newCustomersYesterday: newCustomersYesterday ?? 0,
    totalStock:            Math.round(totalStock),
    recentSales,
    monthlySales: Object.entries(monthly).map(([m, t]) => ({ month: Number(m), total: t })),
  }
}

// ── Sales Report ───────────────────────────────────────────────
export interface SalesReportData {
  totalRevenue:    number
  totalCount:      number
  avgTicket:       number
  byPaymentMethod: { method: string; amount: number; percent: number }[]
  recentSales:     SaleRow[]
}

export async function getSalesReport(
  tenantId: string,
  branchId: string,
  from?: string,
  to?: string,
): Promise<SalesReportData> {
  let q = supabase
    .from('sales')
    .select(`
      id, order_number, total, status, currency, created_at,
      customers(full_name),
      sale_payments(method, amount)
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: false })

  if (from) q = q.gte('created_at', from)
  if (to)   q = q.lte('created_at', to)

  const { data, error } = await q
  if (error) throw error

  const rows = (data ?? []) as any[]
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total), 0)
  const totalCount   = rows.length
  const avgTicket    = totalCount > 0 ? totalRevenue / totalCount : 0

  // Agrupar por método de pago
  const methodTotals: Record<string, number> = {}
  for (const row of rows) {
    for (const p of (row.sale_payments ?? [])) {
      methodTotals[p.method] = (methodTotals[p.method] ?? 0) + Number(p.amount)
    }
  }
  const methodNames: Record<string, string> = {
    CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia',
    QR: 'QR / Código', GIFT_CARD: 'Tarjeta Regalo', MIXED: 'Mixto',
  }
  const byPaymentMethod = Object.entries(methodTotals).map(([method, amount]) => ({
    method:  methodNames[method] ?? method,
    amount,
    percent: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 1000) / 10 : 0,
  })).sort((a, b) => b.amount - a.amount)

  return {
    totalRevenue,
    totalCount,
    avgTicket,
    byPaymentMethod,
    recentSales: rows.slice(0, 20) as SaleRow[],
  }
}
