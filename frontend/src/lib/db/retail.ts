/**
 * REG-X — Capa de datos Supabase · dominio: retail
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { cleanInput } from './purchasing'

// ══════════════════════════════════════════════════════════════
// MÓDULOS RETAIL: Órdenes de Compra, Listas de Precios,
// Tarjetas de Regalo y Apartados
// ══════════════════════════════════════════════════════════════
export const randomCode = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

export const seqCode = (prefix: string) => `${prefix}-${Date.now().toString().slice(-8)}`

// ── Listas de Precios (price_lists) ───────────────────────────
export type PriceListType = 'CUSTOMER' | 'CHANNEL' | 'VOLUME'

export interface PriceListRow {
  id: string
  tenant_id: string
  name: string
  list_type: PriceListType
  description: string | null
  is_active: boolean
  created_at: string
}

export interface PriceListItemRow {
  id: string
  price_list_id: string
  product_id: string
  min_qty: number
  price: number
  products?: { name: string; sku: string } | null
}

export async function getPriceLists(tenantId: string): Promise<PriceListRow[]> {
  const { data, error } = await supabase
    .from('price_lists')
    .select('id, tenant_id, name, list_type, description, is_active, created_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PriceListRow[]
}

export async function createPriceList(tenantId: string, input: { name: string; list_type: PriceListType; description?: string | null }): Promise<PriceListRow> {
  const { data, error } = await supabase
    .from('price_lists')
    .insert({ tenant_id: tenantId, is_active: true, ...cleanInput(input) })
    .select('id, tenant_id, name, list_type, description, is_active, created_at')
    .single()
  if (error) throw error
  return data as unknown as PriceListRow
}

export async function updatePriceList(tenantId: string, id: string, input: { name?: string; list_type?: PriceListType; description?: string | null; is_active?: boolean }): Promise<void> {
  const { error } = await supabase
    .from('price_lists')
    .update({ ...cleanInput(input), updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export async function deletePriceList(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('price_lists')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export async function getPriceListItems(tenantId: string, listId: string): Promise<PriceListItemRow[]> {
  const { data, error } = await supabase
    .from('price_list_items')
    .select('id, price_list_id, product_id, min_qty, price, products(name, sku)')
    .eq('tenant_id', tenantId)
    .eq('price_list_id', listId)
    .order('min_qty', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as PriceListItemRow[]
}

export async function upsertPriceListItem(
  tenantId: string,
  listId: string,
  input: { product_id: string; min_qty: number; price: number },
): Promise<void> {
  const { error } = await supabase
    .from('price_list_items')
    .upsert(
      { tenant_id: tenantId, price_list_id: listId, ...input },
      { onConflict: 'price_list_id,product_id,min_qty' },
    )
  if (error) throw error
}

export async function deletePriceListItem(tenantId: string, itemId: string): Promise<void> {
  const { error } = await supabase.from('price_list_items').delete().eq('tenant_id', tenantId).eq('id', itemId)
  if (error) throw error
}

// ── Tarjetas de Regalo (gift_cards) ───────────────────────────
export type GiftCardStatus = 'ACTIVE' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED'

export interface GiftCardRow {
  id: string
  tenant_id: string
  code: string
  initial_balance: number
  balance: number
  currency: string
  status: GiftCardStatus
  customer_id: string | null
  expires_at: string | null
  notes: string | null
  created_at: string
  customers?: { full_name: string } | null
}

export interface GiftCardTxRow {
  id: string
  type: 'ISSUE' | 'REDEEM' | 'ADJUST' | 'CANCEL'
  amount: number
  note: string | null
  created_at: string
}

export async function getGiftCards(tenantId: string, filters?: { search?: string; status?: GiftCardStatus }): Promise<GiftCardRow[]> {
  let q = supabase
    .from('gift_cards')
    .select('id, tenant_id, code, initial_balance, balance, currency, status, customer_id, expires_at, notes, created_at, customers(full_name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.search?.trim()) q = q.ilike('code', `%${filters.search.trim()}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as GiftCardRow[]
}

export async function createGiftCard(
  tenantId: string,
  input: { code?: string; initial_balance: number; currency?: string; customer_id?: string | null; expires_at?: string | null; notes?: string | null },
): Promise<GiftCardRow> {
  const code = input.code?.trim() || randomCode('GC')
  const { data, error } = await supabase
    .from('gift_cards')
    .insert({
      tenant_id: tenantId,
      code,
      initial_balance: input.initial_balance,
      balance: input.initial_balance,
      currency: input.currency ?? 'COP',
      status: 'ACTIVE',
      customer_id: input.customer_id ?? null,
      expires_at: input.expires_at ?? null,
      notes: input.notes ?? null,
    })
    .select('id, tenant_id, code, initial_balance, balance, currency, status, customer_id, expires_at, notes, created_at, customers(full_name)')
    .single()
  if (error) throw error
  const card = data as unknown as GiftCardRow
  await supabase.from('gift_card_transactions').insert({
    tenant_id: tenantId, gift_card_id: card.id, type: 'ISSUE', amount: input.initial_balance, note: 'Emisión',
  })
  return card
}

export async function redeemGiftCard(tenantId: string, id: string, amount: number, note?: string): Promise<void> {
  const { data: card, error: readErr } = await supabase
    .from('gift_cards').select('balance, status').eq('tenant_id', tenantId).eq('id', id).single()
  if (readErr) throw readErr
  if ((card as any).status !== 'ACTIVE') throw new Error('La tarjeta no está activa')
  const bal = Number((card as any).balance)
  if (amount <= 0) throw new Error('Monto inválido')
  if (amount > bal) throw new Error('Saldo insuficiente')
  const newBal = bal - amount
  const { error } = await supabase
    .from('gift_cards')
    .update({ balance: newBal, status: newBal === 0 ? 'REDEEMED' : 'ACTIVE', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
  await supabase.from('gift_card_transactions').insert({
    tenant_id: tenantId, gift_card_id: id, type: 'REDEEM', amount, note: note ?? null,
  })
}

export async function cancelGiftCard(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('gift_cards')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
  await supabase.from('gift_card_transactions').insert({ tenant_id: tenantId, gift_card_id: id, type: 'CANCEL', amount: 0, note: 'Anulada' })
}

export async function getGiftCardTransactions(tenantId: string, cardId: string): Promise<GiftCardTxRow[]> {
  const { data, error } = await supabase
    .from('gift_card_transactions')
    .select('id, type, amount, note, created_at')
    .eq('tenant_id', tenantId).eq('gift_card_id', cardId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as GiftCardTxRow[]
}

// ── Apartados (layaways) ──────────────────────────────────────
export type LayawayStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED'

export interface LayawayItemInput {
  product_id?: string | null
  description: string
  quantity: number
  unit_price: number
}

export interface LayawayItemRow extends LayawayItemInput { id: string; total: number }

export interface LayawayPaymentRow {
  id: string
  amount: number
  method: string
  note: string | null
  paid_at: string
}

export interface LayawayRow {
  id: string
  tenant_id: string
  branch_id: string | null
  customer_id: string | null
  code: string
  status: LayawayStatus
  total: number
  paid: number
  currency: string
  due_date: string | null
  notes: string | null
  created_at: string
  customers?: { full_name: string } | null
  layaway_items?: LayawayItemRow[]
  layaway_payments?: LayawayPaymentRow[]
}

export async function getLayaways(tenantId: string, filters?: { status?: LayawayStatus }): Promise<LayawayRow[]> {
  let q = supabase
    .from('layaways')
    .select('id, tenant_id, branch_id, customer_id, code, status, total, paid, currency, due_date, notes, created_at, customers(full_name)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as LayawayRow[]
}

export async function getLayaway(tenantId: string, id: string): Promise<LayawayRow> {
  const { data, error } = await supabase
    .from('layaways')
    .select('id, tenant_id, branch_id, customer_id, code, status, total, paid, currency, due_date, notes, created_at, customers(full_name), layaway_items(id, product_id, description, quantity, unit_price, total), layaway_payments(id, amount, method, note, paid_at)')
    .eq('tenant_id', tenantId).eq('id', id).single()
  if (error) throw error
  return data as unknown as LayawayRow
}

export async function createLayaway(
  tenantId: string,
  header: { customer_id?: string | null; due_date?: string | null; notes?: string | null; branch_id?: string | null; currency?: string },
  items: LayawayItemInput[],
  initialPayment?: { amount: number; method: string },
): Promise<string> {
  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0)
  const { data, error } = await supabase
    .from('layaways')
    .insert({ tenant_id: tenantId, code: seqCode('AP'), status: 'OPEN', total, paid: 0, currency: header.currency ?? 'COP', ...cleanInput(header) })
    .select('id')
    .single()
  if (error) throw error
  const layId = (data as any).id as string
  if (items.length) {
    const rows = items.map((it) => ({
      tenant_id: tenantId, layaway_id: layId, product_id: it.product_id ?? null,
      description: it.description, quantity: it.quantity, unit_price: it.unit_price,
      total: Number(it.quantity) * Number(it.unit_price),
    }))
    const { error: itErr } = await supabase.from('layaway_items').insert(rows)
    if (itErr) throw itErr
  }
  if (initialPayment && initialPayment.amount > 0) {
    await addLayawayPayment(tenantId, layId, initialPayment)
  }
  return layId
}

export async function addLayawayPayment(
  tenantId: string,
  id: string,
  input: { amount: number; method: string; note?: string | null },
): Promise<void> {
  if (input.amount <= 0) throw new Error('Monto inválido')
  const { data: lay, error: readErr } = await supabase
    .from('layaways').select('total, paid, status').eq('tenant_id', tenantId).eq('id', id).single()
  if (readErr) throw readErr
  if ((lay as any).status !== 'OPEN') throw new Error('El apartado no está abierto')
  const newPaid = Number((lay as any).paid) + input.amount
  const total = Number((lay as any).total)
  const { error: payErr } = await supabase.from('layaway_payments').insert({
    tenant_id: tenantId, layaway_id: id, amount: input.amount, method: input.method, note: input.note ?? null,
  })
  if (payErr) throw payErr
  const { error } = await supabase
    .from('layaways')
    .update({ paid: newPaid, status: newPaid >= total ? 'COMPLETED' : 'OPEN', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function updateLayawayStatus(tenantId: string, id: string, status: LayawayStatus): Promise<void> {
  const { error } = await supabase
    .from('layaways')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}
