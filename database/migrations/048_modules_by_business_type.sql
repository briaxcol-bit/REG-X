-- ============================================================
-- REG-X — Migration 048: Módulos según el tipo de negocio (fix)
-- ------------------------------------------------------------
-- Problema: las migraciones 031–038 activaron sus paquetes de módulos
-- para TODOS los tenants (CROSS JOIN), ignorando el business_type.
-- Resultado: una heladería veía ferretería, farmacia, restaurante, etc.
--
-- 1. reset_tenant_modules(tenant): borra los módulos del tenant y
--    re-siembra los de su tipo de negocio (seed_tenant_modules de 013).
--    Puede llamarla el SUPER_ADMIN o el OWNER del tenant.
-- 2. set_tenant_module(tenant, slug, enabled): activar/desactivar un
--    módulo individual (OWNER/ADMIN). Los módulos 'core' no se pueden
--    apagar. Es el backend del Marketplace de módulos.
-- 3. Data fix: resetea TODOS los tenants existentes a su tipo.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) RESET A LOS MÓDULOS DEL TIPO DE NEGOCIO
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reset_tenant_modules(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
BEGIN
  IF NOT (public.is_super_admin()
          OR (user_belongs_to_tenant(p_tenant_id)
              AND user_role_in_tenant(p_tenant_id) = 'OWNER')) THEN
    RAISE EXCEPTION 'Solo el dueño o un super admin pueden restablecer módulos'
      USING ERRCODE = '42501';
  END IF;

  SELECT business_type::TEXT INTO v_type FROM public.tenants WHERE id = p_tenant_id;
  IF v_type IS NULL THEN RAISE EXCEPTION 'Tenant no encontrado'; END IF;

  DELETE FROM public.tenant_modules WHERE tenant_id = p_tenant_id;
  PERFORM public.seed_tenant_modules(p_tenant_id, v_type);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_tenant_modules(UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 2) ACTIVAR / DESACTIVAR UN MÓDULO INDIVIDUAL (OWNER/ADMIN)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_tenant_module(
  p_tenant_id UUID,
  p_slug      TEXT,
  p_enabled   BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mod RECORD;
BEGIN
  IF NOT (public.is_super_admin()
          OR (user_belongs_to_tenant(p_tenant_id)
              AND user_role_in_tenant(p_tenant_id) IN ('OWNER','ADMIN'))) THEN
    RAISE EXCEPTION 'Solo el dueño o un administrador pueden gestionar módulos'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, category INTO v_mod
    FROM public.marketplace_modules
   WHERE slug = p_slug AND is_active = TRUE;
  IF v_mod.id IS NULL THEN
    RAISE EXCEPTION 'Módulo % no existe o no está disponible', p_slug;
  END IF;

  -- El core no se apaga: sin POS/inventario/caja los números no cuadran
  IF v_mod.category = 'core' AND NOT p_enabled THEN
    RAISE EXCEPTION 'El módulo % es parte del núcleo y no se puede desactivar', p_slug;
  END IF;

  INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
  VALUES (p_tenant_id, v_mod.id, p_enabled)
  ON CONFLICT (tenant_id, module_id)
  DO UPDATE SET is_enabled = p_enabled, updated_at = NOW();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_tenant_module(UUID, TEXT, BOOLEAN) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3) DATA FIX: resetear TODOS los tenants a su tipo de negocio
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id, business_type::TEXT AS bt FROM public.tenants LOOP
    DELETE FROM public.tenant_modules WHERE tenant_id = t.id;
    PERFORM public.seed_tenant_modules(t.id, t.bt);
  END LOOP;
END $$;

SELECT 'Migración 048 aplicada: módulos según tipo de negocio ✅' AS resultado;
