/**
 * REG-X — Capa de datos Supabase · dominio: finance
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { cleanInput } from './purchasing'

// ══════════════════════════════════════════════════════════════
// MÓDULOS FINANZAS: Contabilidad, Cuentas por Cobrar/Pagar,
// Informes Tributarios y Nómina
// ══════════════════════════════════════════════════════════════
// ── Contabilidad (accounts / journal) ─────────────────────────
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

export interface AccountRow {
  id: string
  tenant_id: string
  code: string
  name: string
  type: AccountType
  is_active: boolean
  created_at: string
}

export async function getAccounts(tenantId: string): Promise<AccountRow[]> {
  const { data, error } = await supabase.from('accounts')
    .select('id, tenant_id, code, name, type, is_active, created_at')
    .eq('tenant_id', tenantId).order('code', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AccountRow[]
}

export async function createAccount(tenantId: string, input: { code: string; name: string; type: AccountType }): Promise<AccountRow> {
  const { data, error } = await supabase.from('accounts').insert({ tenant_id: tenantId, is_active: true, ...cleanInput(input) })
    .select('id, tenant_id, code, name, type, is_active, created_at').single()
  if (error) throw error
  return data as unknown as AccountRow
}

export async function updateAccount(tenantId: string, id: string, input: { code?: string; name?: string; type?: AccountType; is_active?: boolean }): Promise<void> {
  const { error } = await supabase.from('accounts').update({ ...cleanInput(input), updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deleteAccount(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('accounts').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export interface JournalLineInput { account_id: string; debit: number; credit: number }

export interface JournalLineRow extends JournalLineInput { id: string; accounts?: { code: string; name: string } | null }

export interface JournalEntryRow {
  id: string
  tenant_id: string
  entry_date: string
  reference: string | null
  description: string | null
  created_at: string
  journal_lines?: JournalLineRow[]
}

export async function getJournalEntries(tenantId: string): Promise<JournalEntryRow[]> {
  const { data, error } = await supabase.from('journal_entries')
    .select('id, tenant_id, entry_date, reference, description, created_at, journal_lines(id, account_id, debit, credit, accounts(code, name))')
    .eq('tenant_id', tenantId).order('entry_date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as JournalEntryRow[]
}

export async function createJournalEntry(
  tenantId: string,
  header: { entry_date: string; reference?: string | null; description?: string | null },
  lines: JournalLineInput[],
): Promise<string> {
  const { data, error } = await supabase.from('journal_entries')
    .insert({ tenant_id: tenantId, ...cleanInput(header) }).select('id').single()
  if (error) throw error
  const eId = (data as any).id as string
  const rows = lines.filter((l) => l.account_id && (Number(l.debit) || Number(l.credit))).map((l) => ({
    tenant_id: tenantId, journal_entry_id: eId, account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0,
  }))
  if (rows.length) { const { error: e } = await supabase.from('journal_lines').insert(rows); if (e) throw e }
  return eId
}

export interface TrialBalanceRow { account_id: string; code: string; name: string; type: AccountType; debit: number; credit: number; balance: number }

/** Balance de comprobación: suma débitos/créditos por cuenta. */
export async function getTrialBalance(tenantId: string): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabase.from('journal_lines')
    .select('account_id, debit, credit, accounts(code, name, type)')
    .eq('tenant_id', tenantId)
  if (error) throw error
  const map = new Map<string, TrialBalanceRow>()
  for (const l of (data ?? []) as any[]) {
    const a = l.accounts
    if (!a) continue
    const cur = map.get(l.account_id) ?? { account_id: l.account_id, code: a.code, name: a.name, type: a.type, debit: 0, credit: 0, balance: 0 }
    cur.debit += Number(l.debit || 0)
    cur.credit += Number(l.credit || 0)
    cur.balance = cur.debit - cur.credit
    map.set(l.account_id, cur)
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
}

// ── Cuentas por Cobrar (receivables) ──────────────────────────
export interface ReceivableRow {
  id: string
  tenant_id: string
  customer_id: string | null
  reference: string | null
  description: string | null
  amount: number
  paid: number
  currency: string
  due_date: string | null
  status: 'OPEN' | 'PAID' | 'CANCELLED'
  created_at: string
  customers?: { full_name: string } | null
}

export async function getReceivables(tenantId: string, filters?: { status?: 'OPEN' | 'PAID' | 'CANCELLED' }): Promise<ReceivableRow[]> {
  let q = supabase.from('receivables')
    .select('id, tenant_id, customer_id, reference, description, amount, paid, currency, due_date, status, created_at, customers(full_name)')
    .eq('tenant_id', tenantId).is('deleted_at', null).order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ReceivableRow[]
}

export async function createReceivable(tenantId: string, input: { customer_id?: string | null; reference?: string | null; description?: string | null; amount: number; due_date?: string | null }): Promise<void> {
  const { error } = await supabase.from('receivables').insert({ tenant_id: tenantId, paid: 0, status: 'OPEN', ...cleanInput(input) })
  if (error) throw error
}

export async function addReceivablePayment(tenantId: string, id: string, input: { amount: number; method: string; note?: string | null }): Promise<void> {
  if (input.amount <= 0) throw new Error('Monto inválido')
  const { data: r, error: rErr } = await supabase.from('receivables').select('amount, paid, status').eq('tenant_id', tenantId).eq('id', id).single()
  if (rErr) throw rErr
  if ((r as any).status !== 'OPEN') throw new Error('La cuenta no está abierta')
  const newPaid = Number((r as any).paid) + input.amount
  const { error: pErr } = await supabase.from('receivable_payments').insert({ tenant_id: tenantId, receivable_id: id, amount: input.amount, method: input.method, note: input.note ?? null })
  if (pErr) throw pErr
  const { error } = await supabase.from('receivables').update({ paid: newPaid, status: newPaid >= Number((r as any).amount) ? 'PAID' : 'OPEN', updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Cuentas por Pagar (payables) ──────────────────────────────
export interface PayableRow {
  id: string
  tenant_id: string
  supplier_id: string | null
  reference: string | null
  description: string | null
  amount: number
  paid: number
  currency: string
  due_date: string | null
  status: 'OPEN' | 'PAID' | 'CANCELLED'
  created_at: string
  suppliers?: { name: string } | null
}

export async function getPayables(tenantId: string, filters?: { status?: 'OPEN' | 'PAID' | 'CANCELLED' }): Promise<PayableRow[]> {
  let q = supabase.from('payables')
    .select('id, tenant_id, supplier_id, reference, description, amount, paid, currency, due_date, status, created_at, suppliers(name)')
    .eq('tenant_id', tenantId).is('deleted_at', null).order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as PayableRow[]
}

export async function createPayable(tenantId: string, input: { supplier_id?: string | null; reference?: string | null; description?: string | null; amount: number; due_date?: string | null }): Promise<void> {
  const { error } = await supabase.from('payables').insert({ tenant_id: tenantId, paid: 0, status: 'OPEN', ...cleanInput(input) })
  if (error) throw error
}

export async function addPayablePayment(tenantId: string, id: string, input: { amount: number; method: string; note?: string | null }): Promise<void> {
  if (input.amount <= 0) throw new Error('Monto inválido')
  const { data: r, error: rErr } = await supabase.from('payables').select('amount, paid, status').eq('tenant_id', tenantId).eq('id', id).single()
  if (rErr) throw rErr
  if ((r as any).status !== 'OPEN') throw new Error('La cuenta no está abierta')
  const newPaid = Number((r as any).paid) + input.amount
  const { error: pErr } = await supabase.from('payable_payments').insert({ tenant_id: tenantId, payable_id: id, amount: input.amount, method: input.method, note: input.note ?? null })
  if (pErr) throw pErr
  const { error } = await supabase.from('payables').update({ paid: newPaid, status: newPaid >= Number((r as any).amount) ? 'PAID' : 'OPEN', updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Informes Tributarios (lee ventas) ─────────────────────────
export interface TaxSummary { subtotal: number; tax: number; total: number; count: number }

export async function getTaxSummary(tenantId: string, from: string, to: string): Promise<TaxSummary> {
  const { data, error } = await supabase.from('sales')
    .select('subtotal, tax_total, total, status, created_at')
    .eq('tenant_id', tenantId)
    .neq('status', 'CANCELLED')
    .gte('created_at', from)
    .lte('created_at', `${to}T23:59:59`)
  if (error) throw error
  const rows = (data ?? []) as any[]
  return {
    subtotal: rows.reduce((s, r) => s + Number(r.subtotal || 0), 0),
    tax: rows.reduce((s, r) => s + Number(r.tax_total || 0), 0),
    total: rows.reduce((s, r) => s + Number(r.total || 0), 0),
    count: rows.length,
  }
}

// ── Nómina (payroll_entries) ──────────────────────────────────
export interface PayrollRow {
  id: string
  tenant_id: string
  employee_id: string | null
  employee_name: string
  period_label: string
  base_salary: number
  bonuses: number
  deductions: number
  net_pay: number
  status: 'DRAFT' | 'PAID'
  paid_at: string | null
  notes: string | null
  created_at: string
}

export async function getPayrollEntries(tenantId: string): Promise<PayrollRow[]> {
  const { data, error } = await supabase.from('payroll_entries')
    .select('id, tenant_id, employee_id, employee_name, period_label, base_salary, bonuses, deductions, net_pay, status, paid_at, notes, created_at')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PayrollRow[]
}

export async function createPayrollEntry(tenantId: string, input: { employee_id?: string | null; employee_name: string; period_label: string; base_salary: number; bonuses?: number; deductions?: number; notes?: string | null }): Promise<void> {
  const net = Number(input.base_salary || 0) + Number(input.bonuses || 0) - Number(input.deductions || 0)
  const { error } = await supabase.from('payroll_entries').insert({
    tenant_id: tenantId, status: 'DRAFT', net_pay: net,
    bonuses: input.bonuses ?? 0, deductions: input.deductions ?? 0, ...cleanInput(input),
  })
  if (error) throw error
}

export async function markPayrollPaid(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('payroll_entries').update({ status: 'PAID', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}
