-- ─────────────────────────────────────────────────────────────
-- 057 · Gastos ligados a la caja (cierre de día)
-- Un gasto pagado en EFECTIVO desde la caja abierta queda vinculado
-- a esa sesión (cash_register_id) para que el cierre de caja reste
-- esos gastos del efectivo esperado.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_cash_register
  ON public.expenses (cash_register_id);

COMMENT ON COLUMN public.expenses.cash_register_id IS
  'Sesión de caja de la que salió el efectivo (NULL = gasto no pagado desde una caja)';

-- Actualizar el RPC de cierre: el efectivo esperado ahora resta los
-- gastos en efectivo pagados desde esta sesión de caja.
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
  v_tenant_id     UUID;
  v_reg_status    TEXT;
  v_opening       NUMERIC;
  v_cash_sales    NUMERIC;
  v_cash_expenses NUMERIC;
  v_expected      NUMERIC;
  v_diff          NUMERIC;
  v_result        JSONB;
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

  -- Gastos en efectivo pagados desde esta caja
  SELECT COALESCE(SUM(e.amount), 0) INTO v_cash_expenses
  FROM   expenses e
  WHERE  e.cash_register_id = p_register_id
    AND  e.payment_method = 'CASH'
    AND  e.deleted_at IS NULL;

  v_expected := v_opening + v_cash_sales - v_cash_expenses;
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
