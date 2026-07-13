/**
 * REG-X — Capa de datos Supabase · dominio: promotions
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { cleanInput } from './purchasing'

// ── Promociones y Descuentos (módulo promotions) ──────────────
export type PromotionType = 'PERCENT' | 'FIXED' | 'BOGO' | 'COMBO'

export type PromotionScope = 'ALL' | 'CATEGORY' | 'PRODUCT'

export interface PromotionRow {
  id: string
  tenant_id: string
  name: string
  type: PromotionType
  value: number
  scope: PromotionScope
  category_id: string | null
  product_id: string | null
  min_qty: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
}

export interface PromotionInput {
  name: string
  type: PromotionType
  value: number
  scope: PromotionScope
  category_id?: string | null
  product_id?: string | null
  min_qty?: number
  starts_at?: string | null
  ends_at?: string | null
}

export async function getPromotions(tenantId: string): Promise<PromotionRow[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('id, tenant_id, name, type, value, scope, category_id, product_id, min_qty, starts_at, ends_at, is_active, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PromotionRow[]
}

export async function savePromotion(tenantId: string, input: PromotionInput, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('promotions').update(cleanInput(input)).eq('tenant_id', tenantId).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('promotions').insert({ tenant_id: tenantId, ...cleanInput(input) })
    if (error) throw error
  }
}

export async function togglePromotion(tenantId: string, id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('promotions').update({ is_active: active }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deletePromotion(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('promotions').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Fidelización (módulo loyalty) ─────────────────────────────
export interface LoyaltyConfig { tenant_id: string; currency_per_point: number; point_value: number; is_active: boolean }

export async function getLoyaltyConfig(tenantId: string): Promise<LoyaltyConfig | null> {
  const { data, error } = await supabase
    .from('loyalty_config')
    .select('tenant_id, currency_per_point, point_value, is_active')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as unknown as LoyaltyConfig | null
}

export async function saveLoyaltyConfig(tenantId: string, cfg: { currency_per_point: number; point_value: number; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from('loyalty_config').upsert({ tenant_id: tenantId, ...cfg, updated_at: new Date().toISOString() })
  if (error) throw error
}

export interface LoyaltyRewardRow { id: string; tenant_id: string; name: string; points_cost: number; is_active: boolean }

export async function getLoyaltyRewards(tenantId: string): Promise<LoyaltyRewardRow[]> {
  const { data, error } = await supabase
    .from('loyalty_rewards')
    .select('id, tenant_id, name, points_cost, is_active')
    .eq('tenant_id', tenantId)
    .order('points_cost', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as LoyaltyRewardRow[]
}

export async function saveLoyaltyReward(tenantId: string, input: { name: string; points_cost: number }, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('loyalty_rewards').update(cleanInput(input)).eq('tenant_id', tenantId).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('loyalty_rewards').insert({ tenant_id: tenantId, ...cleanInput(input) })
    if (error) throw error
  }
}

export async function deleteLoyaltyReward(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('loyalty_rewards').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export interface LoyaltyTxRow { id: string; customer_id: string; points: number; kind: 'EARN' | 'REDEEM' | 'ADJUST'; note: string | null; created_at: string }

export async function getLoyaltyTransactions(tenantId: string, limit = 60): Promise<LoyaltyTxRow[]> {
  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select('id, customer_id, points, kind, note, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as LoyaltyTxRow[]
}

/** Ajusta los puntos de un cliente (gana/redime/ajuste) y registra el movimiento. */
export async function adjustLoyaltyPoints(
  tenantId: string, customerId: string, points: number, kind: 'EARN' | 'REDEEM' | 'ADJUST', note?: string,
): Promise<void> {
  const { data: cust, error: e1 } = await supabase.from('customers').select('loyalty_points').eq('tenant_id', tenantId).eq('id', customerId).single()
  if (e1) throw e1
  const current = Number((cust as any)?.loyalty_points ?? 0)
  const next = Math.max(0, current + points)
  const { error: e2 } = await supabase.from('customers').update({ loyalty_points: next }).eq('tenant_id', tenantId).eq('id', customerId)
  if (e2) throw e2
  const { error: e3 } = await supabase.from('loyalty_transactions').insert({ tenant_id: tenantId, customer_id: customerId, points, kind, note: note ?? null })
  if (e3) throw e3
}
