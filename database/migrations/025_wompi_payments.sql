-- ============================================================
-- REG-X — Migration 025: Pagos con Wompi (Checkout por período)
-- ------------------------------------------------------------
-- Flujo:
--   1. El dueño da clic en "Pagar con Wompi" en su Suscripción.
--   2. La Edge Function `wompi-checkout` crea una fila PENDING aquí,
--      firma la transacción y redirige al Checkout de Wompi.
--   3. Wompi notifica el resultado a la Edge Function `wompi-webhook`.
--   4. El webhook llama a `wompi_apply_transaction(...)` (service_role),
--      que marca el pago y, si fue APPROVED, activa/renueva la
--      suscripción 1 mes. Es idempotente (applied_at).
--
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb (NO el proyecto "SGIO").
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) TABLA DE TRANSACCIONES DE PAGO
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider              VARCHAR(20)  NOT NULL DEFAULT 'WOMPI',
  reference             VARCHAR(120) NOT NULL UNIQUE,     -- referencia única enviada a Wompi
  plan_code             subscription_plan NOT NULL,
  amount_in_cents       BIGINT       NOT NULL,
  currency              VARCHAR(3)   NOT NULL DEFAULT 'COP',
  status                VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING|APPROVED|DECLINED|VOIDED|ERROR
  wompi_transaction_id  VARCHAR(120),
  applied_at            TIMESTAMPTZ,                       -- cuándo se activó la suscripción (idempotencia)
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant    ON public.payment_transactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_reference ON public.payment_transactions (reference);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- El dueño/miembros pueden VER sus propios pagos. Las escrituras las hace
-- exclusivamente el service_role desde las Edge Functions (bypassa RLS).
DROP POLICY IF EXISTS "payment_tx_select" ON public.payment_transactions;
CREATE POLICY "payment_tx_select" ON public.payment_transactions
  FOR SELECT USING (public.user_belongs_to_tenant(tenant_id));

GRANT SELECT ON public.payment_transactions TO authenticated;

-- trigger updated_at (usa la función existente del proyecto)
DROP TRIGGER IF EXISTS trg_payment_tx_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_payment_tx_updated_at BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 2) APLICAR RESULTADO DE UNA TRANSACCIÓN (llamado por el webhook)
--    SECURITY DEFINER. Solo service_role puede ejecutarla.
--    Idempotente: si ya se aplicó (applied_at), no vuelve a activar.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.wompi_apply_transaction(
  p_reference   TEXT,
  p_status      TEXT,
  p_wompi_id    TEXT DEFAULT NULL,
  p_amount      BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx       public.payment_transactions%ROWTYPE;
  v_plan     subscription_plan;
  v_price    NUMERIC;
  v_currency TEXT;
  v_start    TIMESTAMPTZ := now();
  v_end      TIMESTAMPTZ := now() + INTERVAL '1 month';
  v_sub_id   UUID;
BEGIN
  SELECT * INTO v_tx FROM public.payment_transactions WHERE reference = p_reference;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reference_not_found');
  END IF;

  -- Actualiza el estado del pago siempre
  UPDATE public.payment_transactions
     SET status = p_status,
         wompi_transaction_id = COALESCE(p_wompi_id, wompi_transaction_id),
         updated_at = now()
   WHERE id = v_tx.id;

  -- Solo activa si fue aprobado y aún no se había aplicado
  IF upper(p_status) <> 'APPROVED' THEN
    RETURN jsonb_build_object('ok', true, 'applied', false, 'status', p_status);
  END IF;

  IF v_tx.applied_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'applied', false, 'reason', 'already_applied');
  END IF;

  v_plan     := v_tx.plan_code;
  v_currency := v_tx.currency;
  v_price    := (v_tx.amount_in_cents::NUMERIC) / 100.0;

  -- Upsert de la suscripción del tenant (misma lógica que activate_subscription)
  SELECT id INTO v_sub_id
    FROM public.subscriptions
   WHERE tenant_id = v_tx.tenant_id
   ORDER BY created_at DESC LIMIT 1;

  IF v_sub_id IS NULL THEN
    INSERT INTO public.subscriptions (
      tenant_id, plan, status, billing_cycle, price, currency,
      current_period_start, current_period_end, trial_ends_at, cancelled_at
    ) VALUES (
      v_tx.tenant_id, v_plan, 'ACTIVE', 'MONTHLY', v_price, v_currency,
      v_start, v_end, NULL, NULL
    );
  ELSE
    UPDATE public.subscriptions
       SET plan = v_plan, status = 'ACTIVE', billing_cycle = 'MONTHLY',
           price = v_price, currency = v_currency,
           current_period_start = v_start, current_period_end = v_end,
           trial_ends_at = NULL, cancelled_at = NULL, cancel_reason = NULL,
           updated_at = now()
     WHERE id = v_sub_id;
  END IF;

  UPDATE public.tenants
     SET plan = v_plan, is_active = TRUE, updated_at = now()
   WHERE id = v_tx.tenant_id;

  UPDATE public.payment_transactions
     SET applied_at = now(), updated_at = now()
   WHERE id = v_tx.id;

  RETURN jsonb_build_object('ok', true, 'applied', true,
                            'tenant_id', v_tx.tenant_id, 'plan', v_plan, 'period_end', v_end);
END;
$$;

-- Solo el service_role (Edge Functions) puede ejecutarla.
REVOKE ALL ON FUNCTION public.wompi_apply_transaction(TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wompi_apply_transaction(TEXT,TEXT,TEXT,BIGINT) TO service_role;

SELECT 'Migración 025 (pagos Wompi) aplicada ✅' AS resultado;
