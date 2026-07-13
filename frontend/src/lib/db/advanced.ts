/**
 * REG-X — Capa de datos Supabase · dominio: advanced
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { cleanInput } from './purchasing'

// ══════════════════════════════════════════════════════════════
// MÓDULOS AVANZADOS: Multi-Sucursal, Webhooks/API, Auditoría
// (Tienda en Línea usa tenants.settings, sin funciones nuevas)
// ══════════════════════════════════════════════════════════════
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomHex(nBytes: number): string {
  const arr = new Uint8Array(nBytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Multi-Sucursal (branches) ─────────────────────────────────
export interface BranchAdminRow {
  id: string
  tenant_id: string
  name: string
  code: string
  phone: string | null
  email: string | null
  address: { city?: string; department?: string; street?: string } | null
  is_main: boolean
  is_active: boolean
  created_at: string
}

export interface BranchInput {
  name: string
  code: string
  phone?: string | null
  email?: string | null
  address?: { city?: string; department?: string; street?: string } | null
}

export const BRANCH_COLS = 'id, tenant_id, name, code, phone, email, address, is_main, is_active, created_at'

export async function getBranches(tenantId: string): Promise<BranchAdminRow[]> {
  const { data, error } = await supabase.from('branches').select(BRANCH_COLS)
    .eq('tenant_id', tenantId).is('deleted_at', null).order('is_main', { ascending: false }).order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as BranchAdminRow[]
}

export async function createBranch(tenantId: string, input: BranchInput): Promise<BranchAdminRow> {
  const { data, error } = await supabase.from('branches')
    .insert({ tenant_id: tenantId, is_main: false, is_active: true, ...cleanInput(input) })
    .select(BRANCH_COLS).single()
  if (error) throw error
  return data as unknown as BranchAdminRow
}

export async function updateBranch(tenantId: string, id: string, input: Partial<BranchInput>): Promise<void> {
  const { error } = await supabase.from('branches').update({ ...cleanInput(input), updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function toggleBranchActive(tenantId: string, id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('branches').update({ is_active: active, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deleteBranch(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('branches').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('tenant_id', tenantId).eq('id', id).eq('is_main', false)
  if (error) throw error
}

// ── Webhooks (webhook_endpoints) ──────────────────────────────
export interface WebhookRow {
  id: string
  url: string
  events: string[]
  active: boolean
  created_at: string
}

export async function getWebhookEndpoints(tenantId: string): Promise<WebhookRow[]> {
  const { data, error } = await supabase.from('webhook_endpoints')
    .select('id, url, events, active, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as WebhookRow[]
}

export async function createWebhookEndpoint(tenantId: string, input: { url: string; events: string[] }): Promise<void> {
  const { error } = await supabase.from('webhook_endpoints').insert({
    tenant_id: tenantId, url: input.url.trim(), events: input.events, secret: `whsec_${randomHex(24)}`, active: true,
  })
  if (error) throw error
}

export async function setWebhookActive(tenantId: string, id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('webhook_endpoints').update({ active, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deleteWebhookEndpoint(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('webhook_endpoints').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── API Keys ──────────────────────────────────────────────────
export interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

export async function getApiKeys(tenantId: string): Promise<ApiKeyRow[]> {
  const { data, error } = await supabase.from('api_keys')
    .select('id, name, key_prefix, scopes, is_active, last_used_at, created_at')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ApiKeyRow[]
}

/** Crea una API key. Devuelve la clave EN CLARO una sola vez (no se vuelve a mostrar). */
export async function createApiKey(tenantId: string, name: string): Promise<string> {
  const raw = `regx_${randomHex(24)}`
  const key_hash = await sha256Hex(raw)
  const key_prefix = raw.slice(0, 10)
  const { error } = await supabase.from('api_keys').insert({ tenant_id: tenantId, name: name.trim(), key_hash, key_prefix, is_active: true })
  if (error) throw error
  return raw
}

export async function revokeApiKey(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('api_keys').update({ is_active: false }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Auditoría (audit_logs) ────────────────────────────────────
export interface AuditLogRow {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  created_at: string
}

export async function getAuditLogs(tenantId: string, filters?: { action?: string; resourceType?: string; limit?: number }): Promise<AuditLogRow[]> {
  let q = supabase.from('audit_logs')
    .select('id, user_id, action, resource_type, resource_id, created_at')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(filters?.limit ?? 200)
  if (filters?.action) q = q.eq('action', filters.action)
  if (filters?.resourceType) q = q.eq('resource_type', filters.resourceType)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as AuditLogRow[]
}
