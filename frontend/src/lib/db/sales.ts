/**
 * REG-X — Capa de datos Supabase · dominio: sales
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { SaleHistoryRow } from './pos'
import { PromotionRow } from './promotions'
import { PriceListItemRow } from './retail'

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
  /** Número de orden fijo (lo usa la cola offline para reintentos idempotentes) */
  order_number?: string
  /**
   * Si es TRUE, la función no lanza excepción cuando el stock queda negativo.
   * Usar en checkout de mesas de restaurante: la comida ya fue preparada.
   */
  skip_stock_check?: boolean
}

export async function createSale(
  tenantId: string,
  branchId: string,
  userId: string,
  payload: CreateSalePayload,
) {
  // Número de orden: fijo si viene de la cola offline (reintento idempotente),
  // generado si es una venta normal.
  const ts = Date.now().toString(36).toUpperCase()
  const orderNumber = payload.order_number ?? `ORD-${ts}`
  const saleStatus = payload.status ?? 'COMPLETED'

  // Venta atómica vía RPC: venta + ítems + pagos + descuento de stock en
  // UNA sola transacción de Postgres. Valida el tenant y frena stock negativo.
  // Ver database/migrations/039_sale_side_effects.sql (v3) y 040_sale_skip_stock_check.sql (v4).
  // Construir params base (3 parámetros — compatible con la función existente)
  // p_skip_stock_check solo se agrega cuando es true (requiere migración 040)
  const rpcParams: Record<string, unknown> = {
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
  }
  // Solo incluir p_skip_stock_check cuando es true (evita romper la firma de 3 params
  // en producción antes de que se ejecute la migración 040)
  if (payload.skip_stock_check) rpcParams.p_skip_stock_check = true

  const { data: saleId, error: rpcErr } = await supabase.rpc('create_sale_transaction', rpcParams as any)

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

// ── Datos de pricing para el POS (promos + listas de precios) ──
export interface PosPricingData {
  promotions: PromotionRow[]
  /** items de listas VOLUME (aplican a todos) */
  volumeItems: PriceListItemRow[]
  /** items de la lista del cliente seleccionado (si tiene) */
  customerItems: PriceListItemRow[]
}

export async function getPosPricingData(
  tenantId: string,
  customerId?: string | null,
): Promise<PosPricingData> {
  const today = new Date().toISOString().slice(0, 10)

  // Nota: NO encadenar dos .or() — genera query params duplicados que PostgREST rechaza.
  // Se traen todas las activas y se filtra por fecha en JS.
  const { data: promosRaw, error: pErr } = await supabase
    .from('promotions')
    .select()
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
  if (pErr) throw pErr
  const promos = (promosRaw ?? []).filter(p => {
    const startOk = !p.starts_at || p.starts_at <= today
    const endOk   = !p.ends_at   || p.ends_at   >= today
    return startOk && endOk
  })

  const { data: volLists, error: vErr } = await supabase
    .from('price_lists')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('list_type', 'VOLUME')
    .eq('is_active', true)
    .is('deleted_at', null)
  if (vErr) throw vErr

  let volumeItems: PriceListItemRow[] = []
  if ((volLists ?? []).length > 0) {
    const { data, error } = await supabase
      .from('price_list_items')
      .select()
      .eq('tenant_id', tenantId)
      .in('price_list_id', (volLists ?? []).map(l => l.id))
    if (error) throw error
    volumeItems = (data ?? []) as PriceListItemRow[]
  }
  let customerItems: PriceListItemRow[] = []
  if (customerId) {
    const { data: cust, error: cErr } = await supabase
      .from('customers')
      .select('price_list_id')
      .eq('tenant_id', tenantId)
      .eq('id', customerId)
      .single()
    if (!cErr && cust?.price_list_id) {
      const { data, error } = await supabase
        .from('price_list_items')
        .select()
        .eq('tenant_id', tenantId)
        .eq('price_list_id', cust.price_list_id)
      if (error) throw error
      customerItems = (data ?? []) as PriceListItemRow[]
    }
  }

  return { promotions: promos as PromotionRow[], volumeItems, customerItems }
}
