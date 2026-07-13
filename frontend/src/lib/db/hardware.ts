/**
 * REG-X — Capa de datos Supabase · dominio: hardware
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { cleanInput } from './purchasing'
import { seqCode } from './retail'

// ══════════════════════════════════════════════════════════════
// MÓDULOS FERRETERÍA / INDUSTRIAL: Cotizaciones, Órdenes de
// Trabajo, Ensambles, Conversión de Unidades y Seriales
// ══════════════════════════════════════════════════════════════
// ── Cotizaciones (quotes) ─────────────────────────────────────
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED'

export interface QuoteItemInput { product_id?: string | null; description: string; quantity: number; unit_price: number }

export interface QuoteItemRow extends QuoteItemInput { id: string; total: number }

export interface QuoteRow {
  id: string
  tenant_id: string
  customer_id: string | null
  code: string
  status: QuoteStatus
  quote_date: string
  valid_until: string | null
  total: number
  currency: string
  notes: string | null
  created_at: string
  customers?: { full_name: string } | null
  quote_items?: QuoteItemRow[]
}

export async function getQuotes(tenantId: string, filters?: { status?: QuoteStatus }): Promise<QuoteRow[]> {
  let q = supabase.from('quotes')
    .select('id, tenant_id, customer_id, code, status, quote_date, valid_until, total, currency, notes, created_at, customers(full_name)')
    .eq('tenant_id', tenantId).is('deleted_at', null)
    .order('quote_date', { ascending: false }).order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as QuoteRow[]
}

export async function getQuote(tenantId: string, id: string): Promise<QuoteRow> {
  const { data, error } = await supabase.from('quotes')
    .select('id, tenant_id, customer_id, code, status, quote_date, valid_until, total, currency, notes, created_at, customers(full_name), quote_items(id, product_id, description, quantity, unit_price, total)')
    .eq('tenant_id', tenantId).eq('id', id).single()
  if (error) throw error
  return data as unknown as QuoteRow
}

export async function createQuote(
  tenantId: string,
  header: { customer_id?: string | null; quote_date: string; valid_until?: string | null; notes?: string | null; branch_id?: string | null; currency?: string },
  items: QuoteItemInput[],
): Promise<string> {
  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0)
  const { data, error } = await supabase.from('quotes')
    .insert({ tenant_id: tenantId, code: seqCode('COT'), status: 'DRAFT', total, currency: header.currency ?? 'COP', ...cleanInput(header) })
    .select('id').single()
  if (error) throw error
  const qId = (data as any).id as string
  const rows = items.filter((i) => i.description.trim()).map((it) => ({
    tenant_id: tenantId, quote_id: qId, product_id: it.product_id ?? null,
    description: it.description, quantity: it.quantity, unit_price: it.unit_price,
    total: Number(it.quantity) * Number(it.unit_price),
  }))
  if (rows.length) { const { error: e } = await supabase.from('quote_items').insert(rows); if (e) throw e }
  return qId
}

export async function updateQuoteStatus(tenantId: string, id: string, status: QuoteStatus): Promise<void> {
  const { error } = await supabase.from('quotes').update({ status, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Órdenes de Trabajo (work_orders) ──────────────────────────
export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DELIVERED' | 'CANCELLED'

export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH'

export interface WorkOrderItemInput { product_id?: string | null; kind: 'PART' | 'LABOR'; description: string; quantity: number; unit_price: number }

export interface WorkOrderItemRow extends WorkOrderItemInput { id: string; total: number }

export interface WorkOrderRow {
  id: string
  tenant_id: string
  customer_id: string | null
  code: string
  title: string
  description: string | null
  priority: WorkOrderPriority
  status: WorkOrderStatus
  due_date: string | null
  total: number
  currency: string
  notes: string | null
  created_at: string
  customers?: { full_name: string } | null
  work_order_items?: WorkOrderItemRow[]
}

export async function getWorkOrders(tenantId: string, filters?: { status?: WorkOrderStatus }): Promise<WorkOrderRow[]> {
  let q = supabase.from('work_orders')
    .select('id, tenant_id, customer_id, code, title, description, priority, status, due_date, total, currency, notes, created_at, customers(full_name)')
    .eq('tenant_id', tenantId).is('deleted_at', null).order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as WorkOrderRow[]
}

export async function getWorkOrder(tenantId: string, id: string): Promise<WorkOrderRow> {
  const { data, error } = await supabase.from('work_orders')
    .select('id, tenant_id, customer_id, code, title, description, priority, status, due_date, total, currency, notes, created_at, customers(full_name), work_order_items(id, product_id, kind, description, quantity, unit_price, total)')
    .eq('tenant_id', tenantId).eq('id', id).single()
  if (error) throw error
  return data as unknown as WorkOrderRow
}

export async function createWorkOrder(
  tenantId: string,
  header: { title: string; description?: string | null; customer_id?: string | null; priority?: WorkOrderPriority; due_date?: string | null; notes?: string | null; branch_id?: string | null; currency?: string },
  items: WorkOrderItemInput[],
): Promise<string> {
  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0)
  const { data, error } = await supabase.from('work_orders')
    .insert({ tenant_id: tenantId, code: seqCode('OT'), status: 'OPEN', priority: header.priority ?? 'NORMAL', total, currency: header.currency ?? 'COP', ...cleanInput(header) })
    .select('id').single()
  if (error) throw error
  const woId = (data as any).id as string
  const rows = items.filter((i) => i.description.trim()).map((it) => ({
    tenant_id: tenantId, work_order_id: woId, product_id: it.product_id ?? null, kind: it.kind,
    description: it.description, quantity: it.quantity, unit_price: it.unit_price,
    total: Number(it.quantity) * Number(it.unit_price),
  }))
  if (rows.length) { const { error: e } = await supabase.from('work_order_items').insert(rows); if (e) throw e }
  return woId
}

export async function updateWorkOrderStatus(tenantId: string, id: string, status: WorkOrderStatus): Promise<void> {
  const { error } = await supabase.from('work_orders').update({ status, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Ensambles y Kits (assemblies) ─────────────────────────────
export interface AssemblyComponentInput { component_product_id?: string | null; description?: string | null; quantity: number }

export interface AssemblyComponentRow extends AssemblyComponentInput { id: string; products?: { name: string } | null }

export interface AssemblyRow {
  id: string
  tenant_id: string
  product_id: string | null
  name: string
  sale_price: number
  notes: string | null
  is_active: boolean
  created_at: string
  assembly_components?: AssemblyComponentRow[]
}

export async function getAssemblies(tenantId: string): Promise<AssemblyRow[]> {
  const { data, error } = await supabase.from('assemblies')
    .select('id, tenant_id, product_id, name, sale_price, notes, is_active, created_at, assembly_components(id, component_product_id, description, quantity, products:component_product_id(name))')
    .eq('tenant_id', tenantId).is('deleted_at', null).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as AssemblyRow[]
}

export async function createAssembly(
  tenantId: string,
  header: { name: string; sale_price: number; product_id?: string | null; notes?: string | null },
  components: AssemblyComponentInput[],
): Promise<string> {
  const { data, error } = await supabase.from('assemblies')
    .insert({ tenant_id: tenantId, is_active: true, ...cleanInput(header) })
    .select('id').single()
  if (error) throw error
  const aId = (data as any).id as string
  const rows = components.filter((c) => c.component_product_id || c.description).map((c) => ({
    tenant_id: tenantId, assembly_id: aId, component_product_id: c.component_product_id ?? null,
    description: c.description ?? null, quantity: c.quantity,
  }))
  if (rows.length) { const { error: e } = await supabase.from('assembly_components').insert(rows); if (e) throw e }
  return aId
}

export async function updateAssembly(tenantId: string, id: string, input: { name?: string; sale_price?: number; notes?: string | null; is_active?: boolean }): Promise<void> {
  const { error } = await supabase.from('assemblies').update({ ...cleanInput(input), updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deleteAssembly(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('assemblies').update({ deleted_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Conversión de Unidades (product_units) ────────────────────
export interface ProductUnitRow {
  id: string
  product_id: string
  unit_name: string
  factor: number
  price: number | null
  is_base: boolean
  created_at: string
}

export async function getProductUnits(tenantId: string, productId: string): Promise<ProductUnitRow[]> {
  const { data, error } = await supabase.from('product_units')
    .select('id, product_id, unit_name, factor, price, is_base, created_at')
    .eq('tenant_id', tenantId).eq('product_id', productId)
    .order('is_base', { ascending: false }).order('factor', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ProductUnitRow[]
}

export async function upsertProductUnit(
  tenantId: string, productId: string,
  input: { unit_name: string; factor: number; price?: number | null; is_base?: boolean },
): Promise<void> {
  const { error } = await supabase.from('product_units')
    .upsert({ tenant_id: tenantId, product_id: productId, ...cleanInput(input) }, { onConflict: 'product_id,unit_name' })
  if (error) throw error
}

export async function deleteProductUnit(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('product_units').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Seguimiento por Serial (product_serials) ──────────────────
export type SerialStatus = 'IN_STOCK' | 'SOLD' | 'RETURNED' | 'DEFECTIVE'

export interface SerialRow {
  id: string
  tenant_id: string
  product_id: string
  supplier_id: string | null
  serial_number: string
  status: SerialStatus
  notes: string | null
  received_at: string
  created_at: string
  products?: { name: string; sku: string } | null
  suppliers?: { name: string } | null
}

export async function getSerials(tenantId: string, filters?: { search?: string; status?: SerialStatus; productId?: string }): Promise<SerialRow[]> {
  let q = supabase.from('product_serials')
    .select('id, tenant_id, product_id, supplier_id, serial_number, status, notes, received_at, created_at, products(name, sku), suppliers(name)')
    .eq('tenant_id', tenantId).is('deleted_at', null).order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.productId) q = q.eq('product_id', filters.productId)
  if (filters?.search?.trim()) q = q.ilike('serial_number', `%${filters.search.trim()}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as SerialRow[]
}

export async function createSerial(
  tenantId: string,
  input: { product_id: string; serial_number: string; supplier_id?: string | null; status?: SerialStatus; notes?: string | null; received_at?: string },
): Promise<SerialRow> {
  const { data, error } = await supabase.from('product_serials')
    .insert({ tenant_id: tenantId, status: input.status ?? 'IN_STOCK', ...cleanInput(input) })
    .select('id, tenant_id, product_id, supplier_id, serial_number, status, notes, received_at, created_at, products(name, sku), suppliers(name)')
    .single()
  if (error) throw error
  return data as unknown as SerialRow
}

export async function updateSerialStatus(tenantId: string, id: string, status: SerialStatus): Promise<void> {
  const { error } = await supabase.from('product_serials').update({ status, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deleteSerial(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('product_serials').update({ deleted_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}
