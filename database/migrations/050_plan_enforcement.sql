-- ============================================================
-- REG-X — Migration 050: Los planes se hacen cumplir de verdad
-- ------------------------------------------------------------
-- Antes los planes eran decorativos: min_plan no se validaba y no
-- existían límites cuantitativos. Esta migración:
--
-- 1. Límites por plan (NULL = ilimitado): max_branches,
--    max_employees, max_products — con defaults sensatos.
-- 2. plan_rank(): jerarquía FREE < BASIC < PROFESSIONAL < ENTERPRISE.
-- 3. set_tenant_module valida min_plan (error claro con upgrade).
-- 4. Trigger en tenant_modules: ningún camino (seed, RPC, manual)
--    puede activar un módulo por encima del plan (los seeds lo
--    omiten en silencio; una activación directa falla).
-- 5. Triggers de límite en branches / user_tenant_roles / products.
-- 6. Al bajar de plan (tenants.plan) se desactivan los módulos que
--    ya no corresponden — automático.
-- 7. Data fix: desactiva módulos actualmente activos por encima
--    del plan de cada tenant.
-- Compatible con columnas plan como ENUM o como VARCHAR (castea a TEXT).
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) LÍMITES POR PLAN
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_branches  INT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_employees INT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_products  INT;

UPDATE public.plans SET max_branches = 1,    max_employees = 3,    max_products = 100   WHERE code::TEXT = 'FREE'         AND max_branches IS NULL;
UPDATE public.plans SET max_branches = 2,    max_employees = 10,   max_products = 2000  WHERE code::TEXT = 'BASIC'        AND max_branches IS NULL;
UPDATE public.plans SET max_branches = 5,    max_employees = 30,   max_products = 20000 WHERE code::TEXT = 'PROFESSIONAL' AND max_branches IS NULL;
-- ENTERPRISE queda NULL = ilimitado

-- ══════════════════════════════════════════════════════════════
-- 2) JERARQUÍA DE PLANES
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.plan_rank(p_plan TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE UPPER(COALESCE(p_plan, 'FREE'))
    WHEN 'FREE'         THEN 0
    WHEN 'BASIC'        THEN 1
    WHEN 'PROFESSIONAL' THEN 2
    WHEN 'ENTERPRISE'   THEN 3
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_plan(p_tenant UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT plan::TEXT FROM public.tenants WHERE id = p_tenant;
$$;

-- ══════════════════════════════════════════════════════════════
-- 3) set_tenant_module v2 — valida el plan
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_tenant_module(
  p_tenant_id UUID,
  p_slug      TEXT,
  p_enabled   BOOLEAN
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mod  RECORD;
  v_plan TEXT;
BEGIN
  IF NOT (public.is_super_admin()
          OR (user_belongs_to_tenant(p_tenant_id)
              AND user_role_in_tenant(p_tenant_id) IN ('OWNER','ADMIN'))) THEN
    RAISE EXCEPTION 'Solo el dueño o un administrador pueden gestionar módulos'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, category, min_plan, name INTO v_mod
    FROM public.marketplace_modules
   WHERE slug = p_slug AND is_active = TRUE;
  IF v_mod.id IS NULL THEN
    RAISE EXCEPTION 'Módulo % no existe o no está disponible', p_slug;
  END IF;

  IF v_mod.category = 'core' AND NOT p_enabled THEN
    RAISE EXCEPTION 'El módulo % es parte del núcleo y no se puede desactivar', p_slug;
  END IF;

  -- Validar plan del tenant contra min_plan del módulo
  IF p_enabled THEN
    v_plan := public.tenant_plan(p_tenant_id);
    IF public.plan_rank(v_plan) < public.plan_rank(v_mod.min_plan::TEXT) THEN
      RAISE EXCEPTION '"%" requiere el plan % (tu plan actual es %). Actualiza tu plan para activarlo.',
        v_mod.name, v_mod.min_plan, v_plan
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
  VALUES (p_tenant_id, v_mod.id, p_enabled)
  ON CONFLICT (tenant_id, module_id)
  DO UPDATE SET is_enabled = p_enabled, updated_at = NOW();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_tenant_module(UUID, TEXT, BOOLEAN) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 4) TRIGGER: ningún camino activa módulos por encima del plan
--    (INSERT de seeds → se omite en silencio; el RPC ya avisa bonito)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trg_module_plan_gate()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_min  TEXT;
  v_plan TEXT;
BEGIN
  IF NEW.is_enabled THEN
    SELECT min_plan::TEXT INTO v_min FROM public.marketplace_modules WHERE id = NEW.module_id;
    v_plan := public.tenant_plan(NEW.tenant_id);
    IF public.plan_rank(v_plan) < public.plan_rank(v_min) THEN
      IF TG_OP = 'INSERT' THEN
        RETURN NULL;  -- seeds: omitir sin romper
      ELSE
        NEW.is_enabled := FALSE;  -- update directo: forzar apagado
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_module_plan_gate ON public.tenant_modules;
CREATE TRIGGER trg_module_plan_gate
  BEFORE INSERT OR UPDATE ON public.tenant_modules
  FOR EACH ROW EXECUTE FUNCTION public.trg_module_plan_gate();

-- ══════════════════════════════════════════════════════════════
-- 5) LÍMITES CUANTITATIVOS (mensajes claros para el toast)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trg_limit_branches()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan TEXT; v_max INT; v_count INT;
BEGIN
  v_plan := public.tenant_plan(NEW.tenant_id);
  SELECT max_branches INTO v_max FROM public.plans WHERE code::TEXT = v_plan;
  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.branches
     WHERE tenant_id = NEW.tenant_id AND is_active = TRUE;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Tu plan % permite máximo % sucursal(es). Actualiza tu plan para agregar más.', v_plan, v_max
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_limit_branches ON public.branches;
CREATE TRIGGER trg_limit_branches
  BEFORE INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.trg_limit_branches();

CREATE OR REPLACE FUNCTION public.trg_limit_employees()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan TEXT; v_max INT; v_count INT;
BEGIN
  v_plan := public.tenant_plan(NEW.tenant_id);
  SELECT max_employees INTO v_max FROM public.plans WHERE code::TEXT = v_plan;
  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.user_tenant_roles
     WHERE tenant_id = NEW.tenant_id AND is_active = TRUE;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Tu plan % permite máximo % usuario(s)/empleado(s). Actualiza tu plan para agregar más.', v_plan, v_max
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_limit_employees ON public.user_tenant_roles;
CREATE TRIGGER trg_limit_employees
  BEFORE INSERT ON public.user_tenant_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_limit_employees();

CREATE OR REPLACE FUNCTION public.trg_limit_products()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan TEXT; v_max INT; v_count INT;
BEGIN
  v_plan := public.tenant_plan(NEW.tenant_id);
  SELECT max_products INTO v_max FROM public.plans WHERE code::TEXT = v_plan;
  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.products
     WHERE tenant_id = NEW.tenant_id AND deleted_at IS NULL;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'Tu plan % permite máximo % producto(s). Actualiza tu plan para agregar más.', v_plan, v_max
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_limit_products ON public.products;
CREATE TRIGGER trg_limit_products
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_limit_products();

-- ══════════════════════════════════════════════════════════════
-- 6) DOWNGRADE LIMPIO: al cambiar el plan, apagar módulos que
--    ya no corresponden
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trg_plan_downgrade_modules()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    UPDATE public.tenant_modules tm
       SET is_enabled = FALSE, updated_at = NOW()
      FROM public.marketplace_modules mm
     WHERE tm.module_id = mm.id
       AND tm.tenant_id = NEW.id
       AND tm.is_enabled = TRUE
       AND public.plan_rank(NEW.plan::TEXT) < public.plan_rank(mm.min_plan::TEXT);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_plan_downgrade_modules ON public.tenants;
CREATE TRIGGER trg_plan_downgrade_modules
  AFTER UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.trg_plan_downgrade_modules();

-- ══════════════════════════════════════════════════════════════
-- 7) DATA FIX: apagar módulos activos por encima del plan actual
-- ══════════════════════════════════════════════════════════════
UPDATE public.tenant_modules tm
   SET is_enabled = FALSE, updated_at = NOW()
  FROM public.marketplace_modules mm, public.tenants t
 WHERE tm.module_id = mm.id
   AND tm.tenant_id = t.id
   AND tm.is_enabled = TRUE
   AND public.plan_rank(t.plan::TEXT) < public.plan_rank(mm.min_plan::TEXT);

SELECT 'Migración 050 aplicada: planes con enforcement real ✅' AS resultado;
