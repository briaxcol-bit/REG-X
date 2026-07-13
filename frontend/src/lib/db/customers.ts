/**
 * REG-X — Capa de datos Supabase · dominio: customers
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'

export interface CustomerRow {
  id:            string
  tenant_id:     string
  person_type:   'NATURAL' | 'EMPRESA'
  doc_type:      string
  regime:        'SIMPLIFICADO' | 'COMUN'
  full_name:     string
  business_name: string | null
  email:         string | null
  phone:         string | null
  tax_id:        string | null
  address:       { city?: string; department?: string; street?: string } | null
  loyalty_points: number
  price_list_id: string | null
  created_at:    string
}

// ── Customers ──────────────────────────────────────────────────
export const CUSTOMER_SELECT = 'id, tenant_id, person_type, doc_type, regime, full_name, business_name, email, phone, tax_id, address, loyalty_points, price_list_id, created_at'

export async function getCustomers(
  tenantId: string,
  params?: { search?: string; limit?: number },
): Promise<CustomerRow[]> {
  let q = supabase
    .from('customers')
    .select(CUSTOMER_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('full_name')

  if (params?.search) {
    q = q.or(
      `full_name.ilike.%${params.search}%,business_name.ilike.%${params.search}%,email.ilike.%${params.search}%,phone.ilike.%${params.search}%,tax_id.ilike.%${params.search}%`,
    )
  }

  if (params?.limit) q = q.limit(params.limit)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CustomerRow[]
}

export interface CustomerInput {
  person_type:   'NATURAL' | 'EMPRESA'
  doc_type:      string
  regime:        'SIMPLIFICADO' | 'COMUN'
  full_name:     string
  business_name?: string | null
  email?:        string | null
  phone?:        string | null
  tax_id?:       string | null
  address?:      { city?: string; department?: string; street?: string } | null
  /** Lista de precios asignada (el POS la aplica automáticamente) */
  price_list_id?: string | null
}

export async function createCustomer(
  tenantId: string,
  branchId: string,
  data: CustomerInput,
) {
  const { data: row, error } = await supabase
    .from('customers')
    .insert({ ...data, tenant_id: tenantId, branch_id: branchId })
    .select(CUSTOMER_SELECT)
    .single()
  if (error) throw error
  return row
}

export async function getCustomerById(customerId: string): Promise<CustomerRow | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_SELECT)
    .eq('id', customerId)
    .single()
  if (error) return null
  return data as CustomerRow
}

export async function updateCustomer(
  customerId: string,
  data: CustomerInput,
) {
  const { data: row, error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', customerId)
    .select(CUSTOMER_SELECT)
    .single()
  if (error) throw error
  return row
}
