/**
 * REG-X — Supabase Database Service Layer
 * Todas las queries tipadas hacia Supabase.
 * Usa la sesión del usuario (RLS activo).
 */
import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────

export interface TenantRow {
  id: string
  name: string
  slug: string
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  business_type: string
  logo_url: string | null
  primary_color: string | null
  country: string
  currency: string
  timezone: string
}

export interface BranchRow {
  id: string
  tenant_id: string
  name: string
  code: string
  currency: string | null
  timezone: string | null
  is_main: boolean
}

export interface UserTenantRoleRow {
  user_id: string
  tenant_id: string
  branch_id: string | null
  role: string
}

export interface ProductRow {
  id: string
  tenant_id: string
  name: string
  sku: string
  price: number
  cost_price: number | null
  tax: number
  image_url: string | null
  status: string
  track_inventory: boolean
  category_id: string | null
  categories?: { name: string; color: string } | null
  inventory?: { quantity: number }[]
}

export interface CategoryRow {
  id: string
  tenant_id: string
  name: string
  color: string
  icon: string | null
  is_active: boolean
}

export interface CustomerRow {
  id: string
  tenant_id: string
  full_name: string
  email: string | null
  phone: string | null
  tax_id: string | null
  loyalty_points: number
  created_at: string
}

export interface SaleRow {
  id: string
  tenant_id: string
  branch_id: string
  order_number: string
  total: number
  subtotal: number
  tax_total: number
  status: string
  currency: string
  created_at: string
  completed_at: string | null
  customers?: { full_name: string } | null
  sale_payments?: { method: string; amount: number }[]
}

export interface InventoryRow {
  id: string
  product_id: string
  warehouse_id: string
  quantity: number
  reserved: number
  products?: {
    name: string
    sku: string
    price: number
    min_stock: number
    status: string
    categories?: { name: string; color: string } | null
  }
}

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

// ── Auth / Tenant Resolution ───────────────────────────────────

export async function resolveUserContext(userId: string) {
  // 1. User profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url, platform_role')
    .eq('id', userId)
    .single()

  // 2. Tenant role
  const { data: role } = await supabase
    .from('user_tenant_roles')
    .select('tenant_id, branch_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  // No retornar null si no hay rol de tenant: el usuario puede ser SUPER_ADMIN de plataforma
  if (!role) return { profile, role: null, tenant: null, branch: null }

  // 3. Tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, business_type, logo_url, primary_color, currency, country, timezone')
    .eq('id', role.tenant_id)
    .single()

  // 4. Branch
  const { data: branch } = role.branch_id
    ? await supabase
        .from('branches')
        .select('id, name, code, currency, timezone')
        .eq('id', role.branch_id)
        .single()
    : { data: null }

  return { profile, role, tenant, branch }
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

// ── Create Product ─────────────────────────────────────────────

export interface CreateProductPayload {
  name: string
  sku: string
  barcode?: string
  category_id?: string
  price: number
  cost_price?: number
  image_url?: string
  min_stock?: number
  initialStock?: number
  branchId?: string
}

export async function createProduct(
  tenantId: string,
  userId: string,
  payload: CreateProductPayload,
) {
  // 1. Insert product
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .insert({
      tenant_id:   tenantId,
      name:        payload.name,
      sku:         payload.sku || `SKU-${Date.now()}`,
      barcode:     payload.barcode || null,
      category_id: payload.category_id || null,
      price:       payload.price,
      cost_price:  payload.cost_price || null,
      image_url:   payload.image_url || null,
      min_stock:   payload.min_stock || 0,
      status:      'ACTIVE',
      created_by:  userId,
    })
    .select()
    .single()

  if (prodErr) throw prodErr

  // 2. If initial stock > 0 and branchId provided, find default warehouse and insert inventory row
  if (payload.initialStock && payload.initialStock > 0 && payload.branchId) {
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('branch_id', payload.branchId)
      .limit(1)
      .single()

    if (warehouse) {
      await supabase.from('inventory').insert({
        tenant_id:    tenantId,
        branch_id:    payload.branchId,
        warehouse_id: warehouse.id,
        product_id:   product.id,
        quantity:     payload.initialStock,
      })
    }
  }

  return product
}

// ── Products ───────────────────────────────────────────────────

export async function getProducts(
  tenantId: string,
  params?: { search?: string; categoryId?: string; status?: string },
): Promise<ProductRow[]> {
  let q = supabase
    .from('products')
    .select(`
      id, tenant_id, name, sku, price, cost_price, tax, image_url, status,
      track_inventory, category_id,
      categories(name, color),
      inventory(quantity)
    `)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name')

  if (params?.status) q = q.eq('status', params.status as any)
  else q = q.eq('status', 'ACTIVE')

  if (params?.categoryId) q = q.eq('category_id', params.categoryId)

  if (params?.search) {
    q = q.or(`name.ilike.%${params.search}%,sku.ilike.%${params.search}%`)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ProductRow[]
}

export async function getCategories(tenantId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, tenant_id, name, color, icon, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as unknown as CategoryRow[]
}

// ── Customers ──────────────────────────────────────────────────

export async function getCustomers(
  tenantId: string,
  params?: { search?: string; limit?: number },
): Promise<CustomerRow[]> {
  let q = supabase
    .from('customers')
    .select('id, tenant_id, full_name, email, phone, tax_id, loyalty_points, created_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('full_name')

  if (params?.search) {
    q = q.or(
      `full_name.ilike.%${params.search}%,email.ilike.%${params.search}%,phone.ilike.%${params.search}%`,
    )
  }

  if (params?.limit) q = q.limit(params.limit)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createCustomer(
  tenantId: string,
  branchId: string,
  data: { full_name: string; email?: string; phone?: string; tax_id?: string },
) {
  const { data: row, error } = await supabase
    .from('customers')
    .insert({ ...data, tenant_id: tenantId, branch_id: branchId })
    .select()
    .single()
  if (error) throw error
  return row
}

// ── Sales ──────────────────────────────────────────────────────

export async function getSales(
  tenantId: string,
  branchId: string,
  params?: { limit?: number; status?: string },
): Promise<SaleRow[]> {
  let q = supabase
    .from('sales')
    .select(`
      id, tenant_id, branch_id, order_number, total, subtotal, tax_total,
      status, currency, created_at, completed_at,
      customers(full_name),
      sale_payments(method, amount)
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })

  if (params?.status) q = q.eq('status', params.status as any)
  if (params?.limit)  q = q.limit(params.limit)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as SaleRow[]
}

// ── Create Sale (POS) ──────────────────────────────────────────

export interface CreateSalePayload {
  items: {
    product_id: string
    name: string
    sku: string
    quantity: number
    unit_price: number
    discount?: number
    discount_amount?: number
    tax?: number
    tax_amount?: number
    total: number
  }[]
  payments: { method: string; amount: number; reference?: string }[]
  customer_id?: string
  notes?: string
  subtotal: number
  tax_total: number
  discount_total: number
  total: number
  currency: string
}

export async function createSale(
  tenantId: string,
  branchId: string,
  userId: string,
  payload: CreateSalePayload,
) {
  // Generate order number
  const ts = Date.now().toString(36).toUpperCase()
  const orderNumber = `ORD-${ts}`

  // Insert sale
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      tenant_id:      tenantId,
      branch_id:      branchId,
      order_number:   orderNumber,
      customer_id:    payload.customer_id ?? null,
      subtotal:       payload.subtotal,
      tax_total:      payload.tax_total,
      discount_total: payload.discount_total,
      total:          payload.total,
      currency:       payload.currency,
      status:         'COMPLETED',
      completed_at:   new Date().toISOString(),
      notes:          payload.notes ?? null,
      created_by:     userId,
      completed_by:   userId,
    })
    .select()
    .single()

  if (saleErr) throw saleErr

  // Insert items
  const { error: itemsErr } = await supabase.from('sale_items').insert(
    payload.items.map((item) => ({
      sale_id:         sale.id,
      product_id:      item.product_id,
      sku:             item.sku,
      name:            item.name,
      quantity:        item.quantity,
      unit_price:      item.unit_price,
      discount:        item.discount ?? 0,
      discount_amount: item.discount_amount ?? 0,
      tax:             item.tax ?? 0,
      tax_amount:      item.tax_amount ?? 0,
      total:           item.total,
    })),
  )
  if (itemsErr) throw itemsErr

  // Insert payments
  const { error: payErr } = await supabase.from('sale_payments').insert(
    payload.payments.map((p) => ({
      sale_id:   sale.id,
      method:    p.method as any,
      amount:    p.amount,
      reference: p.reference ?? null,
    })),
  )
  if (payErr) throw payErr

  return sale
}

// ── Inventory ──────────────────────────────────────────────────

export async function getInventory(
  tenantId: string,
  branchId: string,
): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      id, product_id, warehouse_id, quantity, reserved,
      products(name, sku, price, min_stock, status, categories(name, color))
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('quantity', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as InventoryRow[]
}

// ── Tables (restaurant) ────────────────────────────────────────

export interface TableRow {
  id: string
  number: string
  name: string | null
  capacity: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
  area_id: string | null
  dining_areas?: { name: string } | null
}

export async function getTables(tenantId: string, branchId: string): Promise<TableRow[]> {
  const { data, error } = await supabase
    .from('tables')
    .select('id, number, name, capacity, status, area_id, dining_areas(name)')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('number')
  if (error) throw error
  return (data ?? []) as unknown as TableRow[]
}

export async function updateTableStatus(tableId: string, status: TableRow['status']) {
  const { error } = await supabase
    .from('tables')
    .update({ status })
    .eq('id', tableId)
  if (error) throw error
}

// ── Orders / KDS ───────────────────────────────────────────────

export interface OrderRow {
  id: string
  order_number: string
  status: string
  notes: string | null
  created_at: string
  tables?: { number: string; name: string | null } | null
  order_items?: {
    id: string
    quantity: number
    status: string
    destination: string
    products?: { name: string } | null
  }[]
}

export async function getOrders(
  tenantId: string,
  branchId: string,
  status?: string,
): Promise<OrderRow[]> {
  let q = supabase
    .from('orders')
    .select(`
      id, order_number, status, notes, created_at,
      tables(number, name),
      order_items(id, quantity, status, destination, products(name))
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: true })

  if (status) q = q.eq('status', status as any)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as OrderRow[]
}

export async function updateOrderItemStatus(itemId: string, status: string) {
  const { error } = await supabase
    .from('order_items')
    .update({ status: status as any, ...(status === 'READY' ? { ready_at: new Date().toISOString() } : {}) })
    .eq('id', itemId)
  if (error) throw error
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

// -- Platform-level queries (SUPER_ADMIN only) ----------------

export interface PlatformStats {
  totalTenants: number
  activeTenants: number
  activeSubscriptions: number
  mrr: number
  totalUsers: number
  newThisMonth: number
  planBreakdown: { plan: string; count: number }[]
}

export interface PlatformTenantRow {
  id: string
  name: string
  slug: string
  plan: string
  business_type: string
  is_active: boolean
  country: string
  created_at: string
  subscriptions: { status: string; plan: string; price: number; currency: string; current_period_end: string | null }[]
}

export interface PlatformUserRow {
  id: string
  full_name: string | null
  platform_role: string | null
  created_at: string
  user_tenant_roles: { role: string; is_active: boolean; tenants: { name: string } | null }[]
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ data: tenants }, { data: subs }, { data: users }] = await Promise.all([
    supabase.from('tenants').select('id, plan, is_active, created_at'),
    supabase.from('subscriptions').select('id, status, plan, price, currency'),
    supabase.from('user_profiles').select('id'),
  ])

  const tList = tenants ?? []
  const sList = subs ?? []

  const planBreakdownMap: Record<string, number> = {}
  for (const t of tList) {
    planBreakdownMap[t.plan] = (planBreakdownMap[t.plan] ?? 0) + 1
  }

  return {
    totalTenants:        tList.length,
    activeTenants:       tList.filter((t) => t.is_active).length,
    activeSubscriptions: sList.filter((s) => s.status === 'ACTIVE').length,
    mrr:                 sList.filter((s) => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.price ?? 0), 0),
    totalUsers:          (users ?? []).length,
    newThisMonth:        tList.filter((t) => t.created_at >= monthStart).length,
    planBreakdown:       Object.entries(planBreakdownMap).map(([plan, count]) => ({ plan, count })),
  }
}

export async function getAllTenants(): Promise<PlatformTenantRow[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, business_type, is_active, country, created_at, subscriptions (status, plan, price, currency, current_period_end)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PlatformTenantRow[]
}

export async function getAllPlatformUsers(): Promise<PlatformUserRow[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, platform_role, created_at, user_tenant_roles (role, is_active, tenants (name))')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as PlatformUserRow[]
}

// -- Platform mutations (SUPER_ADMIN only, via RPC) ------------

export interface CreateTenantInput {
  name:           string
  slug:           string
  business_type:  string
  plan:           'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  country:        string
  currency:       string
  owner_email:    string
  owner_name:     string
  owner_password: string
  timezone?:      string
  locale?:        string
}

export interface CreateTenantResult {
  tenant_id:   string
  branch_id:   string
  owner_id:    string
  owner_email: string
}

/** Crea un tenant + su sucursal/bodega/suscripcion + roles de negocio + usuario OWNER. */
export async function createTenantWithOwner(
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  const { data, error } = await (supabase.rpc as any)('create_tenant_with_owner', {
    p_name:           input.name,
    p_slug:           input.slug,
    p_business_type:  input.business_type,
    p_plan:           input.plan,
    p_country:        input.country,
    p_currency:       input.currency,
    p_owner_email:    input.owner_email,
    p_owner_name:     input.owner_name,
    p_owner_password: input.owner_password,
    p_timezone:       input.timezone ?? 'America/Bogota',
    p_locale:         input.locale ?? 'es-CO',
  })
  if (error) throw error
  return data as CreateTenantResult
}

/** Cambia el plan de un tenant (sincroniza la suscripcion). */
export async function setTenantPlan(
  tenantId: string,
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE',
): Promise<void> {
  const { error } = await (supabase.rpc as any)('set_tenant_plan', {
    p_tenant_id: tenantId,
    p_plan: plan,
  })
  if (error) throw error
}

/** Activa o desactiva un tenant (y su suscripcion). */
export async function setTenantActive(tenantId: string, active: boolean): Promise<void> {
  const { error } = await (supabase.rpc as any)('set_tenant_active', {
    p_tenant_id: tenantId,
    p_active: active,
  })
  if (error) throw error
}
