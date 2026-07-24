/**
 * REG-X — Capa de datos Supabase · dominio: core
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'

export interface TenantRow {
  id: string
  name: string
  slug: string
  plan: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  business_type: string
  logo_url: string | null
  primary_color: string | null
  country: string
  currency: string
  timezone: string
}

export interface BranchRow {
  id: string
  tenant_id: string
  name: string
  code: string
  currency: string | null
  timezone: string | null
  is_main: boolean
}

export interface UserTenantRoleRow {
  user_id: string
  tenant_id: string
  branch_id: string | null
  role: string
}

// ── Auth / Tenant Resolution ───────────────────────────────────
export async function resolveUserContext(userId: string) {
  // 1+2. Perfil y rol en paralelo (menos round-trips en redes lentas)
  const [{ data: profile }, { data: role }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, full_name, avatar_url, platform_role')
      .eq('id', userId)
      .single(),
    supabase
      .from('user_tenant_roles')
      .select('tenant_id, branch_id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single(),
  ])

  // No retornar null si no hay rol de tenant: el usuario puede ser SUPER_ADMIN de plataforma
  if (!role) return { profile, role: null, tenant: null, branch: null }

  // 3+4. Tenant y branch en paralelo
  const [{ data: tenant }, { data: branch }] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, name, slug, plan, business_type, logo_url, primary_color, secondary_color, currency, country, timezone')
      .eq('id', role.tenant_id)
      .single(),
    role.branch_id
      ? supabase
          .from('branches')
          .select('id, name, code, currency, timezone')
          .eq('id', role.branch_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  return { profile, role, tenant, branch }
}
