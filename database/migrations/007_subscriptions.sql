-- ============================================================
-- REG-X — Migration 007: Sistema de Suscripciones
-- ------------------------------------------------------------
--  • Catálogo de planes con precios editables (tabla plans)
--  • Override de precio por tenant (subscriptions.price)
--  • Ciclo mensual: al activar dura 1 mes (current_period_end = +1 mes)
--  • Renovación manual + función de expiración (auto-suspensión vía pg_cron opcional)
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1) CATÁLOGO DE PLANES
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.plans (
  code         subscription_plan PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency     VARCHAR(3)   NOT NULL DEFAULT 'COP',
  features     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Precios base por defecto (puedes cambiarlos luego desde el panel)
INSERT INTO public.plans (code, name, description, price, currency, features, sort_order) VALUES
  ('FREE',         'Free',        'Para empezar',           0,       'COP',
    '["1 sucursal","Hasta 100 productos","Soporte comunitario"]'::jsonb, 1),
  ('BASIC',        'Básico',      'Negocios pequeños',      99000,   'COP',
    '["1 sucursal","Hasta 500 productos","Soporte estándar"]'::jsonb, 2),
  ('PROFESSIONAL', 'Profesional', 'Negocios en crecimiento',199000,  'COP',
    '["Hasta 3 sucursales","Productos ilimitados","Módulo restaurante","Soporte prioritario"]'::jsonb, 3),
  ('ENTERPRISE',   'Enterprise',  'Operaciones grandes',    399000,  'COP',
    '["Sucursales ilimitadas","KDS avanzado","API de integración","Soporte 24/7"]'::jsonb, 4)
ON CONFLICT (code) DO NOTHING;

-- RLS: lectura para autenticados, escritura solo super admin
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_read" ON public.plans;
CREATE POLICY "plans_read" ON public.plans
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "plans_write_super_admin" ON public.plans;
CREATE POLICY "plans_write_super_admin" ON public.plans
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

GRANT SELECT ON public.plans TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;

-- trigger updated_at
DROP TRIGGER IF EXISTS trg_plans_updated_at ON public.plans;
CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════
-- 2) EDITAR PRECIO DE UN PLAN (catálogo)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_plan_price(
  p_code     TEXT,
  p_price    NUMERIC,
  p_currency TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede editar precios';
  END IF;

  UPDATE public.plans
     SET price    = p_price,
         currency = COALESCE(p_currency, currency),
         updated_at = now()
   WHERE code = p_code::subscription_plan;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 3) ACTIVAR / CAMBIAR SUSCRIPCIÓN (dura 1 mes desde ahora)
--    p_price NULL  → usa el precio del catálogo
--    p_price valor → override de precio para ese tenant
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_tenant_id UUID,
  p_plan      TEXT,
  p_price     NUMERIC DEFAULT NULL,
  p_currency  TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan     subscription_plan := p_plan::subscription_plan;
  v_price    NUMERIC;
  v_currency TEXT;
  v_start    TIMESTAMPTZ := now();
  v_end      TIMESTAMPTZ := now() + INTERVAL '1 month';
  v_sub_id   UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede gestionar suscripciones';
  END IF;

  SELECT COALESCE(p_price, price), COALESCE(p_currency, currency)
    INTO v_price, v_currency
    FROM public.plans WHERE code = v_plan;

  v_price    := COALESCE(v_price, 0);
  v_currency := COALESCE(v_currency, 'COP');

  -- Tomar la suscripción más reciente del tenant (si existe)
  SELECT id INTO v_sub_id
    FROM public.subscriptions
   WHERE tenant_id = p_tenant_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_sub_id IS NULL THEN
    INSERT INTO public.subscriptions (
      tenant_id, plan, status, billing_cycle, price, currency,
      current_period_start, current_period_end, trial_ends_at, cancelled_at
    ) VALUES (
      p_tenant_id, v_plan, 'ACTIVE', 'MONTHLY', v_price, v_currency,
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

  -- Sincronizar el plan y reactivar el tenant
  UPDATE public.tenants
     SET plan = v_plan, is_active = TRUE, updated_at = now()
   WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id, 'plan', v_plan, 'price', v_price,
    'currency', v_currency, 'period_end', v_end
  );
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 4) RENOVAR 1 MES MÁS (extiende desde la fecha de fin o desde hoy)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.renew_subscription(p_tenant_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub_id UUID;
  v_base   TIMESTAMPTZ;
  v_end    TIMESTAMPTZ;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede renovar suscripciones';
  END IF;

  SELECT id, current_period_end INTO v_sub_id, v_base
    FROM public.subscriptions
   WHERE tenant_id = p_tenant_id
   ORDER BY created_at DESC LIMIT 1;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'El tenant no tiene suscripción; usa activar primero';
  END IF;

  -- Si ya venció, renueva desde hoy; si no, suma al final actual
  v_end := GREATEST(now(), COALESCE(v_base, now())) + INTERVAL '1 month';

  UPDATE public.subscriptions
     SET status = 'ACTIVE', current_period_end = v_end,
         cancelled_at = NULL, cancel_reason = NULL, updated_at = now()
   WHERE id = v_sub_id;

  UPDATE public.tenants SET is_active = TRUE, updated_at = now()
   WHERE id = p_tenant_id;

  RETURN v_end;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 5) CANCELAR SUSCRIPCIÓN
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_tenant_id UUID,
  p_reason    TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede cancelar suscripciones';
  END IF;

  SELECT id INTO v_sub_id
    FROM public.subscriptions
   WHERE tenant_id = p_tenant_id
   ORDER BY created_at DESC LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.subscriptions
       SET status = 'CANCELLED', cancelled_at = now(),
           cancel_reason = p_reason, updated_at = now()
     WHERE id = v_sub_id;
  END IF;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 6) EXPIRAR VENCIDAS (auto-suspensión)
--    Marca EXPIRED y desactiva el tenant cuando se pasó la fecha.
--    Se puede llamar a mano o programar con pg_cron (ver abajo).
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.expire_due_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH vencidas AS (
    UPDATE public.subscriptions
       SET status = 'EXPIRED', updated_at = now()
     WHERE status = 'ACTIVE'
       AND current_period_end < now()
    RETURNING tenant_id
  )
  UPDATE public.tenants t
     SET is_active = FALSE, updated_at = now()
    FROM vencidas v
   WHERE t.id = v.tenant_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Permisos de ejecución ──────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.set_plan_price(TEXT,NUMERIC,TEXT)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(UUID,TEXT,NUMERIC,TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_subscription(UUID)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(UUID,TEXT)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions()                     TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════
-- 7) (OPCIONAL) AUTO-SUSPENSIÓN PROGRAMADA con pg_cron
--    Descomenta si quieres que se ejecute solo cada hora.
--    Requiere habilitar la extensión pg_cron en Supabase
--    (Database → Extensions → pg_cron).
-- ════════════════════════════════════════════════════════════
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'regx-expire-subscriptions',
--   '0 * * * *',                              -- cada hora en punto
--   $$ SELECT public.expire_due_subscriptions(); $$
-- );

SELECT 'Migración 007 (suscripciones) aplicada ✅' AS resultado;
