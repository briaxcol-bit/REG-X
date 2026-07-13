/**
 * REG-X — Capa de datos Supabase · dominio: platform
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'

// -- Platform-level queries (SUPER_ADMIN only) ----------------
export interface PlatformStats {
  totalTenants: number
  activeTenants: number
  activeSubscriptions: number
  mrr: number
  totalUsers: number
  newThisMonth: number
  planBreakdown: { plan: string; count: number }[]
}

export interface PlatformTenantRow {
  id: string
  name: string
  slug: string
  plan: string
  business_type: string
  is_active: boolean
  country: string
  created_at: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  subscriptions: { status: string; plan: string; price: number; currency: string; current_period_end: string | null }[]
}

export interface PlatformUserRow {
  id: string
  full_name: string | null
  platform_role: string | null
  created_at: string
  user_tenant_roles: { role: string; is_active: boolean; tenants: { name: string } | null }[]
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ data: tenants, error: errT }, { data: subs, error: errS }, { data: users, error: errU }] = await Promise.all([
    supabase.from('tenants').select('id, plan, is_active, created_at'),
    supabase.from('subscriptions').select('id, status, plan, price, currency'),
    supabase.from('user_profiles').select('id'),
  ])

  if (errT) console.error("Error fetching tenants for stats:", errT)
  if (errS) console.error("Error fetching subs for stats:", errS)
  if (errU) console.error("Error fetching users for stats:", errU)

  const tList = tenants ?? []
  const sList = subs ?? []

  const planBreakdownMap: Record<string, number> = {}
  for (const t of tList) {
    planBreakdownMap[t.plan] = (planBreakdownMap[t.plan] ?? 0) + 1
  }

  return {
    totalTenants:        tList.length,
    activeTenants:       tList.filter((t) => t.is_active).length,
    activeSubscriptions: sList.filter((s) => s.status === 'ACTIVE').length,
    mrr:                 sList.filter((s) => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.price ?? 0), 0),
    totalUsers:          (users ?? []).length,
    newThisMonth:        tList.filter((t) => t.created_at >= monthStart).length,
    planBreakdown:       Object.entries(planBreakdownMap).map(([plan, count]) => ({ plan, count })),
  }
}

export async function getAllTenants(): Promise<PlatformTenantRow[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, business_type, is_active, country, created_at, logo_url, primary_color, secondary_color, subscriptions (status, plan, price, currency, current_period_end)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error("SUPABASE ERROR IN getAllTenants:", error)
    throw error
  }
  return (data ?? []) as PlatformTenantRow[]
}

export async function getAllPlatformUsers(): Promise<PlatformUserRow[]> {
  // user_profiles y user_tenant_roles no tienen FK directa entre sí (ambas
  // referencian auth.users), por eso no se puede embeber una en la otra.
  // Se consultan por separado y se unen en memoria.
  const [profilesRes, rolesRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, full_name, platform_role, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_tenant_roles')
      .select('user_id, role, is_active, tenants (name)'),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (rolesRes.error) throw rolesRes.error

  const rolesByUser = new Map<string, any[]>()
  for (const r of (rolesRes.data ?? []) as any[]) {
    const arr = rolesByUser.get(r.user_id) ?? []
    arr.push({ role: r.role, is_active: r.is_active, tenants: r.tenants })
    rolesByUser.set(r.user_id, arr)
  }

  return ((profilesRes.data ?? []) as any[]).map((p) => ({
    id:            p.id,
    full_name:     p.full_name,
    platform_role: p.platform_role,
    created_at:    p.created_at,
    user_tenant_roles: rolesByUser.get(p.id) ?? [],
  })) as unknown as PlatformUserRow[]
}

// -- Platform mutations (SUPER_ADMIN only, via RPC) ------------
export interface CreateTenantInput {
  name:           string
  slug:           string
  business_type:  string
  plan:           string
  country:        string
  currency:       string
  owner_email:    string
  owner_name:     string
  owner_password: string
  timezone?:      string
  locale?:        string
  logo_url?:       string
  primary_color?:  string
  secondary_color?: string
}

export interface UpdateTenantInput {
  name?:            string
  slug?:            string
  business_type?:   string
  logo_url?:        string
  primary_color?:   string
  secondary_color?: string
  country?:         string
  currency?:        string
}

export interface CreateTenantResult {
  tenant_id:   string
  branch_id:   string
  owner_id:    string
  owner_email: string
}

/** Sube el logo del tenant a Supabase Storage y retorna la URL pública */
export async function uploadTenantLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
  
  const { data, error } = await supabase.storage
    .from('tenant-assets')
    .upload(`logos/${fileName}`, file, { cacheControl: '3600', upsert: false })

  if (error) throw error

  const { data: publicUrlData } = supabase.storage
    .from('tenant-assets')
    .getPublicUrl(`logos/${fileName}`)

  return publicUrlData.publicUrl
}

/** Crea un tenant + su sucursal/bodega/suscripcion + roles de negocio + usuario OWNER. */
export async function createTenantWithOwner(
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  const { data, error } = await (supabase.rpc as any)('create_tenant_with_owner', {
    p_name:            input.name,
    p_slug:            input.slug,
    p_business_type:   input.business_type,
    p_plan:            input.plan,
    p_country:         input.country,
    p_currency:        input.currency,
    p_owner_email:     input.owner_email,
    p_owner_name:      input.owner_name,
    p_owner_password:  input.owner_password,
    p_timezone:        input.timezone ?? 'America/Bogota',
    p_locale:          input.locale ?? 'es-CO',
    p_logo_url:        input.logo_url ?? null,
    p_primary_color:   input.primary_color ?? '#F20D18',
    p_secondary_color: input.secondary_color ?? '#111827',
  })
  if (error) throw error
  return data as CreateTenantResult
}

/** Actualiza el branding y datos editables de un tenant. */
export async function updateTenant(
  tenantId: string,
  input: UpdateTenantInput,
): Promise<void> {
  const { error } = await (supabase.rpc as any)('update_tenant_branding', {
    p_tenant_id:       tenantId,
    p_name:            input.name            ?? null,
    p_slug:            input.slug            ?? null,
    p_business_type:   input.business_type   ?? null,
    p_logo_url:        input.logo_url        ?? null,
    p_primary_color:   input.primary_color   ?? null,
    p_secondary_color: input.secondary_color ?? null,
    p_country:         input.country         ?? null,
    p_currency:        input.currency        ?? null,
  })
  if (error) throw error
}

/** Elimina permanentemente un tenant y todo su contenido (CASCADE). */
export async function deleteTenant(tenantId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('delete_tenant', {
    p_tenant_id: tenantId,
  })
  if (error) throw error
}

/** Cambia el plan de un tenant (sincroniza la suscripcion). */
export async function setTenantPlan(
  tenantId: string,
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE',
): Promise<void> {
  const { error } = await (supabase.rpc as any)('set_tenant_plan', {
    p_tenant_id: tenantId,
    p_plan: plan,
  })
  if (error) throw error
}

/** Activa o desactiva un tenant (y su suscripcion). */
export async function setTenantActive(tenantId: string, active: boolean): Promise<void> {
  const { error } = await (supabase.rpc as any)('set_tenant_active', {
    p_tenant_id: tenantId,
    p_active: active,
  })
  if (error) throw error
}
