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
  barcode?: string | null
  price: number
  cost_price: number | null
  tax: number
  image_url: string | null
  status: string
  track_inventory: boolean
  category_id: string | null
  min_stock?: number
  categories?: { name: string; color: string } | null
  inventory?: { quantity: number; warehouse_id: string }[]
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
  id:            string
  tenant_id:     string
  person_type:   'NATURAL' | 'EMPRESA'
  doc_type:      string
  regime:        'SIMPLIFICADO' | 'COMUN'
  full_name:     string
  business_name: string | null
  email:         string | null
  phone:         string | null
  tax_id:        string | null
  address:       { city?: string; department?: string; street?: string } | null
  loyalty_points: number
  created_at:    string
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
    .select('id, name, slug, plan, business_type, logo_url, primary_color, secondary_color, currency, country, timezone')
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
  imageFile?: File | null      // archivo real para subir a Storage
  image_url?: string           // URL ya resuelta (edición)
  min_stock?: number
  initialStock?: number
  branchId?: string
}

async function uploadProductImage(tenantId: string, file: File): Promise<string | null> {
  try {
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${tenantId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('products')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) return null
    const { data } = supabase.storage.from('products').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('tenant_id', tenantId)
  if (error) throw error
}

export async function getProduct(
  tenantId: string,
  productId: string,
): Promise<ProductRow | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, tenant_id, name, sku, barcode, price, cost_price, tax, image_url,
      status, track_inventory, category_id, min_stock,
      categories(name, color),
      inventory(quantity, warehouse_id)
    `)
    .eq('tenant_id', tenantId)
    .eq('id', productId)
    .is('deleted_at', null)
    .single()
  if (error) return null
  return data as unknown as ProductRow
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  payload: CreateProductPayload,
) {
  // 1. Subir nueva imagen si se seleccionó una
  let imageUrl: string | null = payload.image_url ?? null
  if (payload.imageFile) {
    imageUrl = await uploadProductImage(tenantId, payload.imageFile)
  }

  // 2. Actualizar producto
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .update({
      name:        payload.name,
      sku:         payload.sku || undefined,
      barcode:     payload.barcode || null,
      category_id: payload.category_id || null,
      price:       payload.price,
      cost_price:  payload.cost_price || null,
      image_url:   imageUrl,
      min_stock:   payload.min_stock || 0,
    })
    .eq('id', productId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (prodErr) throw prodErr

  // 3. Upsert inventario si se indicó stock y sucursal
  if (payload.initialStock !== undefined && payload.branchId) {
    let { data: warehouse, error: whErr } = await supabase
      .from('warehouses')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('branch_id', payload.branchId)
      .limit(1)
      .single()

    // Auto-create warehouse if none exists
    if (!warehouse || whErr) {
      const { data: newWh, error: newWhErr } = await supabase
        .from('warehouses')
        .insert({
          tenant_id:  tenantId,
          branch_id:  payload.branchId,
          name:       'Bodega Principal',
          code:       'MAIN',
          is_default: true,
          is_active:  true,
        })
        .select('id')
        .single()

      if (newWhErr) {
        console.error('[updateProduct] Error creating warehouse:', newWhErr)
      } else {
        warehouse = newWh
      }
    }

    if (warehouse) {
      // Check if inventory row already exists
      const { data: existing } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('warehouse_id', warehouse.id)
        .eq('product_id', productId)
        .is('variant_id', null)
        .limit(1)
        .single()

      const prevQty = Number(existing?.quantity ?? 0)
      const newQty  = payload.initialStock!

      if (existing) {
        const { error: updErr } = await supabase
          .from('inventory')
          .update({ quantity: newQty })
          .eq('id', existing.id)
        if (updErr) console.error('[updateProduct] Error updating inventory:', updErr)
      } else {
        const { error: insErr } = await supabase
          .from('inventory')
          .insert({
            tenant_id:    tenantId,
            branch_id:    payload.branchId,
            warehouse_id: warehouse.id,
            product_id:   productId,
            quantity:     newQty,
          })
        if (insErr) console.error('[updateProduct] Error inserting inventory:', insErr)
      }

      // Registrar movimiento de stock si cambió
      const delta = newQty - prevQty
      if (delta !== 0) {
        const { error: mvErr } = await supabase.from('stock_movements').insert({
          tenant_id:      tenantId,
          branch_id:      payload.branchId,
          warehouse_id:   warehouse.id,
          product_id:     productId,
          type:           'ADJUSTMENT',
          quantity:       Math.abs(delta),
          unit_cost:      payload.cost_price ?? null,
          reference_type: 'MANUAL_ADJUSTMENT',
          notes:          delta > 0
            ? `Ajuste manual: +${delta} unidades`
            : `Ajuste manual: ${delta} unidades`,
        })
        if (mvErr) console.error('[updateProduct] Error inserting stock_movement:', mvErr)
      }
    }
  }

  return product
}

export async function createProduct(
  tenantId: string,
  userId: string,
  payload: CreateProductPayload,
) {
  // 1. Subir imagen si viene como File
  let imageUrl: string | null = payload.image_url ?? null
  if (payload.imageFile) {
    imageUrl = await uploadProductImage(tenantId, payload.imageFile)
  }

  // 2. Insert product
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
      image_url:   imageUrl,
      min_stock:   payload.min_stock || 0,
      status:      'ACTIVE',
      created_by:  userId,
    })
    .select()
    .single()

  if (prodErr) throw prodErr

  // 3. If initial stock > 0 and branchId provided, find/create warehouse and insert inventory
  if (payload.initialStock && payload.initialStock > 0 && payload.branchId) {
    let { data: warehouse, error: whErr } = await supabase
      .from('warehouses')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('branch_id', payload.branchId)
      .limit(1)
      .single()

    // Auto-create warehouse if none exists
    if (!warehouse || whErr) {
      const { data: newWh, error: newWhErr } = await supabase
        .from('warehouses')
        .insert({
          tenant_id:  tenantId,
          branch_id:  payload.branchId,
          name:       'Bodega Principal',
          code:       'MAIN',
          is_default: true,
          is_active:  true,
        })
        .select('id')
        .single()

      if (newWhErr) {
        console.error('[createProduct] Error creating warehouse:', newWhErr)
      } else {
        warehouse = newWh
      }
    }

    if (warehouse) {
      const { error: invErr } = await supabase.from('inventory').insert({
        tenant_id:    tenantId,
        branch_id:    payload.branchId,
        warehouse_id: warehouse.id,
        product_id:   product.id,
        quantity:     payload.initialStock,
      })
      if (invErr) console.error('[createProduct] Error inserting inventory:', invErr)

      // 4. Registrar movimiento de stock inicial
      const { error: mvErr } = await supabase.from('stock_movements').insert({
        tenant_id:      tenantId,
        branch_id:      payload.branchId,
        warehouse_id:   warehouse.id,
        product_id:     product.id,
        type:           'IN',
        quantity:       payload.initialStock,
        unit_cost:      payload.cost_price ?? null,
        reference_type: 'INITIAL_STOCK',
        notes:          'Stock inicial al crear producto',
        created_by:     userId,
      })
      if (mvErr) console.error('[createProduct] Error inserting stock_movement:', mvErr)
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

export async function createCategory(tenantId: string, name: string, color: string): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ tenant_id: tenantId, name: name.trim(), color, is_active: true })
    .select('id, tenant_id, name, color, icon, is_active')
    .single()
  if (error) throw error
  return data as unknown as CategoryRow
}

export async function updateCategory(tenantId: string, categoryId: string, name: string, color: string): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: name.trim(), color })
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)
    .select('id, tenant_id, name, color, icon, is_active')
    .single()
  if (error) throw error
  return data as unknown as CategoryRow
}

export async function deleteCategory(tenantId: string, categoryId: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)
  if (error) throw error
}

// ── Customers ──────────────────────────────────────────────────

const CUSTOMER_SELECT = 'id, tenant_id, person_type, doc_type, regime, full_name, business_name, email, phone, tax_id, address, loyalty_points, created_at'

export async function getCustomers(
  tenantId: string,
  params?: { search?: string; limit?: number },
): Promise<CustomerRow[]> {
  let q = supabase
    .from('customers')
    .select(CUSTOMER_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('full_name')

  if (params?.search) {
    q = q.or(
      `full_name.ilike.%${params.search}%,business_name.ilike.%${params.search}%,email.ilike.%${params.search}%,phone.ilike.%${params.search}%,tax_id.ilike.%${params.search}%`,
    )
  }

  if (params?.limit) q = q.limit(params.limit)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CustomerRow[]
}

export interface CustomerInput {
  person_type:   'NATURAL' | 'EMPRESA'
  doc_type:      string
  regime:        'SIMPLIFICADO' | 'COMUN'
  full_name:     string
  business_name?: string | null
  email?:        string | null
  phone?:        string | null
  tax_id?:       string | null
  address?:      { city?: string; department?: string; street?: string } | null
}

export async function createCustomer(
  tenantId: string,
  branchId: string,
  data: CustomerInput,
) {
  const { data: row, error } = await supabase
    .from('customers')
    .insert({ ...data, tenant_id: tenantId, branch_id: branchId })
    .select(CUSTOMER_SELECT)
    .single()
  if (error) throw error
  return row
}

export async function getCustomerById(customerId: string): Promise<CustomerRow | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_SELECT)
    .eq('id', customerId)
    .single()
  if (error) return null
  return data as CustomerRow
}

export async function updateCustomer(
  customerId: string,
  data: CustomerInput,
) {
  const { data: row, error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', customerId)
    .select(CUSTOMER_SELECT)
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
  status?: 'COMPLETED' | 'PENDING'     // default COMPLETED
  cash_register_id?: string            // vincula la venta a la caja activa
}

export async function createSale(
  tenantId: string,
  branchId: string,
  userId: string,
  payload: CreateSalePayload,
) {
  // Generate order number (se envía al RPC para mantener el mismo formato)
  const ts = Date.now().toString(36).toUpperCase()
  const orderNumber = `ORD-${ts}`
  const saleStatus = payload.status ?? 'COMPLETED'

  // Venta atómica vía RPC: venta + ítems + pagos + descuento de stock en
  // UNA sola transacción de Postgres. Valida el tenant y frena stock negativo.
  // Ver database/migrations/021_hardened_create_sale.sql
  const { data: saleId, error: rpcErr } = await supabase.rpc('create_sale_transaction', {
    p_sale: {
      tenant_id:        tenantId,
      branch_id:        branchId,
      order_number:     orderNumber,
      customer_id:      payload.customer_id ?? null,
      subtotal:         payload.subtotal,
      tax_total:        payload.tax_total,
      discount_total:   payload.discount_total,
      total:            payload.total,
      currency:         payload.currency,
      status:           saleStatus,
      notes:            payload.notes ?? null,
      created_by:       userId,
      cash_register_id: payload.cash_register_id ?? null,
    },
    p_items: payload.items.map((item) => ({
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
    p_payments: payload.payments.map((p) => ({
      method:    p.method,
      amount:    p.amount,
      reference: p.reference ?? null,
    })),
  } as any)

  if (rpcErr) throw rpcErr

  // Devolver la fila completa (los llamadores usan sale.order_number, sale.id, etc.)
  const { data: sale, error: fetchErr } = await supabase
    .from('sales')
    .select()
    .eq('id', saleId as unknown as string)
    .single()

  if (fetchErr) throw fetchErr
  return sale
}

// ── Pending comandas (todas las cajas del branch) ─────────────

export async function getPendingSales(
  tenantId: string,
  branchId: string,
): Promise<SaleHistoryRow[]> {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id, order_number, status, total, subtotal, tax_total, discount_total,
      currency, created_at, notes, cash_register_id,
      customers(full_name),
      sale_payments(method, amount),
      sale_items(name, quantity, unit_price, total, discount_amount, tax, tax_amount)
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as unknown as SaleHistoryRow[]
}

// ── Completar una comanda existente (cobrarla) ────────────────

export async function completeSale(
  saleId: string,
  userId: string,
  payments: { method: string; amount: number; reference?: string }[],
): Promise<void> {
  // Marcar como COMPLETED — usamos .select() para detectar si RLS bloqueó el update
  const { data: updated, error: updErr } = await supabase
    .from('sales')
    .update({
      status:       'COMPLETED',
      completed_at: new Date().toISOString(),
      completed_by: userId,
    })
    .eq('id', saleId)
    .select('id')
  if (updErr) throw updErr
  if (!updated || updated.length === 0) {
    throw new Error('No se pudo completar la venta. Verifica los permisos en Supabase.')
  }

  // Insertar pagos
  if (payments.length > 0) {
    const { error: payErr } = await supabase
      .from('sale_payments')
      .insert(payments.map(p => ({
        sale_id:   saleId,
        method:    p.method as any,
        amount:    p.amount,
        reference: p.reference ?? null,
      })))
    if (payErr) throw payErr
  }
}

// ── Stock Movements ────────────────────────────────────────────

export interface StockMovementRow {
  id: string
  type: string
  quantity: number
  unit_cost: number | null
  reference_type: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  products?: { name: string; sku: string; image_url?: string | null } | null
}

export async function getStockMovements(
  tenantId: string,
  branchId: string,
  params?: {
    type?: string
    since?: string
    limit?: number
  },
): Promise<StockMovementRow[]> {
  const buildQuery = (filterBranch: boolean) => {
    let q = supabase
      .from('stock_movements')
      .select(`
        id, type, quantity, unit_cost, reference_type, notes, created_at, created_by,
        products(name, sku, image_url)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(params?.limit ?? 200)

    if (filterBranch) q = q.eq('branch_id', branchId)
    if (params?.type && params.type !== 'ALL') q = q.eq('type', params.type)
    if (params?.since) q = q.gte('created_at', params.since)
    return q
  }

  // Primero intenta con branch_id
  const { data, error } = await buildQuery(true)
  if (error) throw error

  // Si no hay resultados, devuelve todos los del tenant (por si no tienen branch_id asignado)
  if ((data ?? []).length === 0) {
    const { data: fallback, error: fallbackErr } = await buildQuery(false)
    if (fallbackErr) throw fallbackErr
    return (fallback ?? []) as unknown as StockMovementRow[]
  }

  return (data ?? []) as unknown as StockMovementRow[]
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
      products(name, sku, price, cost_price, min_stock, status, image_url, category_id, deleted_at, categories(name, color))
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('quantity', { ascending: true })

  if (error) throw error
  // Excluir filas cuyo producto fue eliminado (soft-delete o RLS lo oculta → products=null)
  const active = (data ?? []).filter((row: any) => row.products != null && row.products.deleted_at == null)
  return active as unknown as InventoryRow[]
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

export async function createTable(
  tenantId: string,
  branchId: string,
  data: { number: string; name?: string | null; capacity: number; status?: TableRow['status'] },
): Promise<TableRow> {
  const { data: row, error } = await supabase
    .from('tables')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      number:    data.number,
      name:      data.name ?? null,
      capacity:  data.capacity,
      status:    data.status ?? 'AVAILABLE',
      is_active: true,
    })
    .select('id, number, name, capacity, status, area_id')
    .single()
  if (error) throw error
  return row as unknown as TableRow
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

// ── Restaurant Orders ──────────────────────────────────────────
// Nota: funciona con el esquema actual. Después de correr
// MIGRATION_restaurant_orders.sql los campos denormalizados
// (name, sku, unit_price en order_items; waiter_name en orders)
// estarán disponibles — el código ya los soporta vía `as any`.

export interface RestaurantOrderItemInput {
  product_id:   string
  name:         string
  sku:          string
  quantity:     number
  unit_price:   number
  notes?:       string | null
  destination?: 'KITCHEN' | 'BAR'
}

export interface RestaurantOrderItemRow {
  id:          string
  product_id:  string
  quantity:    number
  status:      string
  destination: string
  notes:       string | null
  created_at:  string
  // Estos campos existen después de la migración (o vienen del join de productos)
  name?:       string | null
  sku?:        string | null
  unit_price?: number | null
  // Trazabilidad: quién agregó este ítem (migración 023)
  added_by?:      string | null
  added_by_name?: string | null
  products?:   { name: string; sku: string; price: number } | null
}

export interface RestaurantOrderRow {
  id:           string
  order_number: string
  status:       string
  notes:        string | null
  created_at:   string
  table_id:     string | null
  waiter_id:    string | null
  waiter_name?: string | null
  tables?:      { number: string; name: string | null } | null
  order_items?: RestaurantOrderItemRow[]
}

export async function createRestaurantOrder(
  tenantId:   string,
  branchId:   string,
  tableId:    string,
  waiterId:   string,
  waiterName: string,
  items:      RestaurantOrderItemInput[],
): Promise<RestaurantOrderRow> {
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`

  // waiter_id y waiter_name son nuevos — insertar como any
  const { data: order, error: orderErr } = await (supabase
    .from('orders')
    .insert({
      tenant_id:    tenantId,
      branch_id:    branchId,
      table_id:     tableId,
      waiter_id:    waiterId,
      order_number: orderNumber,
      status:       'PENDING',
      notes:        null,
    } as any)
    .select('id, order_number, status, notes, created_at, table_id, waiter_id')
    .single()) as any

  if (orderErr) throw orderErr

  // Intentar guardar también waiter_name si la columna existe (post-migración)
  try {
    await (supabase.from('orders').update({ waiter_name: waiterName } as any).eq('id', order.id)) as any
  } catch { /* columna no existe aún — ignorar */ }

  // Insertar ítems — unit_price es NOT NULL en el esquema original.
  // added_by / added_by_name registran quién agregó cada ítem (migración 023).
  const { error: itemsErr } = await supabase.from('order_items').insert(
    items.map(item => ({
      order_id:      order.id,
      product_id:    item.product_id,
      quantity:      item.quantity,
      unit_price:    item.unit_price,
      status:        'PENDING' as any,
      destination:   item.destination ?? 'KITCHEN',
      notes:         item.notes ?? null,
      added_by:      waiterId,
      added_by_name: waiterName,
    } as any)),
  )
  if (itemsErr) throw itemsErr

  // Guardar campos denormalizados si la migración ya fue aplicada (name, sku)
  try {
    for (const item of items) {
      await (supabase.from('order_items').update({
        name: item.name, sku: item.sku,
      } as any).eq('order_id', order.id).eq('product_id', item.product_id)) as any
    }
  } catch { /* ignorar si las columnas name/sku no existen aún */ }

  // Marcar mesa como OCUPADA
  const { error: tableErr } = await supabase
    .from('tables')
    .update({ status: 'OCCUPIED' as any })
    .eq('id', tableId)
  if (tableErr) console.error('[createRestaurantOrder] tables.update error:', tableErr)

  return order as RestaurantOrderRow
}


export async function getActiveOrderForTable(
  tenantId: string,
  tableId:  string,
): Promise<RestaurantOrderRow | null> {
  // Status válidos del enum actual: PENDING | PREPARING | READY | SERVED | CANCELLED
  // Usamos SERVED como estado "cerrado" (orden cobrada/finalizada)
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, notes, created_at, table_id, waiter_id,
      tables(number, name),
      order_items(id, product_id, quantity, unit_price, status, destination, notes, created_at,
        added_by, added_by_name,
        products(name, sku, price))
    `)
    .eq('tenant_id', tenantId)
    .eq('table_id', tableId)
    .not('status', 'in', '(SERVED,CANCELLED)')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as unknown as RestaurantOrderRow | null
}

export async function getActiveTableOrders(
  tenantId: string,
  branchId: string,
): Promise<RestaurantOrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, notes, created_at, table_id,
      tables(number, name),
      order_items(id, product_id, quantity, unit_price, status, destination,
        added_by_name,
        products(name, sku, price))
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .not('status', 'in', '(SERVED,CANCELLED)')
    .not('table_id', 'is', null)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as RestaurantOrderRow[]
}

export async function addItemsToOrder(
  orderId:     string,
  items:       RestaurantOrderItemInput[],
  addedById?:  string,
  addedByName?: string,
): Promise<void> {
  // added_by / added_by_name registran quién agregó cada ítem (migración 023).
  const { error } = await supabase.from('order_items').insert(
    items.map(item => ({
      order_id:      orderId,
      product_id:    item.product_id,
      quantity:      item.quantity,
      unit_price:    item.unit_price,
      status:        'PENDING' as any,
      destination:   item.destination ?? 'KITCHEN',
      notes:         item.notes ?? null,
      added_by:      addedById ?? null,
      added_by_name: addedByName ?? null,
    } as any)),
  )
  if (error) throw error

  // Guardar campos denormalizados si la migración ya fue aplicada (name, sku)
  try {
    for (const item of items) {
      await (supabase.from('order_items').update({
        name: item.name, sku: item.sku,
      } as any).eq('order_id', orderId).eq('product_id', item.product_id)) as any
    }
  } catch { /* ignorar si las columnas name/sku no existen aún */ }
}

// Órdenes activas para la pantalla KDS (incluye notas por ítem)
export async function getKDSOrders(
  tenantId: string,
  branchId: string,
): Promise<RestaurantOrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, notes, created_at, table_id,
      tables(number, name),
      order_items(id, product_id, quantity, unit_price, status, destination, notes, created_at,
        products(name, sku, price))
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .in('status', ['PENDING', 'PREPARING'] as any[])
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as RestaurantOrderRow[]
}

// Actualizar estado de una orden (PENDING → PREPARING → READY → SERVED)
export async function updateRestaurantOrderStatus(
  orderId: string,
  status:  'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED',
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status: status as any })
    .eq('id', orderId)
  if (error) throw error
}

export async function closeRestaurantOrder(
  orderId: string,
  tableId: string,
): Promise<void> {
  // Usamos SERVED (estado terminal válido en el enum actual) como "cerrado"
  const { error: orderErr } = await supabase
    .from('orders')
    .update({ status: 'SERVED' as any })
    .eq('id', orderId)
  if (orderErr) throw orderErr

  const { error: tableErr } = await supabase
    .from('tables')
    .update({ status: 'AVAILABLE' })
    .eq('id', tableId)
  if (tableErr) throw tableErr
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

// ── Employees ──────────────────────────────────────────────────

export type BusinessRole =
  | 'CASHIER'
  | 'WAITER'
  | 'CHEF'
  | 'BARTENDER'
  | 'ACCOUNTANT'
  | 'INVENTORY_MANAGER'
  | 'CUSTOM'

export const ROLE_CONFIG: Record<BusinessRole, { label: string; color: string; description: string }> = {
  CASHIER:           { label: 'Cajero',               color: 'bg-blue-500/10 text-blue-500',     description: 'Maneja ventas y POS' },
  WAITER:            { label: 'Mesero',               color: 'bg-teal-500/10 text-teal-500',     description: 'Atiende mesas y órdenes' },
  CHEF:              { label: 'Chef / Cocinero',      color: 'bg-orange-500/10 text-orange-500', description: 'Gestiona cocina y producción' },
  BARTENDER:         { label: 'Bartender',            color: 'bg-purple-500/10 text-purple-500', description: 'Maneja la barra' },
  ACCOUNTANT:        { label: 'Contador',             color: 'bg-yellow-500/10 text-yellow-500', description: 'Acceso a reportes y finanzas' },
  INVENTORY_MANAGER: { label: 'Gestor de Inventario', color: 'bg-emerald-500/10 text-emerald-500', description: 'Controla stock y movimientos' },
  CUSTOM:            { label: 'Personalizado',        color: 'bg-grafito-200 text-grafito-600',  description: 'Rol definido manualmente' },
}

export interface EmployeeRow {
  userId:     string
  role:       string
  isActive:   boolean
  branchId:   string | null
  fullName:   string | null
  avatarUrl:  string | null
  email:      string | null
  phone:      string | null
  cedula:     string | null
  customRole: string | null
  createdAt:  string
}

export async function getEmployees(tenantId: string): Promise<EmployeeRow[]> {
  // Query roles
  const { data: roles, error: rolesErr } = await supabase
    .from('user_tenant_roles')
    .select('user_id, role, is_active, branch_id, created_at')
    .eq('tenant_id', tenantId)
    .not('role', 'in', '(OWNER,ADMIN)')
    .order('created_at', { ascending: false })

  if (rolesErr) throw rolesErr
  if (!roles || roles.length === 0) return []

  // Query profiles separately (no FK between user_tenant_roles and user_profiles)
  const userIds = [...new Set(roles.map(r => r.user_id))]
  const { data: profiles, error: profErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url, phone, cedula')
    .in('id', userIds)

  if (profErr) throw profErr

  // Fetch emails via RPC (email lives in auth.users, not accessible via RLS)
  const { data: emailRows, error: emailErr } = await (supabase.rpc as any)('get_employee_emails', {
    p_tenant_id: tenantId,
  })
  if (emailErr) console.error('[getEmployees] get_employee_emails RPC error:', emailErr)
  const emailMap = new Map<string, string>(
    ((emailRows ?? []) as Array<{ user_id: string; email: string }>)
      .map(e => [e.user_id, e.email])
  )

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  console.log('[getEmployees] profiles raw:', profiles)
  console.log('[getEmployees] emailRows raw:', emailRows)

  return roles.map(r => {
    const p = profileMap.get(r.user_id)
    const result = {
      userId:    r.user_id,
      role:      r.role,
      isActive:  r.is_active,
      branchId:  r.branch_id,
      fullName:  p?.full_name  ?? null,
      avatarUrl: p?.avatar_url ?? null,
      email:      emailMap.get(r.user_id) ?? null,
      phone:      p?.phone       ?? null,
      cedula:     p?.cedula      ?? null,
      customRole: null,
      createdAt:  r.created_at,
    }
    console.log('[getEmployees] mapped employee:', result)
    return result
  })
}

export async function updateEmployeeRole(
  tenantId: string,
  userId: string,
  role: BusinessRole,
): Promise<void> {
  const { error } = await supabase
    .from('user_tenant_roles')
    .update({ role })
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function addEmployee(input: {
  email:      string
  fullName:   string
  password:   string
  role:       BusinessRole
  tenantId:   string
  branchId?:  string | null
  phone?:     string | null
  cedula?:    string | null
  customRole?: string | null
}): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('add_employee_to_tenant', {
    p_email:       input.email,
    p_full_name:   input.fullName,
    p_password:    input.password,
    p_role:        input.role === 'CUSTOM' ? 'CASHIER' : input.role,
    p_tenant_id:   input.tenantId,
    p_branch_id:   input.branchId   ?? null,
    p_phone:       input.phone      ?? null,
    p_cedula:      input.cedula     ?? null,
    // p_custom_role: activar tras ejecutar FIX_employee_rpcs.sql
  })
  if (error) throw error
  return data as string
}

export async function updateEmployeeProfile(input: {
  userId:      string
  fullName:    string
  tenantId:    string
  email?:      string
  phone?:      string | null
  cedula?:     string | null
  role?:       BusinessRole
  branchId?:   string | null
  password?:   string
  customRole?: string | null
}): Promise<void> {
  const { error } = await (supabase.rpc as any)('update_employee_profile', {
    p_user_id:     input.userId,
    p_full_name:   input.fullName,
    p_tenant_id:   input.tenantId,
    p_email:       input.email      ?? null,
    p_phone:       input.phone      ?? null,
    p_cedula:      input.cedula     ?? null,
    p_role:        (input.role === 'CUSTOM' ? null : input.role) ?? null,
    p_branch_id:   input.branchId   ?? null,
    p_password:    input.password   ?? null,
    // p_custom_role: activar tras ejecutar FIX_employee_rpcs.sql
  })
  if (error) throw error
}

export async function toggleEmployeeActive(
  tenantId: string,
  userId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('user_tenant_roles')
    .update({ is_active: isActive })
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteEmployee(input: {
  userId:   string
  tenantId: string
}): Promise<void> {
  const { error } = await (supabase.rpc as any)('delete_employee_from_tenant', {
    p_user_id:   input.userId,
    p_tenant_id: input.tenantId,
  })
  if (error) throw error
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
  logo_url: string | null
  primary_color: string
  secondary_color: string
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

  const [{ data: tenants, error: errT }, { data: subs, error: errS }, { data: users, error: errU }] = await Promise.all([
    supabase.from('tenants').select('id, plan, is_active, created_at'),
    supabase.from('subscriptions').select('id, status, plan, price, currency'),
    supabase.from('user_profiles').select('id'),
  ])

  if (errT) console.error("Error fetching tenants for stats:", errT)
  if (errS) console.error("Error fetching subs for stats:", errS)
  if (errU) console.error("Error fetching users for stats:", errU)

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
    .select('id, name, slug, plan, business_type, is_active, country, created_at, logo_url, primary_color, secondary_color, subscriptions (status, plan, price, currency, current_period_end)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error("SUPABASE ERROR IN getAllTenants:", error)
    throw error
  }
  return (data ?? []) as PlatformTenantRow[]
}

export async function getAllPlatformUsers(): Promise<PlatformUserRow[]> {
  // user_profiles y user_tenant_roles no tienen FK directa entre sí (ambas
  // referencian auth.users), por eso no se puede embeber una en la otra.
  // Se consultan por separado y se unen en memoria.
  const [profilesRes, rolesRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, full_name, platform_role, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_tenant_roles')
      .select('user_id, role, is_active, tenants (name)'),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (rolesRes.error) throw rolesRes.error

  const rolesByUser = new Map<string, any[]>()
  for (const r of (rolesRes.data ?? []) as any[]) {
    const arr = rolesByUser.get(r.user_id) ?? []
    arr.push({ role: r.role, is_active: r.is_active, tenants: r.tenants })
    rolesByUser.set(r.user_id, arr)
  }

  return ((profilesRes.data ?? []) as any[]).map((p) => ({
    id:            p.id,
    full_name:     p.full_name,
    platform_role: p.platform_role,
    created_at:    p.created_at,
    user_tenant_roles: rolesByUser.get(p.id) ?? [],
  })) as unknown as PlatformUserRow[]
}

// -- Platform mutations (SUPER_ADMIN only, via RPC) ------------

export interface CreateTenantInput {
  name:           string
  slug:           string
  business_type:  string
  plan:           string
  country:        string
  currency:       string
  owner_email:    string
  owner_name:     string
  owner_password: string
  timezone?:      string
  locale?:        string
  logo_url?:       string
  primary_color?:  string
  secondary_color?: string
}

export interface UpdateTenantInput {
  name?:            string
  slug?:            string
  business_type?:   string
  logo_url?:        string
  primary_color?:   string
  secondary_color?: string
  country?:         string
  currency?:        string
}

export interface CreateTenantResult {
  tenant_id:   string
  branch_id:   string
  owner_id:    string
  owner_email: string
}

/** Sube el logo del tenant a Supabase Storage y retorna la URL pública */
export async function uploadTenantLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
  
  const { data, error } = await supabase.storage
    .from('tenant-assets')
    .upload(`logos/${fileName}`, file, { cacheControl: '3600', upsert: false })

  if (error) throw error

  const { data: publicUrlData } = supabase.storage
    .from('tenant-assets')
    .getPublicUrl(`logos/${fileName}`)

  return publicUrlData.publicUrl
}

/** Crea un tenant + su sucursal/bodega/suscripcion + roles de negocio + usuario OWNER. */
export async function createTenantWithOwner(
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  const { data, error } = await (supabase.rpc as any)('create_tenant_with_owner', {
    p_name:            input.name,
    p_slug:            input.slug,
    p_business_type:   input.business_type,
    p_plan:            input.plan,
    p_country:         input.country,
    p_currency:        input.currency,
    p_owner_email:     input.owner_email,
    p_owner_name:      input.owner_name,
    p_owner_password:  input.owner_password,
    p_timezone:        input.timezone ?? 'America/Bogota',
    p_locale:          input.locale ?? 'es-CO',
    p_logo_url:        input.logo_url ?? null,
    p_primary_color:   input.primary_color ?? '#F20D18',
    p_secondary_color: input.secondary_color ?? '#111827',
  })
  if (error) throw error
  return data as CreateTenantResult
}

/** Actualiza el branding y datos editables de un tenant. */
export async function updateTenant(
  tenantId: string,
  input: UpdateTenantInput,
): Promise<void> {
  const { error } = await (supabase.rpc as any)('update_tenant_branding', {
    p_tenant_id:       tenantId,
    p_name:            input.name            ?? null,
    p_slug:            input.slug            ?? null,
    p_business_type:   input.business_type   ?? null,
    p_logo_url:        input.logo_url        ?? null,
    p_primary_color:   input.primary_color   ?? null,
    p_secondary_color: input.secondary_color ?? null,
    p_country:         input.country         ?? null,
    p_currency:        input.currency        ?? null,
  })
  if (error) throw error
}

/** Elimina permanentemente un tenant y todo su contenido (CASCADE). */
export async function deleteTenant(tenantId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('delete_tenant', {
    p_tenant_id: tenantId,
  })
  if (error) throw error
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

// -- Subscriptions / Plans (SUPER_ADMIN) ----------------------

export type PlanCode = 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'

export interface PlanRow {
  code:        PlanCode
}

// ── POS Terminals ──────────────────────────────────────────────

export type POSTerminalMode = 'FULL' | 'COMMANDS_ONLY'

export interface POSTerminalRow {
  id: string
  tenant_id: string
  branch_id: string
  name: string
  cashier_id: string | null
  mode: POSTerminalMode
  allowed_category_ids: string[] | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface POSTerminalWithCashier extends POSTerminalRow {
  cashier?: { full_name: string; email: string } | null
}

export async function getPOSTerminals(
  tenantId: string,
  branchId: string,
): Promise<POSTerminalWithCashier[]> {
  const { data, error } = await supabase
    .from('pos_terminals')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('created_at')
  if (error) throw error
  const terminals = (data ?? []) as POSTerminalRow[]

  // Enrich with cashier profile (cashier_id → auth.users, no direct join)
  const cashierIds = [...new Set(terminals.map(t => t.cashier_id).filter(Boolean))] as string[]
  let profileMap: Map<string, { full_name: string; email: string }> = new Map()
  if (cashierIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', cashierIds)
    ;(profiles ?? []).forEach((p: any) => profileMap.set(p.id, { full_name: p.full_name, email: '' }))
  }

  return terminals.map(t => ({
    ...t,
    cashier: t.cashier_id ? (profileMap.get(t.cashier_id) ?? null) : null,
  }))
}

export async function upsertPOSTerminal(
  tenantId: string,
  branchId: string,
  userId: string,
  payload: {
    id?: string
    name: string
    cashier_id: string | null
    mode: POSTerminalMode
    allowed_category_ids: string[] | null
    notes?: string
    is_active?: boolean
  },
): Promise<POSTerminalRow> {
  const row = {
    tenant_id:            tenantId,
    branch_id:            branchId,
    created_by:           userId,
    name:                 payload.name,
    cashier_id:           payload.cashier_id,
    mode:                 payload.mode,
    allowed_category_ids: payload.allowed_category_ids,
    notes:                payload.notes ?? null,
    is_active:            payload.is_active ?? true,
  }
  const q = payload.id
    ? supabase.from('pos_terminals').update(row).eq('id', payload.id).eq('tenant_id', tenantId)
    : supabase.from('pos_terminals').insert(row)
  const { data, error } = await q.select().single()
  if (error) throw error
  return data as unknown as POSTerminalRow
}

export async function deletePOSTerminal(
  tenantId: string,
  terminalId: string,
): Promise<void> {
  const { error } = await supabase
    .from('pos_terminals')
    .delete()
    .eq('id', terminalId)
    .eq('tenant_id', tenantId)
  if (error) throw error
}

export async function getMyPOSTerminal(
  tenantId: string,
  branchId: string,
): Promise<POSTerminalRow | null> {
  const { data, error } = await (supabase.rpc as any)('get_my_pos_terminal', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
  })
  if (error) throw error
  return data as POSTerminalRow | null
}
/* si hay tenants activos con ese plan). */
export async function deletePlan(code: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('delete_plan', { p_code: code })
  if (error) throw error
}

/** Tenants con su suscripción (para el panel de suscripciones). */
export async function getTenantSubscriptions(): Promise<TenantSubscriptionRow[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, is_active, subscriptions (id, plan, status, price, currency, current_period_start, current_period_end)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as TenantSubscriptionRow[]
}

/** Activa/cambia la suscripción de un tenant. Dura 1 mes. price opcional = override. */
export async function activateSubscription(
  tenantId: string,
  plan: PlanCode,
  price?: number,
  currency?: string,
): Promise<void> {
  const { error } = await (supabase.rpc as any)('activate_subscription', {
    p_tenant_id: tenantId,
    p_plan: plan,
    p_price: price ?? null,
    p_currency: currency ?? null,
  })
  if (error) throw error
}

/** Renueva la suscripción 1 mes más. */
export async function renewSubscription(tenantId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('renew_subscription', {
    p_tenant_id: tenantId,
  })
  if (error) throw error
}

/** Cancela la suscripción de un tenant. */
export async function cancelSubscription(tenantId: string, reason?: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('cancel_subscription', {
    p_tenant_id: tenantId,
    p_reason: reason ?? null,
  })
  if (error) throw error
}

// ── Self-service del dueño (OWNER/ADMIN) ──────────────────────
// La política RLS "tenants_update" ya permite que OWNER/ADMIN editen
// su propio tenant, y "subscriptions_select" / "plans_read" permiten
// leer su suscripción y el catálogo de planes. No requieren RPC.

export interface TenantAddress {
  street?: string
  city?: string
  department?: string
  country?: string
  postal_code?: string
}

export interface ReceiptSettings {
  header?: string
  footer?: string
  show_logo?: boolean
  show_tax_id?: boolean
  phone?: string
}

export interface NotificationSettings {
  low_stock?: boolean
  cash_close?: boolean
  expiry_alerts?: boolean
  daily_summary?: boolean
  new_sale?: boolean
}

export interface GeneralSettings {
  currency?: string
  timezone?: string
  locale?: string
}

export interface TenantSettings {
  general?: GeneralSettings
  receipt?: ReceiptSettings
  notifications?: NotificationSettings
  [key: string]: unknown
}

export interface MyTenantRow {
  id: string
  name: string
  slug: string
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  business_type: string
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  country: string | null
  currency: string | null
  timezone: string | null
  locale: string | null
  tax_id: string | null
  address: TenantAddress | null
  settings: TenantSettings | null
  is_active: boolean
}

/** Lee los datos completos del tenant del usuario actual. */
export async function getMyTenant(tenantId: string): Promise<MyTenantRow> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, business_type, logo_url, primary_color, secondary_color, country, currency, timezone, locale, tax_id, address, settings, is_active')
    .eq('id', tenantId)
    .single()
  if (error) throw error
  return data as unknown as MyTenantRow
}

/** Campos que el dueño puede editar de su propia empresa (nunca plan/slug/is_active). */
export interface UpdateMyTenantInput {
  name?: string
  business_type?: string
  tax_id?: string | null
  address?: TenantAddress | null
  logo_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  currency?: string | null
  timezone?: string | null
  locale?: string | null
}

/** Actualiza los datos de la empresa. Usa RLS (owner/admin del tenant). */
export async function updateMyTenant(tenantId: string, patch: UpdateMyTenantInput): Promise<MyTenantRow> {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) clean[k] = v
  }
  clean.updated_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('tenants')
    .update(clean)
    .eq('id', tenantId)
    .select('id, name, slug, plan, business_type, logo_url, primary_color, secondary_color, country, currency, timezone, locale, tax_id, address, settings, is_active')
    .single()
  if (error) throw error
  return data as unknown as MyTenantRow
}

/** Mezcla y guarda el objeto settings (JSONB) del tenant. */
export async function updateMyTenantSettings(
  tenantId: string,
  current: TenantSettings | null,
  patch: TenantSettings,
): Promise<TenantSettings> {
  const merged: TenantSettings = {
    ...(current ?? {}),
    ...patch,
    general:       { ...(current?.general ?? {}),       ...(patch.general ?? {}) },
    receipt:       { ...(current?.receipt ?? {}),       ...(patch.receipt ?? {}) },
    notifications: { ...(current?.notifications ?? {}), ...(patch.notifications ?? {}) },
  }
  const { error } = await supabase
    .from('tenants')
    .update({ settings: merged, updated_at: new Date().toISOString() })
    .eq('id', tenantId)
  if (error) throw error
  return merged
}

/** Sube el logo del tenant a su carpeta (requiere política storage por tenant_id, migración 024). */
export async function uploadMyTenantLogo(tenantId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${tenantId}/logo-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('tenant-assets')
    .upload(path, file, { cacheControl: '3600', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path)
  return data.publicUrl
}

export interface MySubscriptionRow {
  id: string
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELLED'
  price: number
  currency: string
  current_period_start: string | null
  current_period_end: string | null
  trial_ends_at: string | null
}

/** Lee la suscripción vigente del tenant (la más reciente). */
export async function getMySubscription(tenantId: string): Promise<MySubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, plan, status, price, currency, current_period_start, current_period_end, trial_ends_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as MySubscriptionRow) ?? null
}

export interface PublicPlanRow {
  code: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  name: string
  description: string | null
  price: number
  currency: string
  features: string[]
  sort_order: number
}

/** Catálogo público de planes activos (para que el dueño elija). */
export async function getPublicPlans(): Promise<PublicPlanRow[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('code, name, description, price, currency, features, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    code: p.code,
    name: p.name,
    description: p.description ?? null,
    price: Number(p.price ?? 0),
    currency: p.currency ?? 'COP',
    features: Array.isArray(p.features) ? p.features : [],
    sort_order: p.sort_order ?? 0,
  }))
}

// ── Wompi (pasarela de pago) ──────────────────────────────────

export interface WompiCheckoutResult {
  checkoutUrl: string
  reference: string
  amountInCents: number
  currency: string
  publicKey: string
}

/**
 * Inicia un pago de suscripción con Wompi. Llama a la Edge Function
 * `wompi-checkout`, que firma la transacción server-side y devuelve la
 * URL del Web Checkout a la que hay que redirigir al usuario.
 */
export async function startWompiCheckout(
  tenantId: string,
  planCode: string,
  redirectUrl: string,
): Promise<WompiCheckoutResult> {
  const { data, error } = await supabase.functions.invoke('wompi-checkout', {
    body: { tenantId, planCode, redirectUrl },
  })
  if (error) throw error
  if ((data as any)?.error) throw new Error((data as any).error)
  return data as WompiCheckoutResult
}

export interface PaymentTxRow {
  id: string
  reference: string
  plan_code: string
  amount_in_cents: number
  currency: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
  wompi_transaction_id: string | null
  created_at: string
}

/** Historial de pagos del tenant (para mostrar en la suscripción). */
export async function getMyPayments(tenantId: string, limit = 10): Promise<PaymentTxRow[]> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('id, reference, plan_code, amount_in_cents, currency, status, wompi_transaction_id, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as PaymentTxRow[]
}

/** Devuelve los slugs de los módulos ACTIVOS del tenant (tenant_modules habilitados). */
export async function getMyModuleSlugs(tenantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenant_modules')
    .select('is_enabled, marketplace_modules ( slug )')
    .eq('tenant_id', tenantId)
    .eq('is_enabled', true)
  if (error) throw error
  const slugs = (data ?? [])
    .map((r: any) => r.marketplace_modules?.slug)
    .filter((s: unknown): s is string => typeof s === 'string')
  return slugs
}

// ── Cash Register ─────────────────────────────────────────────

export interface CashRegisterRow {
  id: string
  tenant_id: string
  branch_id: string
  name: string
  status: 'OPEN' | 'CLOSED' | 'PAUSED'
  opened_at: string
  closed_at: string | null
  opening_cash: number
  closing_cash: number | null
  expected_cash: number | null
  cash_difference: number | null
  opened_by: string
  closed_by: string | null
}

export interface ActiveCashRegister {
  id: string
  name: string
  status: string
  opened_at: string
  opening_cash: number
  opened_by: string
  opened_by_name: string
  sales_total: number
  cash_sales: number
  tx_count: number
}

export async function getActiveCashRegister(
  tenantId: string,
  branchId: string,
): Promise<ActiveCashRegister | null> {
  const { data, error } = await (supabase.rpc as any)('get_active_cash_register', {
    p_tenant_id: tenantId,
    p_branch_id: branchId,
  })
  if (error) throw error
  if (!data) return null
  return data as ActiveCashRegister
}

export async function openCashRegister(
  tenantId: string,
  branchId: string,
  name: string,
  openingCash: number,
): Promise<CashRegisterRow> {
  const { data, error } = await (supabase.rpc as any)('open_cash_register', {
    p_tenant_id:    tenantId,
    p_branch_id:    branchId,
    p_name:         name,
    p_opening_cash: openingCash,
  })
  if (error) throw error
  return data as CashRegisterRow
}

export async function closeCashRegister(
  registerId: string,
  countedCash: number,
  notes?: string,
): Promise<CashRegisterRow> {
  const { data, error } = await (supabase.rpc as any)('close_cash_register', {
    p_register_id:  registerId,
    p_counted_cash: countedCash,
    p_notes:        notes ?? null,
  })
  if (error) throw error
  return data as CashRegisterRow
}

// ── Cash Register History ─────────────────────────────────────

export async function getOpenCashRegisters(
  tenantId: string,
  branchId: string,
): Promise<CashRegisterRow[]> {
  const { data, error } = await supabase
    .from('cash_registers')
    .select('id, tenant_id, branch_id, name, status, opened_at, closed_at, opening_cash, closing_cash, expected_cash, cash_difference, opened_by, closed_by')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CashRegisterRow[]
}

export interface CashRegisterHistoryRow extends CashRegisterRow {
  opened_by_profile: { full_name: string } | null
  closed_by_profile: { full_name: string } | null
}

export async function getCashRegisterHistory(
  tenantId: string,
  branchId: string,
  since?: string,
): Promise<CashRegisterHistoryRow[]> {
  let q = supabase
    .from('cash_registers')
    .select(`
      *,
      opened_by_profile:opened_by(full_name),
      closed_by_profile:closed_by(full_name)
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('opened_at', { ascending: false })
    .limit(50)
  if (since) q = q.gte('opened_at', since)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as CashRegisterHistoryRow[]
}

// ── Sales History ──────────────────────────────────────────────

export interface SaleHistoryRow {
  id: string
  order_number: string
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'REFUNDED'
  total: number
  subtotal: number
  tax_total: number
  discount_total: number
  currency: string
  created_at: string
  notes: string | null
  cash_register_id: string | null
  customers: { full_name: string } | null
  sale_payments: { method: string; amount: number }[]
  sale_items: { name: string; quantity: number; unit_price: number; total: number; discount_amount: number; tax: number; tax_amount: number }[]
  created_by_profile: { full_name: string } | null
}

export async function getSalesHistory(
  tenantId: string,
  branchId: string,
  params?: { since?: string; until?: string; limit?: number; status?: string; cashRegisterId?: string },
): Promise<SaleHistoryRow[]> {
  let q = supabase
    .from('sales')
    .select(`
      id, order_number, status, total, subtotal, tax_total, discount_total,
      currency, created_at, notes, cash_register_id,
      customers(full_name),
      sale_payments(method, amount),
      sale_items(name, quantity, unit_price, total, discount_amount, tax, tax_amount)
    `)
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(params?.limit ?? 50)

  if (params?.since)           q = q.gte('created_at', params.since)
  if (params?.until)           q = q.lte('created_at', params.until)
  if (params?.status)          q = q.eq('status', params.status)
  if (params?.cashRegisterId)  q = q.eq('cash_register_id', params.cashRegisterId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as SaleHistoryRow[]
}

// ── Update Stock ──────────────────────
export async function updateStock(
  tenantId: string,
  branchId: string,
  userId: string,
  inventoryId: string,
  productId: string,
  newQuantity: number,
  previousQuantity: number,
  notes?: string,
): Promise<void> {
  const { error: invErr } = await supabase
    .from('inventory')
    .update({ quantity: newQuantity })
    .eq('id', inventoryId)
    .eq('tenant_id', tenantId)
  if (invErr) throw invErr

  const delta = newQuantity - previousQuantity
  if (delta !== 0) {
    const { data: warehouse } = await supabase
      .from('inventory')
      .select('warehouse_id')
      .eq('id', inventoryId)
      .single()

    await supabase.from('stock_movements').insert({
      tenant_id:      tenantId,
      branch_id:      branchId,
      warehouse_id:   warehouse?.warehouse_id ?? null,
      product_id:     productId,
      type:           'ADJUSTMENT',
      quantity:       Math.abs(delta),
      reference_type: 'MANUAL_ADJUSTMENT',
      notes:          notes ?? (delta > 0
        ? `Ajuste manual: +${delta} unidades`
        : `Ajuste manual: ${delta} unidades`),
      created_by:     userId,
    })
  }
}

export async function cancelSale(
  tenantId: string,
  saleId: string,
  reason?: string,
): Promise<void> {
  const { error } = await supabase
    .from('sales')
    .update({
      status: 'CANCELLED',
      notes:  reason ? `ANULADA: ${reason}` : 'ANULADA',
    })
    .eq('id', saleId)
    .eq('tenant_id', tenantId)
    .neq('status', 'CANCELLED')
  if (error) throw error
}
