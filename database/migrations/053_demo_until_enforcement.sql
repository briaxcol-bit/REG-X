-- ============================================================
-- REG-X — Migration 053: Demo con fecha límite + bloqueo real
-- ------------------------------------------------------------
-- 1. set_subscription_demo(tenant, fecha): el super admin da un
--    demo hasta un día concreto (status TRIAL hasta esa fecha).
-- 2. subscription_is_current(tenant): ¿la suscripción está vigente?
--    - Sin fila de suscripción → TRUE (tenants legacy, no bloquear)
--    - TRIAL  → vigente hasta trial_ends_at
--    - ACTIVE → vigente hasta current_period_end
--    - CANCELLED / EXPIRED / vencida → NO vigente
-- 3. Trigger en sales: si la suscripción no está vigente, la venta
--    se rechaza con un error claro → el POS deja de vender hasta
--    que el super admin active/renueve el plan (botón Activar).
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) Demo hasta una fecha
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_subscription_demo(
  p_tenant_id UUID,
  p_until     DATE
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_until TIMESTAMPTZ := (p_until::TIMESTAMPTZ + INTERVAL '1 day' - INTERVAL '1 second'); -- fin del día
  v_plan  TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede otorgar demos';
  END IF;
  IF p_until < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha del demo debe ser hoy o futura';
  END IF;

  SELECT plan::TEXT INTO v_plan FROM public.tenants WHERE id = p_tenant_id;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Tenant no encontrado';
  END IF;

  -- Una suscripción por tenant (migración 049): update o insert
  UPDATE public.subscriptions
     SET status               = 'TRIAL',
         trial_ends_at        = v_until,
         current_period_start = now(),
         current_period_end   = v_until,
         updated_at           = now()
   WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (
      tenant_id, plan, status, billing_cycle, price, currency,
      trial_ends_at, current_period_start, current_period_end, created_by
    ) VALUES (
      p_tenant_id, v_plan::subscription_plan, 'TRIAL', 'MONTHLY', 0,
      COALESCE((SELECT currency FROM public.tenants WHERE id = p_tenant_id), 'COP'),
      v_until, now(), v_until, auth.uid()
    );
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 2) ¿Suscripción vigente?
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.subscription_is_current(p_tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    -- Tenants sin fila de suscripción (legacy): no bloquear
    WHEN NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.tenant_id = p_tenant)
      THEN TRUE
    ELSE EXISTS (
      SELECT 1 FROM public.subscriptions s
       WHERE s.tenant_id = p_tenant
         AND (
           (s.status = 'TRIAL'  AND COALESCE(s.trial_ends_at, s.current_period_end) >= now())
           OR
           (s.status = 'ACTIVE' AND s.current_period_end >= now())
         )
    )
  END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 3) Bloqueo real: sin suscripción vigente no se vende
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_subscription_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.subscription_is_current(NEW.tenant_id) THEN
    RAISE EXCEPTION 'Suscripción vencida o demo finalizado. Renueva el plan de REG-X para seguir vendiendo.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_subscription_check ON public.sales;
CREATE TRIGGER trg_sales_subscription_check
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.check_subscription_on_sale();

NOTIFY pgrst, 'reload schema';

SELECT 'Migración 053 (demo hasta fecha + bloqueo por vencimiento) aplicada ✅' AS resultado;
