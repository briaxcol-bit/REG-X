/**
 * REG-X — Capa de datos Supabase · dominio: purchasing
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { seqCode } from './retail'

// ── Proveedores (módulo suppliers) ────────────────────────────
export type SupplierPaymentTerms = 'CASH' | 'CREDIT'

export interface SupplierAddress { street?: string; city?: string; department?: string }

export interface SupplierRow {
  id: string
  tenant_id: string
  name: string
  tax_id: string | null
  category: string | null
  email: string | null
  phone: string | null
  website: string | null
  contact_name: string | null
  address: SupplierAddress | null
  payment_terms: SupplierPaymentTerms
  credit_days: number | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface SupplierInput {
  name: string
  tax_id?: string | null
  category?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  contact_name?: string | null
  address?: SupplierAddress | null
  payment_terms?: SupplierPaymentTerms
  credit_days?: number | null
  notes?: string | null
}

export const SUPPLIER_COLS =
  'id, tenant_id, name, tax_id, category, email, phone, website, contact_name, address, payment_terms, credit_days, notes, is_active, created_at'

export async function getSuppliers(
  tenantId: string,
  opts?: { search?: string; includeInactive?: boolean },
): Promise<SupplierRow[]> {
  let q = supabase
    .from('suppliers')
    .select(SUPPLIER_COLS)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (!opts?.includeInactive) q = q.eq('is_active', true)
  if (opts?.search?.trim()) q = q.ilike('name', `%${opts.search.trim()}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as SupplierRow[]
}

/** Gasto acumulado por proveedor (desde expenses). Devuelve un mapa supplier_id → {total, count, last}. */
export interface SupplierSpend { total: number; count: number; last: string | null }

export async function getSupplierSpend(tenantId: string): Promise<Record<string, SupplierSpend>> {
  const { data, error } = await supabase
    .from('expenses')
    .select('supplier_id, amount, expense_date')
    .eq('tenant_id', tenantId)
    .not('supplier_id', 'is', null)
  if (error) throw error
  const map: Record<string, SupplierSpend> = {}
  for (const r of (data ?? []) as any[]) {
    const id = r.supplier_id as string
    const cur = map[id] ?? { total: 0, count: 0, last: null }
    cur.total += Number(r.amount) || 0
    cur.count += 1
    if (!cur.last || r.expense_date > cur.last) cur.last = r.expense_date
    map[id] = cur
  }
  return map
}

export async function createSupplier(tenantId: string, input: SupplierInput): Promise<SupplierRow> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ tenant_id: tenantId, is_active: true, ...cleanInput(input) })
    .select(SUPPLIER_COLS)
    .single()
  if (error) throw error
  return data as unknown as SupplierRow
}

export async function updateSupplier(tenantId: string, id: string, input: SupplierInput): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .update({ ...cleanInput(input), updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export async function toggleSupplierActive(tenantId: string, id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export async function deleteSupplier(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

// ── Gastos operativos (módulo expenses) ───────────────────────
export type ExpensePaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'OTHER'

export interface ExpenseRow {
  id: string
  tenant_id: string
  branch_id: string | null
  supplier_id: string | null
  category: string
  description: string | null
  amount: number
  currency: string
  expense_date: string
  payment_method: ExpensePaymentMethod
  reference: string | null
  created_at: string
  /** Sesión de caja de la que salió el efectivo (para el cierre del día) */
  cash_register_id: string | null
  suppliers?: { name: string } | null
}

export interface ExpenseInput {
  category: string
  description?: string | null
  amount: number
  currency?: string
  expense_date: string
  payment_method: ExpensePaymentMethod
  reference?: string | null
  supplier_id?: string | null
  branch_id?: string | null
  cash_register_id?: string | null
}

export interface ExpenseFilters {
  from?: string
  to?: string
  category?: string
  supplierId?: string
}

export async function getExpenses(tenantId: string, filters?: ExpenseFilters): Promise<ExpenseRow[]> {
  let q = supabase
    .from('expenses')
    .select('id, tenant_id, branch_id, supplier_id, category, description, amount, currency, expense_date, payment_method, reference, created_at, cash_register_id, suppliers(name)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters?.from)       q = q.gte('expense_date', filters.from)
  if (filters?.to)         q = q.lte('expense_date', filters.to)
  if (filters?.category)   q = q.eq('category', filters.category)
  if (filters?.supplierId) q = q.eq('supplier_id', filters.supplierId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ExpenseRow[]
}

export async function createExpense(tenantId: string, input: ExpenseInput): Promise<ExpenseRow> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ tenant_id: tenantId, currency: input.currency ?? 'COP', ...cleanInput(input) })
    .select('id, tenant_id, branch_id, supplier_id, category, description, amount, currency, expense_date, payment_method, reference, created_at, cash_register_id, suppliers(name)')
    .single()
  if (error) throw error
  return data as unknown as ExpenseRow
}

export async function updateExpense(tenantId: string, id: string, input: ExpenseInput): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ ...cleanInput(input), updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export async function deleteExpense(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

/** Gastos en EFECTIVO pagados desde una sesión de caja (para el cierre). */
export async function getCashExpensesForRegister(
  tenantId: string,
  cashRegisterId: string,
): Promise<{ total: number; items: ExpenseRow[] }> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, tenant_id, branch_id, supplier_id, category, description, amount, currency, expense_date, payment_method, reference, created_at, cash_register_id, suppliers(name)')
    .eq('tenant_id', tenantId)
    .eq('cash_register_id', cashRegisterId)
    .eq('payment_method', 'CASH')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  const items = (data ?? []) as unknown as ExpenseRow[]
  return { total: items.reduce((s, r) => s + Number(r.amount || 0), 0), items }
}

export interface ExpenseSummary {
  total: number
  count: number
  byCategory: { category: string; total: number }[]
}

/** Totales de gastos en un rango (agrega en cliente; datos por tenant vía RLS). */
export async function getExpenseSummary(tenantId: string, filters?: ExpenseFilters): Promise<ExpenseSummary> {
  const rows = await getExpenses(tenantId, filters)
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(r.category, (map.get(r.category) ?? 0) + Number(r.amount || 0))
  }
  const byCategory = [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
  return { total, count: rows.length, byCategory }
}

/** Quita claves undefined de un objeto de entrada antes de enviarlo a Supabase. */
export function cleanInput<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

// ── Órdenes de Compra (purchase_orders) ───────────────────────
export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrderItemInput {
  product_id?: string | null
  description: string
  quantity: number
  unit_cost: number
}

export interface PurchaseOrderItemRow extends PurchaseOrderItemInput {
  id: string
  total: number
}

export interface PurchaseOrderRow {
  id: string
  tenant_id: string
  branch_id: string | null
  supplier_id: string | null
  code: string
  status: PurchaseOrderStatus
  order_date: string
  expected_date: string | null
  notes: string | null
  total: number
  currency: string
  created_at: string
  suppliers?: { name: string } | null
  purchase_order_items?: PurchaseOrderItemRow[]
}

export async function getPurchaseOrders(
  tenantId: string,
  filters?: { status?: PurchaseOrderStatus },
): Promise<PurchaseOrderRow[]> {
  let q = supabase
    .from('purchase_orders')
    .select('id, tenant_id, branch_id, supplier_id, code, status, order_date, expected_date, notes, total, currency, created_at, suppliers(name)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as PurchaseOrderRow[]
}

export async function getPurchaseOrder(tenantId: string, id: string): Promise<PurchaseOrderRow> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, tenant_id, branch_id, supplier_id, code, status, order_date, expected_date, notes, total, currency, created_at, suppliers(name), purchase_order_items(id, product_id, description, quantity, unit_cost, total)')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as PurchaseOrderRow
}

export async function createPurchaseOrder(
  tenantId: string,
  header: { supplier_id?: string | null; order_date: string; expected_date?: string | null; notes?: string | null; branch_id?: string | null; currency?: string },
  items: PurchaseOrderItemInput[],
): Promise<string> {
  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_cost), 0)
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({
      tenant_id: tenantId,
      code: seqCode('OC'),
      status: 'DRAFT',
      total,
      currency: header.currency ?? 'COP',
      ...cleanInput(header),
    })
    .select('id')
    .single()
  if (error) throw error
  const poId = (data as any).id as string
  if (items.length) {
    const rows = items.map((it) => ({
      tenant_id: tenantId,
      purchase_order_id: poId,
      product_id: it.product_id ?? null,
      description: it.description,
      quantity: it.quantity,
      unit_cost: it.unit_cost,
      total: Number(it.quantity) * Number(it.unit_cost),
    }))
    const { error: itErr } = await supabase.from('purchase_order_items').insert(rows)
    if (itErr) throw itErr
  }
  return poId
}

export async function updatePurchaseOrderStatus(tenantId: string, id: string, status: PurchaseOrderStatus): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}
