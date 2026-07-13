/**
 * REG-X — Capa de datos Supabase · dominio: pos
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'

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
