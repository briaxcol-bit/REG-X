-- ============================================================
-- 017 — Caja por usuario: cada usuario maneja su propia caja
-- ============================================================
-- Problema 1: get_active_cash_register devolvía la caja de
--   cualquier usuario del branch (LIMIT 1 sin filtro de usuario).
-- Problema 2: open_cash_register bloqueaba la apertura si
--   CUALQUIER usuario del branch ya tenía una caja abierta,
--   devolviendo la caja ajena en vez de crear una nueva.
--
-- Solución: ambas funciones ahora operan por opened_by = auth.uid().
-- Cada usuario (OWNER, ADMIN, CASHIER) tiene su propio registro.
-- ============================================================

-- ── open_cash_register ────────────────────────────────────────
-- Ahora: si el usuario YA tiene una caja abierta → devuelve la suya.
-- Si otro usuario tiene una abierta → crea una nueva igualmente.
DROP FUNCTION IF EXISTS public.open_cash_register(UUID, UUID, TEXT, NUMERIC);

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

  -- Si EL USUARIO ACTUAL ya tiene una caja abierta, devolverla
  SELECT to_jsonb(cr) INTO v_existing
  FROM cash_registers cr
  WHERE cr.tenant_id  = p_tenant_id
    AND cr.branch_id  = p_branch_id
    AND cr.status     = 'OPEN'
    AND cr.opened_by  = auth.uid()   -- ← solo la suya
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Crear nueva apertura para este usuario
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

GRANT EXECUTE ON FUNCTION public.open_cash_register TO authenticated;


-- ── get_active_cash_register ──────────────────────────────────
-- Filtra por opened_by = auth.uid() para que cada usuario
-- vea únicamente su propia caja activa.
DROP FUNCTION IF EXISTS public.get_active_cash_register(UUID, UUID);

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
    -- Incluye COMPLETED y PENDING (comandas) para que el arqueo
    -- muestre datos tanto en modo FULL como COMMANDS_ONLY
    'sales_total',    COALESCE(SUM(s.total), 0),
    'cash_sales',     COALESCE(SUM(CASE WHEN sp.method = 'CASH' THEN sp.amount ELSE 0 END), 0),
    'tx_count',       COUNT(DISTINCT s.id)
  ) INTO v_result
  FROM   cash_registers cr
  LEFT JOIN user_profiles up ON up.id = cr.opened_by
  LEFT JOIN sales s
    ON  s.cash_register_id = cr.id
    AND s.status IN ('COMPLETED', 'PENDING')   -- ← PENDING = comandas
  LEFT JOIN sale_payments sp
    ON  sp.sale_id = s.id
  WHERE  cr.tenant_id = p_tenant_id
    AND  cr.branch_id = p_branch_id
    AND  cr.status    = 'OPEN'
    AND  cr.opened_by = auth.uid()
  GROUP BY cr.id, up.full_name
  LIMIT 1;

  RETURN v_result;  -- NULL si el usuario no tiene caja abierta
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_cash_register TO authenticated;
