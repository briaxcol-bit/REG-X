/**
 * REG-X — Capa de datos Supabase · dominio: hr
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'
import { cleanInput } from './purchasing'

// ── Employees ──────────────────────────────────────────────────
export type BusinessRole =
  | 'CASHIER'
  | 'WAITER'
  | 'CHEF'
  | 'BARTENDER'
  | 'ACCOUNTANT'
  | 'INVENTORY_MANAGER'
  | 'CUSTOM'

export const ROLE_CONFIG: Record<BusinessRole, { label: string; color: string; description: string }> = {
  CASHIER:           { label: 'Cajero',               color: 'bg-blue-500/10 text-blue-500',     description: 'Maneja ventas y POS' },
  WAITER:            { label: 'Mesero',               color: 'bg-teal-500/10 text-teal-500',     description: 'Atiende mesas y órdenes' },
  CHEF:              { label: 'Chef / Cocinero',      color: 'bg-orange-500/10 text-orange-500', description: 'Gestiona cocina y producción' },
  BARTENDER:         { label: 'Bartender',            color: 'bg-purple-500/10 text-purple-500', description: 'Maneja la barra' },
  ACCOUNTANT:        { label: 'Contador',             color: 'bg-yellow-500/10 text-yellow-500', description: 'Acceso a reportes y finanzas' },
  INVENTORY_MANAGER: { label: 'Gestor de Inventario', color: 'bg-emerald-500/10 text-emerald-500', description: 'Controla stock y movimientos' },
  CUSTOM:            { label: 'Personalizado',        color: 'bg-grafito-200 text-grafito-600',  description: 'Rol definido manualmente' },
}

export interface EmployeeRow {
  userId:     string
  role:       string
  isActive:   boolean
  branchId:   string | null
  fullName:   string | null
  avatarUrl:  string | null
  email:      string | null
  phone:      string | null
  cedula:     string | null
  customRole: string | null
  baseSalary: number
  createdAt:  string
}

export async function getEmployees(tenantId: string): Promise<EmployeeRow[]> {
  // Query roles
  const { data: roles, error: rolesErr } = await supabase
    .from('user_tenant_roles')
    .select('user_id, role, is_active, branch_id, base_salary, created_at')
    .eq('tenant_id', tenantId)
    .not('role', 'in', '(OWNER,ADMIN)')
    .order('created_at', { ascending: false })

  if (rolesErr) throw rolesErr
  if (!roles || roles.length === 0) return []

  // Query profiles separately (no FK between user_tenant_roles and user_profiles)
  const userIds = [...new Set(roles.map(r => r.user_id))]
  const { data: profiles, error: profErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url, phone, cedula, email')
    .in('id', userIds)

  if (profErr) throw profErr

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return roles.map(r => {
    const p = profileMap.get(r.user_id)
    return {
      userId:    r.user_id,
      role:      r.role,
      isActive:  r.is_active,
      branchId:  r.branch_id,
      fullName:  p?.full_name  ?? null,
      avatarUrl: p?.avatar_url ?? null,
      email:     p?.email      ?? null,
      phone:     p?.phone      ?? null,
      cedula:    p?.cedula     ?? null,
      customRole: null,
      baseSalary: Number((r as { base_salary?: number }).base_salary ?? 0),
      createdAt:  r.created_at,
    }
  })
}

export async function updateEmployeeRole(
  tenantId: string,
  userId: string,
  role: BusinessRole,
): Promise<void> {
  const { error } = await supabase
    .from('user_tenant_roles')
    .update({ role })
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function addEmployee(input: {
  email:      string
  fullName:   string
  password:   string
  role:       BusinessRole
  tenantId:   string
  branchId?:  string | null
  phone?:     string | null
  cedula?:    string | null
  customRole?: string | null
}): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('add_employee_to_tenant', {
    p_email:       input.email,
    p_full_name:   input.fullName,
    p_password:    input.password,
    p_role:        input.role === 'CUSTOM' ? 'CASHIER' : input.role,
    p_tenant_id:   input.tenantId,
    p_branch_id:   input.branchId   ?? null,
    p_phone:       input.phone      ?? null,
    p_cedula:      input.cedula     ?? null,
    // p_custom_role: activar tras ejecutar FIX_employee_rpcs.sql
  })
  if (error) throw error
  return data as string
}

export async function updateEmployeeProfile(input: {
  userId:      string
  fullName:    string
  tenantId:    string
  email?:      string
  phone?:      string | null
  cedula?:     string | null
  role?:       BusinessRole
  branchId?:   string | null
  password?:   string
  customRole?: string | null
}): Promise<void> {
  const { error } = await (supabase.rpc as any)('update_employee_profile', {
    p_user_id:     input.userId,
    p_full_name:   input.fullName,
    p_tenant_id:   input.tenantId,
    p_email:       input.email      ?? null,
    p_phone:       input.phone      ?? null,
    p_cedula:      input.cedula     ?? null,
    p_role:        (input.role === 'CUSTOM' ? null : input.role) ?? null,
    p_branch_id:   input.branchId   ?? null,
    p_password:    input.password   ?? null,
    // p_custom_role: activar tras ejecutar FIX_employee_rpcs.sql
  })
  if (error) throw error
}

export async function toggleEmployeeActive(
  tenantId: string,
  userId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('user_tenant_roles')
    .update({ is_active: isActive })
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteEmployee(input: {
  userId:   string
  tenantId: string
}): Promise<void> {
  const { error } = await (supabase.rpc as any)('delete_employee_from_tenant', {
    p_user_id:   input.userId,
    p_tenant_id: input.tenantId,
  })
  if (error) throw error
}

// ── Asistencia y Turnos (módulo attendance) ───────────────────
export interface AttendanceRow {
  id: string
  tenant_id: string
  branch_id: string | null
  user_id: string
  work_date: string
  check_in: string
  check_out: string | null
  notes: string | null
}

export async function getAttendance(
  tenantId: string,
  opts?: { from?: string; to?: string; userId?: string },
): Promise<AttendanceRow[]> {
  let q = supabase
    .from('attendance')
    .select('id, tenant_id, branch_id, user_id, work_date, check_in, check_out, notes')
    .eq('tenant_id', tenantId)
    .order('check_in', { ascending: false })
  if (opts?.from)   q = q.gte('work_date', opts.from)
  if (opts?.to)     q = q.lte('work_date', opts.to)
  if (opts?.userId) q = q.eq('user_id', opts.userId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as AttendanceRow[]
}

/** Registra la entrada (fichar). Devuelve la fila creada. */
export async function checkInAttendance(tenantId: string, userId: string, branchId?: string | null): Promise<AttendanceRow> {
  const { data, error } = await supabase
    .from('attendance')
    .insert({ tenant_id: tenantId, user_id: userId, branch_id: branchId ?? null })
    .select('id, tenant_id, branch_id, user_id, work_date, check_in, check_out, notes')
    .single()
  if (error) throw error
  return data as unknown as AttendanceRow
}

/** Marca la salida en un registro abierto. */
export async function checkOutAttendance(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .update({ check_out: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw error
}

export interface AttendanceInput {
  user_id: string
  work_date: string
  check_in: string
  check_out?: string | null
  branch_id?: string | null
  notes?: string | null
}

/** Alta/edición manual de un registro de asistencia (admin). */
export async function saveAttendance(tenantId: string, input: AttendanceInput, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('attendance').update(cleanInput(input)).eq('tenant_id', tenantId).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('attendance').insert({ tenant_id: tenantId, ...cleanInput(input) })
    if (error) throw error
  }
}

export async function deleteAttendance(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('attendance').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export interface ShiftRow {
  id: string
  tenant_id: string
  branch_id: string | null
  user_id: string
  shift_date: string
  start_time: string
  end_time: string
  notes: string | null
}

export interface ShiftInput {
  user_id: string
  shift_date: string
  start_time: string
  end_time: string
  branch_id?: string | null
  notes?: string | null
}

export async function getShifts(tenantId: string, opts: { from: string; to: string }): Promise<ShiftRow[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id, tenant_id, branch_id, user_id, shift_date, start_time, end_time, notes')
    .eq('tenant_id', tenantId)
    .gte('shift_date', opts.from)
    .lte('shift_date', opts.to)
    .order('shift_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ShiftRow[]
}

export async function saveShift(tenantId: string, input: ShiftInput, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('shifts').update(cleanInput(input)).eq('tenant_id', tenantId).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('shifts').insert({ tenant_id: tenantId, ...cleanInput(input) })
    if (error) throw error
  }
}

export async function deleteShift(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

// ── Comisiones (módulo commissions) ───────────────────────────
export interface CommissionRuleRow {
  id: string
  tenant_id: string
  user_id: string
  category_id: string | null   // null = % base del empleado
  percent: number
}

export async function getCommissionRules(tenantId: string): Promise<CommissionRuleRow[]> {
  const { data, error } = await supabase
    .from('commission_rules')
    .select('id, tenant_id, user_id, category_id, percent')
    .eq('tenant_id', tenantId)
  if (error) throw error
  return (data ?? []) as unknown as CommissionRuleRow[]
}

/** Crea o actualiza la regla (base si categoryId es null, override si no). */
export async function upsertCommissionRule(
  tenantId: string, userId: string, categoryId: string | null, percent: number,
): Promise<void> {
  let sel = supabase.from('commission_rules').select('id').eq('tenant_id', tenantId).eq('user_id', userId)
  sel = categoryId ? sel.eq('category_id', categoryId) : sel.is('category_id', null)
  const { data: existing, error: selErr } = await sel.maybeSingle()
  if (selErr) throw selErr
  if (existing?.id) {
    const { error } = await supabase.from('commission_rules').update({ percent }).eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('commission_rules').insert({ tenant_id: tenantId, user_id: userId, category_id: categoryId, percent })
    if (error) throw error
  }
}

export async function deleteCommissionRule(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('commission_rules').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

export interface CommissionReportRow {
  user_id: string
  sales_base: number
  commission: number
}

/** Reporte de comisiones por periodo (RPC: cálculo a nivel de ítem). */
export async function getCommissionReport(tenantId: string, from: string, to: string): Promise<CommissionReportRow[]> {
  const { data, error } = await (supabase.rpc as any)('get_commission_report', {
    p_tenant_id: tenantId, p_from: from, p_to: to,
  })
  if (error) throw error
  return ((data ?? []) as any[]).map((r) => ({
    user_id: r.user_id,
    sales_base: Number(r.sales_base) || 0,
    commission: Number(r.commission) || 0,
  }))
}

// ── Propinas (módulo tips) ────────────────────────────────────
export interface TipRow {
  id: string
  tenant_id: string
  branch_id: string | null
  sale_id: string | null
  waiter_id: string | null
  amount: number
  tip_date: string
  distributed_at: string | null
  created_at: string
}

export interface TipInput {
  amount: number
  waiter_id?: string | null
  sale_id?: string | null
  branch_id?: string | null
  tip_date?: string
}

export async function getTips(tenantId: string, opts?: { from?: string; to?: string }): Promise<TipRow[]> {
  let q = supabase
    .from('tips')
    .select('id, tenant_id, branch_id, sale_id, waiter_id, amount, tip_date, distributed_at, created_at')
    .eq('tenant_id', tenantId)
    .order('tip_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (opts?.from) q = q.gte('tip_date', opts.from)
  if (opts?.to)   q = q.lte('tip_date', opts.to)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as TipRow[]
}

export async function createTip(tenantId: string, input: TipInput): Promise<void> {
  const { error } = await supabase.from('tips').insert({ tenant_id: tenantId, ...cleanInput(input) })
  if (error) throw error
}

export async function deleteTip(tenantId: string, id: string): Promise<void> {
  const { error } = await supabase.from('tips').delete().eq('tenant_id', tenantId).eq('id', id)
  if (error) throw error
}

/** Ventas COMPLETED por empleado (created_by) en un rango — para reparto por ventas. */
export async function getSalesByEmployee(tenantId: string, from: string, to: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('sales')
    .select('created_by, total, created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'COMPLETED')
    .not('created_by', 'is', null)
    .gte('created_at', from)
    .lte('created_at', `${to}T23:59:59`)
  if (error) throw error
  const map: Record<string, number> = {}
  for (const r of (data ?? []) as any[]) {
    map[r.created_by] = (map[r.created_by] ?? 0) + (Number(r.total) || 0)
  }
  return map
}

export interface TipPayoutRow {
  id: string
  tenant_id: string
  user_id: string
  from_date: string
  to_date: string
  method: 'EQUAL' | 'HOURS' | 'SALES'
  amount: number
  created_at: string
}

export async function getTipPayouts(tenantId: string, limit = 60): Promise<TipPayoutRow[]> {
  const { data, error } = await supabase
    .from('tip_payouts')
    .select('id, tenant_id, user_id, from_date, to_date, method, amount, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as TipPayoutRow[]
}

/** Registra un reparto del bote y marca las propinas del periodo como distribuidas. */
export async function saveTipPayout(
  tenantId: string,
  params: { from: string; to: string; method: 'EQUAL' | 'HOURS' | 'SALES'; lines: { user_id: string; amount: number }[] },
): Promise<void> {
  const rows = params.lines
    .filter((l) => l.amount > 0)
    .map((l) => ({ tenant_id: tenantId, user_id: l.user_id, from_date: params.from, to_date: params.to, method: params.method, amount: l.amount }))
  if (rows.length === 0) throw new Error('No hay montos que repartir')
  const { error } = await supabase.from('tip_payouts').insert(rows)
  if (error) throw error
  // Marca las propinas del periodo como repartidas (evita doble pago).
  await supabase
    .from('tips')
    .update({ distributed_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .gte('tip_date', params.from)
    .lte('tip_date', params.to)
    .is('distributed_at', null)
}
