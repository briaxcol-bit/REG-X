-- ============================================================
-- REG-X — Migration 042: Nómina que se genera desde los datos
-- ------------------------------------------------------------
-- 1. user_tenant_roles.base_salary: salario base por empleado.
-- 2. generate_payroll_draft(tenant, from, to, label):
--    por cada empleado activo crea un borrador de nómina con
--      base      = base_salary del rol
--      bonuses   = comisiones (get_commission_report) + propinas (tips)
--      notes     = detalle de horas trabajadas (attendance) y desglose
--    No duplica: si ya existe entrada para (empleado, período), la salta.
-- El pago (status PAID) ya genera gasto + asiento vía migración 041.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

ALTER TABLE public.user_tenant_roles
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION generate_payroll_draft(
  p_tenant UUID,
  p_from   DATE,
  p_to     DATE,
  p_label  TEXT
)
RETURNS SETOF payroll_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp     RECORD;
  v_comm    NUMERIC;
  v_tips    NUMERIC;
  v_hours   NUMERIC;
  v_name    TEXT;
  v_notes   TEXT;
  v_row     payroll_entries%ROWTYPE;
BEGIN
  IF p_tenant IS NULL OR NOT user_belongs_to_tenant(p_tenant) THEN
    RAISE EXCEPTION 'No autorizado para el tenant %', p_tenant USING ERRCODE = '42501';
  END IF;
  IF user_role_in_tenant(p_tenant) NOT IN ('OWNER','ADMIN','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Rol sin permiso para generar nómina' USING ERRCODE = '42501';
  END IF;

  FOR v_emp IN
    SELECT utr.user_id, utr.base_salary
      FROM user_tenant_roles utr
     WHERE utr.tenant_id = p_tenant AND utr.is_active = TRUE
  LOOP
    -- Sin duplicados por período
    IF EXISTS (
      SELECT 1 FROM payroll_entries
       WHERE tenant_id = p_tenant AND employee_id = v_emp.user_id
         AND period_label = p_label
    ) THEN
      CONTINUE;
    END IF;

    -- Comisiones del período (reusa la lógica oficial del módulo)
    SELECT COALESCE(SUM(r.commission), 0) INTO v_comm
      FROM get_commission_report(p_tenant, p_from, p_to) r
     WHERE r.user_id = v_emp.user_id;

    -- Propinas asignadas en el período
    SELECT COALESCE(SUM(t.amount), 0) INTO v_tips
      FROM tips t
     WHERE t.tenant_id = p_tenant AND t.waiter_id = v_emp.user_id
       AND t.tip_date BETWEEN p_from AND p_to;

    -- Horas trabajadas (informativas, van en notes)
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (a.check_out - a.check_in)) / 3600.0), 0)
      INTO v_hours
      FROM attendance a
     WHERE a.tenant_id = p_tenant AND a.user_id = v_emp.user_id
       AND a.work_date BETWEEN p_from AND p_to
       AND a.check_out IS NOT NULL;

    -- Nada que pagar → no crear ruido
    IF COALESCE(v_emp.base_salary,0) = 0 AND v_comm = 0 AND v_tips = 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(up.full_name, 'Empleado') INTO v_name
      FROM user_profiles up WHERE up.id = v_emp.user_id;

    v_notes := 'Generado automáticamente ' || p_from || ' → ' || p_to
            || ' · Horas: ' || ROUND(v_hours, 1)
            || ' · Comisiones: ' || ROUND(v_comm, 2)
            || ' · Propinas: ' || ROUND(v_tips, 2);

    INSERT INTO payroll_entries (
      tenant_id, employee_id, employee_name, period_label,
      base_salary, bonuses, deductions, net_pay, status, notes, created_by
    ) VALUES (
      p_tenant, v_emp.user_id, v_name, p_label,
      COALESCE(v_emp.base_salary, 0),
      ROUND(v_comm + v_tips, 2),
      0,
      ROUND(COALESCE(v_emp.base_salary, 0) + v_comm + v_tips, 2),
      'DRAFT', v_notes, auth.uid()
    )
    RETURNING * INTO v_row;

    RETURN NEXT v_row;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_payroll_draft(UUID, DATE, DATE, TEXT) TO authenticated;
