-- ============================================================
-- Migration 015: Cash Register RPCs (v2 - usa RETURNS JSONB)
-- ============================================================

-- DROP previo para poder cambiar el tipo de retorno
DROP FUNCTION IF EXISTS public.open_cash_register(UUID, UUID, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.close_cash_register(UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.get_active_cash_register(UUID, UUID);

-- 1. INSERT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cash_registers' AND policyname = 'cash_registers_insert'
  ) THEN
    CREATE POLICY "cash_registers_insert" ON cash_registers
      FOR INSERT WITH CHECK (
        user_belongs_to_tenant(tenant_id) AND
        user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN','CASHIER','ACCOUNTANT')
      );
  END IF;
END$$;

-- 2. open_cash_register
CREATE OR REPLACE FUNCTION public.open_cash_register(
  p_tenant_id    UUID,
  p_branch_id    UUID,
  p_name         TEXT    DEFAULT 'Caja Principal',
  p_opening_cash NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing JSONB;
  v_new      JSONB;
BEGIN
  IF NOT user_belongs_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Si ya hay una caja abierta para este branch, devolverla
  SELECT to_jsonb(cr) INTO v_existing
  FROM cash_registers cr
  WHERE cr.tenant_id = p_tenant_id
    AND cr.branch_id = p_branch_id
    AND cr.status = 'OPEN'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Crear nueva apertura
  INSERT INTO cash_registers (
    tenant_id, branch_id, name,
    status, opening_cash,
    opened_at, opened_by, created_by
  )
  VALUES (
    p_tenant_id, p_branch_id, p_name,
    'OPEN', p_opening_cash,
    NOW(), auth.uid(), auth.uid()
  )
  RETURNING to_jsonb(cash_registers.*) INTO v_new;

  RETURN v_new;
END;
$$;

-- 3. close_cash_register
CREATE OR REPLACE FUNCTION public.close_cash_register(
  p_register_id  UUID,
  p_counted_cash NUMERIC DEFAULT 0,
  p_notes        TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id  UUID;
  v_reg_status TEXT;
  v_opening    NUMERIC;
  v_cash_sales NUMERIC;
  v_expected   NUMERIC;
  v_diff       NUMERIC;
  v_result     JSONB;
BEGIN
  SELECT tenant_id, status::TEXT, opening_cash
  INTO   v_tenant_id, v_reg_status, v_opening
  FROM   cash_registers
  WHERE  id = p_register_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada';
  END IF;

  IF NOT user_belongs_to_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_reg_status <> 'OPEN' THEN
    RAISE EXCEPTION 'La caja no está abierta';
  END IF;

  -- Ventas en efectivo durante la sesión
  SELECT COALESCE(SUM(sp.amount), 0) INTO v_cash_sales
  FROM   sales s
  JOIN   sale_payments sp ON sp.sale_id = s.id
  WHERE  s.cash_register_id = p_register_id
    AND  s.status = 'COMPLETED'
    AND  sp.method = 'CASH';

  v_expected := v_opening + v_cash_sales;
  v_diff     := p_counted_cash - v_expected;

  UPDATE cash_registers SET
    status          = 'CLOSED',
    closed_at       = NOW(),
    closed_by       = auth.uid(),
    closing_cash    = p_counted_cash,
    expected_cash   = v_expected,
    cash_difference = v_diff,
    notes           = p_notes,
    updated_at      = NOW()
  WHERE id = p_register_id
  RETURNING to_jsonb(cash_registers.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- 4. get_active_cash_register
CREATE OR REPLACE FUNCTION public.get_active_cash_register(
  p_tenant_id UUID,
  p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id',             cr.id,
    'name',           cr.name,
    'status',         cr.status,
    'opened_at',      cr.opened_at,
    'opening_cash',   cr.opening_cash,
    'opened_by',      cr.opened_by,
    'opened_by_name', COALESCE(up.full_name, ''),
    'sales_total',    COALESCE(SUM(s.total), 0),
    'cash_sales',     COALESCE(SUM(CASE WHEN sp.method = 'CASH' THEN sp.amount ELSE 0 END), 0),
    'tx_count',       COUNT(DISTINCT s.id)
  ) INTO v_result
  FROM   cash_registers cr
  LEFT JOIN user_profiles up ON up.id = cr.opened_by
  LEFT JOIN sales s
    ON  s.cash_register_id = cr.id AND s.status = 'COMPLETED'
  LEFT JOIN sale_payments sp
    ON  sp.sale_id = s.id
  WHERE  cr.tenant_id = p_tenant_id
    AND  cr.branch_id = p_branch_id
    AND  cr.status = 'OPEN'
  GROUP BY cr.id, up.full_name
  LIMIT 1;

  RETURN v_result;  -- NULL si no hay caja abierta
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.open_cash_register         TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_register        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_cash_register   TO authenticated;
