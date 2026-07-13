/**
 * REG-X — Capa de datos Supabase · dominio: inventory
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'

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
