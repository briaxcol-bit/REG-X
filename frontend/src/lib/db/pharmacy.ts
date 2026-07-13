/**
 * REG-X — Capa de datos Supabase · dominio: pharmacy
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { cleanInput } from './purchasing'
import { seqCode } from './retail'

// ══════════════════════════════════════════════════════════════
// MÓDULOS FARMACIA: Catálogo de Medicamentos, Lotes,
// Vencimientos y Recetas
// ══════════════════════════════════════════════════════════════
// ── Catálogo de Medicamentos (drug_catalog) ───────────────────
export interface DrugRow {
  id: string
  tenant_id: string
  product_id: string | null
  name: string
  active_ingredient: string | null
  concentration: string | null
  pharma_form: string | null
  invima_reg: string | null
  atc_code: string | null
  requires_prescription: boolean
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface DrugInput {
  name: string
  active_ingredient?: string | null
  concentration?: string | null
  pharma_form?: string | null
  invima_reg?: string | null
  atc_code?: string | null
  requires_prescription?: boolean
  product_id?: string | null
  notes?: string | null
}

export const DRUG_COLS = 'id, tenant_id, product_id, name, active_ingredient, concentration, pharma_form, invima_reg, atc_code, requires_prescription, notes, is_active, created_at'

export async function getDrugs(tenantId: string, opts?: { search?: string; includeInactive?: boolean }): Promise<DrugRow[]> {
  let q = supabase.from('drug_catalog').select(DRUG_COLS).eq('tenant_id', tenantId).is('deleted_at', null).order('name', { ascending: true })
  if (!opts?.includeInactive) q = q.eq('is_active', true)
  if (opts?.search?.trim()) q = q.or(`name.ilike.%${opts.search.trim()}%,active_ingredient.ilike.%${opts.search.trim()}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as DrugRow[]
}

export async function createDrug(tenantId: string, input: DrugInput): Promise<DrugRow> {
  const { data, error } = await supabase.from('drug_catalog').insert({ tenant_id: tenantId, is_active: true, ...cleanInput(input) }).select(DRUG_COLS).single()
  if (error) throw error
  return data as unknown as DrugRow
}

export async function updateDrug(tenantId: string, id: string, input: DrugInput): Promise<void> {
  const { error } = await supabase.from('drug_catalog').update({ ...cleanInput(input), updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function toggleDrugActive(tenantId: string, id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('drug_catalog').update({ is_active: active, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deleteDrug(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('drug_catalog').update({ deleted_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Lotes (product_batches) ───────────────────────────────────
export interface BatchRow {
  id: string
  tenant_id: string
  product_id: string
  supplier_id: string | null
  batch_number: string
  expiry_date: string | null
  quantity: number
  cost: number | null
  received_at: string
  notes: string | null
  created_at: string
  products?: { name: string; sku: string } | null
  suppliers?: { name: string } | null
}

export interface BatchInput {
  product_id: string
  supplier_id?: string | null
  batch_number: string
  expiry_date?: string | null
  quantity: number
  cost?: number | null
  received_at?: string
  notes?: string | null
}

export const BATCH_COLS = 'id, tenant_id, product_id, supplier_id, batch_number, expiry_date, quantity, cost, received_at, notes, created_at, products(name, sku), suppliers(name)'

export async function getBatches(tenantId: string, filters?: { productId?: string }): Promise<BatchRow[]> {
  let q = supabase.from('product_batches').select(BATCH_COLS).eq('tenant_id', tenantId).is('deleted_at', null).order('expiry_date', { ascending: true, nullsFirst: false })
  if (filters?.productId) q = q.eq('product_id', filters.productId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as BatchRow[]
}

export async function createBatch(tenantId: string, input: BatchInput): Promise<BatchRow> {
  const { data, error } = await supabase.from('product_batches').insert({ tenant_id: tenantId, ...cleanInput(input) }).select(BATCH_COLS).single()
  if (error) throw error
  return data as unknown as BatchRow
}

export async function updateBatch(tenantId: string, id: string, input: Partial<BatchInput>): Promise<void> {
  const { error } = await supabase.from('product_batches').update({ ...cleanInput(input), updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export async function deleteBatch(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('product_batches').update({ deleted_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

/** Lotes con existencia que vencen dentro de `days` días (incluye ya vencidos). */
export async function getExpiringBatches(tenantId: string, days: number): Promise<BatchRow[]> {
  const threshold = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('product_batches')
    .select(BATCH_COLS)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .gt('quantity', 0)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', threshold)
    .order('expiry_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as BatchRow[]
}

// ── Recetas Médicas (prescriptions) ───────────────────────────
export type PrescriptionStatus = 'DRAFT' | 'VALIDATED' | 'DISPENSED' | 'CANCELLED'

export interface PrescriptionItemInput {
  drug_id?: string | null
  product_id?: string | null
  description: string
  dosage?: string | null
  quantity: number
}

export interface PrescriptionItemRow extends PrescriptionItemInput { id: string }

export interface PrescriptionRow {
  id: string
  tenant_id: string
  customer_id: string | null
  code: string
  patient_name: string
  doctor_name: string | null
  doctor_license: string | null
  prescription_date: string
  diagnosis: string | null
  status: PrescriptionStatus
  notes: string | null
  created_at: string
  customers?: { full_name: string } | null
  prescription_items?: PrescriptionItemRow[]
}

export async function getPrescriptions(tenantId: string, filters?: { status?: PrescriptionStatus }): Promise<PrescriptionRow[]> {
  let q = supabase
    .from('prescriptions')
    .select('id, tenant_id, customer_id, code, patient_name, doctor_name, doctor_license, prescription_date, diagnosis, status, notes, created_at, customers(full_name)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('prescription_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as PrescriptionRow[]
}

export async function getPrescription(tenantId: string, id: string): Promise<PrescriptionRow> {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('id, tenant_id, customer_id, code, patient_name, doctor_name, doctor_license, prescription_date, diagnosis, status, notes, created_at, customers(full_name), prescription_items(id, drug_id, product_id, description, dosage, quantity)')
    .eq('tenant_id', tenantId).eq('id', id).single()
  if (error) throw error
  return data as unknown as PrescriptionRow
}

export async function createPrescription(
  tenantId: string,
  header: { patient_name: string; doctor_name?: string | null; doctor_license?: string | null; prescription_date: string; diagnosis?: string | null; customer_id?: string | null; branch_id?: string | null; notes?: string | null },
  items: PrescriptionItemInput[],
): Promise<string> {
  const { data, error } = await supabase
    .from('prescriptions')
    .insert({ tenant_id: tenantId, code: seqCode('RX'), status: 'DRAFT', ...cleanInput(header) })
    .select('id').single()
  if (error) throw error
  const rxId = (data as any).id as string
  if (items.length) {
    const rows = items.filter((i) => i.description.trim()).map((it) => ({
      tenant_id: tenantId, prescription_id: rxId,
      drug_id: it.drug_id ?? null, product_id: it.product_id ?? null,
      description: it.description, dosage: it.dosage ?? null, quantity: it.quantity,
    }))
    if (rows.length) {
      const { error: itErr } = await supabase.from('prescription_items').insert(rows)
      if (itErr) throw itErr
    }
  }
  return rxId
}

export async function updatePrescriptionStatus(tenantId: string, id: string, status: PrescriptionStatus): Promise<void> {
  const { error } = await supabase.from('prescriptions').update({ status, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}
