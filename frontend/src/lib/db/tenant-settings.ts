/**
 * REG-X — Capa de datos Supabase · dominio: tenant-settings
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'

// ── Self-service del dueño (OWNER/ADMIN) ──────────────────────
// La política RLS "tenants_update" ya permite que OWNER/ADMIN editen
// su propio tenant, y "subscriptions_select" / "plans_read" permiten
// leer su suscripción y el catálogo de planes. No requieren RPC.
export interface TenantAddress {
  street?: string
  city?: string
  department?: string
  country?: string
  postal_code?: string
}

export interface ReceiptSettings {
  header?: string
  footer?: string
  show_logo?: boolean
  show_tax_id?: boolean
  phone?: string
}

export interface NotificationSettings {
  low_stock?: boolean
  cash_close?: boolean
  expiry_alerts?: boolean
  daily_summary?: boolean
  new_sale?: boolean
}

export interface GeneralSettings {
  currency?: string
  timezone?: string
  locale?: string
}

export interface TenantSettings {
  general?: GeneralSettings
  receipt?: ReceiptSettings
  notifications?: NotificationSettings
  [key: string]: unknown
}

export interface MyTenantRow {
  id: string
  name: string
  slug: string
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  business_type: string
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  country: string | null
  currency: string | null
  timezone: string | null
  locale: string | null
  tax_id: string | null
  address: TenantAddress | null
  settings: TenantSettings | null
  is_active: boolean
}

/** Lee los datos completos del tenant del usuario actual. */
export async function getMyTenant(tenantId: string): Promise<MyTenantRow> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, business_type, logo_url, primary_color, secondary_color, country, currency, timezone, locale, tax_id, address, settings, is_active')
    .eq('id', tenantId)
    .single()
  if (error) throw error
  return data as unknown as MyTenantRow
}

/** Campos que el dueño puede editar de su propia empresa (nunca plan/slug/is_active). */
export interface UpdateMyTenantInput {
  name?: string
  business_type?: string
  tax_id?: string | null
  address?: TenantAddress | null
  logo_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  currency?: string | null
  timezone?: string | null
  locale?: string | null
}

/** Actualiza los datos de la empresa. Usa RLS (owner/admin del tenant). */
export async function updateMyTenant(tenantId: string, patch: UpdateMyTenantInput): Promise<MyTenantRow> {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) clean[k] = v
  }
  clean.updated_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('tenants')
    .update(clean)
    .eq('id', tenantId)
    .select('id, name, slug, plan, business_type, logo_url, primary_color, secondary_color, country, currency, timezone, locale, tax_id, address, settings, is_active')
    .single()
  if (error) throw error
  return data as unknown as MyTenantRow
}

/** Mezcla y guarda el objeto settings (JSONB) del tenant. */
export async function updateMyTenantSettings(
  tenantId: string,
  current: TenantSettings | null,
  patch: TenantSettings,
): Promise<TenantSettings> {
  const merged: TenantSettings = {
    ...(current ?? {}),
    ...patch,
    general:       { ...(current?.general ?? {}),       ...(patch.general ?? {}) },
    receipt:       { ...(current?.receipt ?? {}),       ...(patch.receipt ?? {}) },
    notifications: { ...(current?.notifications ?? {}), ...(patch.notifications ?? {}) },
  }
  const { error } = await supabase
    .from('tenants')
    .update({ settings: merged, updated_at: new Date().toISOString() })
    .eq('id', tenantId)
  if (error) throw error
  return merged
}

/** Sube el logo del tenant a su carpeta (requiere política storage por tenant_id, migración 024). */
export async function uploadMyTenantLogo(tenantId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${tenantId}/logo-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('tenant-assets')
    .upload(path, file, { cacheControl: '3600', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path)
  return data.publicUrl
}

export interface MySubscriptionRow {
  id: string
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELLED'
  price: number
  currency: string
  current_period_start: string | null
  current_period_end: string | null
  trial_ends_at: string | null
}

/** Lee la suscripción vigente del tenant (la más reciente). */
export async function getMySubscription(tenantId: string): Promise<MySubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, plan, status, price, currency, current_period_start, current_period_end, trial_ends_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as MySubscriptionRow) ?? null
}

/** Devuelve los slugs de los módulos ACTIVOS del tenant (tenant_modules habilitados). */
export async function getMyModuleSlugs(tenantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenant_modules')
    .select('is_enabled, marketplace_modules ( slug )')
    .eq('tenant_id', tenantId)
    .eq('is_enabled', true)
  if (error) throw error
  const slugs = (data ?? [])
    .map((r: any) => r.marketplace_modules?.slug)
    .filter((s: unknown): s is string => typeof s === 'string')
  return slugs
}
