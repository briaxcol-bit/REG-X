/**
 * REG-X — Capa de datos Supabase · dominio: restaurant
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { cleanInput } from './purchasing'

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

// ── Reservas (módulo reservations) ────────────────────────────
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW'

export interface ReservationRow {
  id: string
  tenant_id: string
  branch_id: string | null
  table_id: string | null
  customer_name: string
  customer_phone: string | null
  party_size: number
  reserved_at: string
  status: ReservationStatus
  notes: string | null
  created_at: string
}

export interface ReservationInput {
  customer_name: string
  customer_phone?: string | null
  party_size: number
  reserved_at: string
  table_id?: string | null
  branch_id?: string | null
  status?: ReservationStatus
  notes?: string | null
}

export async function getReservations(tenantId: string, opts?: { from?: string; to?: string }): Promise<ReservationRow[]> {
  let q = supabase
    .from('reservations')
    .select('id, tenant_id, branch_id, table_id, customer_name, customer_phone, party_size, reserved_at, status, notes, created_at')
    .eq('tenant_id', tenantId)
    .order('reserved_at', { ascending: true })
  if (opts?.from) q = q.gte('reserved_at', opts.from)
  if (opts?.to)   q = q.lte('reserved_at', `${opts.to}T23:59:59`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ReservationRow[]
}

export async function saveReservation(tenantId: string, input: ReservationInput, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('reservations').update(cleanInput(input)).eq('tenant_id', tenantId).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('reservations').insert({ tenant_id: tenantId, ...cleanInput(input) })
    if (error) throw error
  }
}

export async function setReservationStatus(tenantId: string, id: string, status: ReservationStatus): Promise<void> {
  const { error } = await supabase.from('reservations').update({ status }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deleteReservation(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('reservations').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Comandas de Bar (módulo bar_tabs) ─────────────────────────
export interface BarTabRow {
  id: string
  tenant_id: string
  branch_id: string | null
  table_id: string | null
  name: string
  status: 'OPEN' | 'CLOSED'
  total: number
  opened_at: string
  closed_at: string | null
}

export interface BarTabItemRow {
  id: string
  tab_id: string
  product_id: string | null
  name: string
  quantity: number
  unit_price: number
  total: number
  created_at: string
}

export async function getBarTabs(tenantId: string, opts?: { status?: 'OPEN' | 'CLOSED' }): Promise<BarTabRow[]> {
  let q = supabase
    .from('bar_tabs')
    .select('id, tenant_id, branch_id, table_id, name, status, total, opened_at, closed_at')
    .eq('tenant_id', tenantId)
    .order('opened_at', { ascending: false })
  if (opts?.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as BarTabRow[]
}

export async function getBarTabItems(tenantId: string, tabId: string): Promise<BarTabItemRow[]> {
  const { data, error } = await supabase
    .from('bar_tab_items')
    .select('id, tab_id, product_id, name, quantity, unit_price, total, created_at')
    .eq('tenant_id', tenantId)
    .eq('tab_id', tabId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as BarTabItemRow[]
}

export async function openBarTab(tenantId: string, input: { name: string; table_id?: string | null; branch_id?: string | null; opened_by?: string | null }): Promise<BarTabRow> {
  const { data, error } = await supabase
    .from('bar_tabs')
    .insert({ tenant_id: tenantId, status: 'OPEN', total: 0, ...cleanInput(input) })
    .select('id, tenant_id, branch_id, table_id, name, status, total, opened_at, closed_at')
    .single()
  if (error) throw error
  return data as unknown as BarTabRow
}

/** Recalcula el total del tab a partir de sus ítems. */
export async function recalcBarTab(tenantId: string, tabId: string): Promise<void> {
  const { data, error } = await supabase.from('bar_tab_items').select('total').eq('tenant_id', tenantId).eq('tab_id', tabId)
  if (error) throw error
  const total = ((data ?? []) as any[]).reduce((s, r) => s + (Number(r.total) || 0), 0)
  await supabase.from('bar_tabs').update({ total }).eq('tenant_id', tenantId).eq('id', tabId)
}

export async function addBarTabItem(
  tenantId: string, tabId: string,
  item: { product_id?: string | null; name: string; quantity: number; unit_price: number },
): Promise<void> {
  const total = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
  const { error } = await supabase.from('bar_tab_items').insert({
    tenant_id: tenantId, tab_id: tabId, product_id: item.product_id ?? null,
    name: item.name, quantity: item.quantity, unit_price: item.unit_price, total,
  })
  if (error) throw error
  await recalcBarTab(tenantId, tabId)
}

export async function removeBarTabItem(tenantId: string, tabId: string, itemId: string): Promise<void> {
  const { error } = await supabase.from('bar_tab_items').delete().eq('tenant_id', tenantId).eq('id', itemId)
  if (error) throw error
  await recalcBarTab(tenantId, tabId)
}

export async function closeBarTab(tenantId: string, tabId: string): Promise<void> {
  const { error } = await supabase.from('bar_tabs').update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', tabId)
  if (error) throw error
}

export async function deleteBarTab(tenantId: string, tabId: string): Promise<void> {
  const { error } = await supabase.from('bar_tabs').delete().eq('tenant_id', tenantId).eq('id', tabId)
  if (error) throw error
}

// ── Delivery (módulo delivery) ────────────────────────────────
export interface CourierRow {
  id: string
  tenant_id: string
  name: string
  phone: string | null
  is_active: boolean
}

export async function getCouriers(tenantId: string): Promise<CourierRow[]> {
  const { data, error } = await supabase
    .from('couriers')
    .select('id, tenant_id, name, phone, is_active')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as CourierRow[]
}

export async function saveCourier(tenantId: string, input: { name: string; phone?: string | null }, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('couriers').update(cleanInput(input)).eq('tenant_id', tenantId).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('couriers').insert({ tenant_id: tenantId, ...cleanInput(input) })
    if (error) throw error
  }
}

export async function toggleCourier(tenantId: string, id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('couriers').update({ is_active: active }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export type DeliveryStatus = 'PENDING' | 'PREPARING' | 'ON_WAY' | 'DELIVERED' | 'CANCELLED'

export interface DeliveryRow {
  id: string
  tenant_id: string
  branch_id: string | null
  courier_id: string | null
  customer_name: string
  customer_phone: string | null
  address: string
  status: DeliveryStatus
  total: number
  fee: number
  notes: string | null
  created_at: string
  delivered_at: string | null
}

export interface DeliveryInput {
  customer_name: string
  customer_phone?: string | null
  address: string
  total?: number
  fee?: number
  courier_id?: string | null
  branch_id?: string | null
  notes?: string | null
}

export async function getDeliveries(tenantId: string, opts?: { status?: DeliveryStatus }): Promise<DeliveryRow[]> {
  let q = supabase
    .from('deliveries')
    .select('id, tenant_id, branch_id, courier_id, customer_name, customer_phone, address, status, total, fee, notes, created_at, delivered_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (opts?.status) q = q.eq('status', opts.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as DeliveryRow[]
}

export async function saveDelivery(tenantId: string, input: DeliveryInput, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('deliveries').update(cleanInput(input)).eq('tenant_id', tenantId).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('deliveries').insert({ tenant_id: tenantId, ...cleanInput(input) })
    if (error) throw error
  }
}

export async function setDeliveryStatus(tenantId: string, id: string, status: DeliveryStatus, courierId?: string | null): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (courierId !== undefined) patch['courier_id'] = courierId
  if (status === 'DELIVERED') patch['delivered_at'] = new Date().toISOString()
  const { error } = await supabase.from('deliveries').update(patch).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deleteDelivery(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('deliveries').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Menú Digital QR (módulo menu_digital) ─────────────────────
export interface PublicMenuItem { id: string; name: string; price: number; image_url: string | null; category_id: string | null; category: string | null }

export interface PublicMenu {
  ok: boolean
  reason?: string
  tenant?: { name: string; slug: string; logo_url: string | null }
  items?: PublicMenuItem[]
}

/** Menú público por slug (sin login) — usado por la página del QR. */
export async function getPublicMenu(slug: string): Promise<PublicMenu> {
  const { data, error } = await (supabase.rpc as any)('get_public_menu', { p_slug: slug })
  if (error) throw error
  return (data ?? { ok: false }) as PublicMenu
}

// ── División de Cuenta (módulo split_bill) ────────────────────
export interface BillSplitShare { label: string; amount: number }

export interface BillSplitRow {
  id: string
  tenant_id: string
  tab_id: string | null
  total: number
  tip: number
  method: 'EQUAL' | 'ITEMS' | 'CUSTOM'
  people: number
  detail: BillSplitShare[] | null
  created_at: string
}

export interface BillSplitInput {
  tab_id?: string | null
  branch_id?: string | null
  total: number
  tip?: number
  method: 'EQUAL' | 'ITEMS' | 'CUSTOM'
  people: number
  detail: BillSplitShare[]
}

export async function saveBillSplit(tenantId: string, input: BillSplitInput): Promise<void> {
  const { error } = await supabase.from('bill_splits').insert({ tenant_id: tenantId, ...cleanInput(input) })
  if (error) throw error
}

export async function getBillSplits(tenantId: string, limit = 40): Promise<BillSplitRow[]> {
  const { data, error } = await supabase
    .from('bill_splits')
    .select('id, tenant_id, tab_id, total, tip, method, people, detail, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as BillSplitRow[]
}
