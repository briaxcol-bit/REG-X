/**
 * REG-X — Capa de datos Supabase · dominio: automations
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { PayrollRow } from './finance'

// ══════════════════════════════════════════════════════════════
// AUTOMATIZACIONES ENTRE MÓDULOS (migraciones 039–044)
// Todas son RPCs transaccionales: o pasa todo, o no pasa nada.
// ══════════════════════════════════════════════════════════════
/** Recibe una orden de compra: entrada de stock + cuenta por pagar + lotes. */
export async function receivePurchaseOrder(tenantId: string, poId: string): Promise<void> {
  const { error } = await (supabase.rpc as any)('receive_purchase_order', {
    p_tenant: tenantId, p_po_id: poId,
  })
  if (error) throw error
}

/** Convierte una cotización en venta PENDING (se cobra en el POS). */
export async function convertQuoteToSale(tenantId: string, quoteId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('convert_quote_to_sale', {
    p_tenant: tenantId, p_quote_id: quoteId,
  })
  if (error) throw error
  return data as string
}

/** Apartado totalmente abonado → venta COMPLETED real (descuenta stock). */
export async function completeLayaway(tenantId: string, layawayId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('complete_layaway', {
    p_tenant: tenantId, p_layaway_id: layawayId,
  })
  if (error) throw error
  return data as string
}

/** Orden de trabajo terminada → venta PENDING para cobrar en el POS. */
export async function invoiceWorkOrder(tenantId: string, workOrderId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('invoice_work_order', {
    p_tenant: tenantId, p_wo_id: workOrderId,
  })
  if (error) throw error
  return data as string
}

/** Genera borradores de nómina desde asistencia + comisiones + propinas. */
export async function generatePayrollDraft(
  tenantId: string,
  from: string,
  to: string,
  periodLabel: string,
): Promise<PayrollRow[]> {
  const { data, error } = await (supabase.rpc as any)('generate_payroll_draft', {
    p_tenant: tenantId, p_from: from, p_to: to, p_label: periodLabel,
  })
  if (error) throw error
  return (data ?? []) as PayrollRow[]
}

/** Salario base del empleado (usado por generate_payroll_draft). */
export async function setEmployeeBaseSalary(
  tenantId: string,
  userId: string,
  baseSalary: number,
): Promise<void> {
  const { error } = await supabase
    .from('user_tenant_roles')
    .update({ base_salary: baseSalary })
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
  if (error) throw error
}

/** Vincula un cliente a una lista de precios (migración 044). */
export async function setCustomerPriceList(
  tenantId: string,
  customerId: string,
  priceListId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ price_list_id: priceListId })
    .eq('tenant_id', tenantId)
    .eq('id', customerId)
  if (error) throw error
}
