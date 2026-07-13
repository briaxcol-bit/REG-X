/**
 * REG-X — Capa de datos Supabase · dominio: billing
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'

// -- Subscriptions / Plans (SUPER_ADMIN) ----------------------
export type PlanCode = 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'

export interface PlanRow {
  code:        PlanCode
  name:        string
  description: string | null
  price:       number
  currency:    string
  features:    string[]
  is_active:   boolean
  sort_order:  number
}

export interface SubscriptionRow {
  id:                   string
  plan:                 PlanCode
  status:               string
  price:                number
  currency:             string
  current_period_start: string | null
  current_period_end:   string | null
}

export interface TenantSubscriptionRow {
  id:            string
  name:          string
  slug:          string
  plan:          PlanCode
  is_active:     boolean
  subscriptions?: SubscriptionRow[]
}

/** Catálogo de planes (para el panel de plataforma). Incluye ocultos. */
export async function getPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('code, name, description, price, currency, features, is_active, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    code:        p.code,
    name:        p.name,
    description: p.description ?? null,
    price:       Number(p.price ?? 0),
    currency:    p.currency ?? 'COP',
    features:    Array.isArray(p.features) ? p.features : [],
    is_active:   p.is_active ?? true,
    sort_order:  p.sort_order ?? 0,
  })) as PlanRow[]
}

/** Cambia el precio (y opcionalmente moneda) de un plan. */
export async function setPlanPrice(code: string, price: number, currency?: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('set_plan_price', {
    p_code: code, p_price: price, p_currency: currency ?? null,
  })
  if (error) throw error
}

/** Actualiza la lista de características de un plan. */
export async function setPlanFeatures(code: string, features: string[]): Promise<void> {
  const { error } = await supabase
    .from('plans')
    .update({ features, updated_at: new Date().toISOString() })
    .eq('code', code)
  if (error) throw error
}

/** Activa u oculta un plan del catálogo. */
export async function setPlanActive(code: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('plans')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('code', code)
  if (error) throw error
}

/** Crea un plan nuevo en el catálogo. */
export async function createPlan(input: {
  code: string
  name: string
  description?: string
  price: number
  currency: string
  features: string[]
}): Promise<void> {
  const { error } = await (supabase.rpc as any)('create_plan', {
    p_code:        input.code,
    p_name:        input.name,
    p_description: input.description ?? null,
    p_price:       input.price,
    p_currency:    input.currency,
    p_features:    input.features,
    p_sort_order:  99,
  })
  if (error) throw error
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

export interface AdminPaymentRow extends PaymentTxRow {
  tenant_id: string
  tenant_name: string | null
  applied_at: string | null
}

/**
 * Historial de pagos de TODOS los tenants (solo super admin).
 * Requiere la policy `payment_tx_select_superadmin` (migración 027).
 * Lanza si la tabla no existe todavía (migración 025 sin aplicar).
 */
export async function getAllPayments(limit = 200): Promise<AdminPaymentRow[]> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('id, tenant_id, reference, plan_code, amount_in_cents, currency, status, wompi_transaction_id, applied_at, created_at, tenants ( name )')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    ...r,
    tenant_name: r.tenants?.name ?? null,
  })) as unknown as AdminPaymentRow[]
}
