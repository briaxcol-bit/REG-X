-- ============================================================
-- REG-X — Migration 008: Planes Dinámicos
-- ------------------------------------------------------------
--  Convierte el tipo subscription_plan de ENUM a VARCHAR(50)
--  para permitir crear/eliminar planes desde el panel de admin
--  sin necesidad de migraciones SQL adicionales.
--
--  Tablas afectadas:
--    • plans.code          (PRIMARY KEY)
--    • tenants.plan
--    • subscriptions.plan
--    • marketplace_modules.min_plan
--
--  Las funciones que hacían cast ::subscription_plan se
--  recrean sin ese cast.
--
--  Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) CONVERTIR COLUMNAS DE ENUM A VARCHAR
-- ══════════════════════════════════════════════════════════════

-- plans.code
ALTER TABLE public.plans
  ALTER COLUMN code TYPE VARCHAR(50) USING code::text;

-- tenants.plan
ALTER TABLE public.tenants
  ALTER COLUMN plan TYPE VARCHAR(50) USING plan::text;

-- subscriptions.plan
ALTER TABLE public.subscriptions
  ALTER COLUMN plan TYPE VARCHAR(50) USING plan::text;

-- marketplace_modules.min_plan
ALTER TABLE public.marketplace_modules
  ALTER COLUMN min_plan TYPE VARCHAR(50) USING min_plan::text;

-- ══════════════════════════════════════════════════════════════
-- 2) ELIMINAR EL ENUM (ya no se necesita)
-- ══════════════════════════════════════════════════════════════
DROP TYPE IF EXISTS subscription_plan;

-- ══════════════════════════════════════════════════════════════
-- 3) RECREAR FUNCIÓN set_plan_price SIN CAST
-- ══════════════════════════════════════════════════════════════
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
     SET price     = p_price,
         currency  = COALESCE(p_currency, currency),
         updated_at = now()
   WHERE code = p_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan no encontrado: %', p_code;
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 4) RECREAR FUNCIÓN activate_subscription SIN CAST
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_tenant_id UUID,
  p_plan      TEXT,
  p_price     NUMERIC DEFAULT NULL,
  p_currency  TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_price    NUMERIC;
  v_currency TEXT;
  v_start    TIMESTAMPTZ := now();
  v_end      TIMESTAMPTZ := now() + INTERVAL '1 month';
  v_sub_id   UUID;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede gestionar suscripciones';
  END IF;

  -- Validar que el plan existe
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE code = p_plan AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Plan no válido o inactivo: %', p_plan;
  END IF;

  SELECT COALESCE(p_price, price), COALESCE(p_currency, currency)
    INTO v_price, v_currency
    FROM public.plans WHERE code = p_plan;

  v_price    := COALESCE(v_price, 0);
  v_currency := COALESCE(v_currency, 'COP');

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
      p_tenant_id, p_plan, 'ACTIVE', 'MONTHLY', v_price, v_currency,
      v_start, v_end, NULL, NULL
    );
  ELSE
    UPDATE public.subscriptions
       SET plan = p_plan, status = 'ACTIVE', billing_cycle = 'MONTHLY',
           price = v_price, currency = v_currency,
           current_period_start = v_start, current_period_end = v_end,
           trial_ends_at = NULL, cancelled_at = NULL, cancel_reason = NULL,
           updated_at = now()
     WHERE id = v_sub_id;
  END IF;

  UPDATE public.tenants
     SET plan = p_plan, is_active = TRUE, updated_at = now()
   WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id, 'plan', p_plan, 'price', v_price,
    'currency', v_currency, 'period_end', v_end
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 5) FUNCIÓN PARA CREAR UN PLAN DESDE EL PANEL (SUPER_ADMIN)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_plan(
  p_code        TEXT,
  p_name        TEXT,
  p_description TEXT DEFAULT NULL,
  p_price       NUMERIC DEFAULT 0,
  p_currency    TEXT DEFAULT 'COP',
  p_features    JSONB DEFAULT '[]'::jsonb,
  p_sort_order  INTEGER DEFAULT 99
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede crear planes';
  END IF;

  IF p_code IS NULL OR trim(p_code) = '' THEN
    RAISE EXCEPTION 'El código del plan no puede estar vacío';
  END IF;

  INSERT INTO public.plans (code, name, description, price, currency, features, sort_order, is_active)
  VALUES (
    upper(trim(p_code)),
    p_name,
    p_description,
    p_price,
    p_currency,
    p_features,
    p_sort_order,
    TRUE
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 6) FUNCIÓN PARA ELIMINAR UN PLAN (solo si no está en uso)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_plan(p_code TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_in_use INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede eliminar planes';
  END IF;

  SELECT COUNT(*) INTO v_in_use
    FROM public.tenants
   WHERE plan = p_code AND is_active = TRUE;

  IF v_in_use > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar: % tenants activos usan este plan', v_in_use;
  END IF;

  DELETE FROM public.plans WHERE code = p_code;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 7) PERMISOS
-- ══════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.create_plan(TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_plan(TEXT)                                      TO authenticated;

SELECT 'Migración 008 (planes dinámicos) aplicada ✅' AS resultado;
