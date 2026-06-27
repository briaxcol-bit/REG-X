-- ============================================================
-- REG-X — Migration 012: Backfill Módulos + Cascade Delete Mejorado
-- ------------------------------------------------------------
-- 1. Backfill: activa módulos para tenants creados antes de 011
-- 2. Actualiza delete_tenant para limpiar auth.users huérfanos
--    (usuarios que solo pertenecían al tenant eliminado)
--
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) BACKFILL: seed_tenant_modules para tenants existentes
--    Solo corre en tenants que aún no tienen módulos asignados.
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, business_type::text AS biz
      FROM public.tenants
     WHERE is_active = TRUE
       AND id NOT IN (SELECT DISTINCT tenant_id FROM public.tenant_modules)
  LOOP
    PERFORM public.seed_tenant_modules(r.id, r.biz);
    RAISE NOTICE 'Módulos sembrados para tenant: %', r.id;
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 2) delete_tenant — limpia también auth.users huérfanos
--    Un usuario huérfano = no tiene filas en user_tenant_roles
--    después de eliminar el tenant (es decir, no pertenece a
--    ningún otro tenant).
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_tenant(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth AS $$
DECLARE
  v_name       TEXT;
  v_orphan_ids UUID[];
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede eliminar tenants';
  END IF;

  SELECT name INTO v_name FROM public.tenants WHERE id = p_tenant_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Tenant no encontrado: %', p_tenant_id;
  END IF;

  -- Usuarios que solo pertenecen a ESTE tenant (antes de borrar)
  SELECT ARRAY_AGG(DISTINCT user_id) INTO v_orphan_ids
    FROM public.user_tenant_roles
   WHERE tenant_id = p_tenant_id
     AND user_id NOT IN (
       SELECT user_id FROM public.user_tenant_roles
        WHERE tenant_id <> p_tenant_id
     );

  -- Eliminar el tenant (FK CASCADE limpia branches, warehouses,
  -- subscriptions, roles, tenant_modules, user_tenant_roles, etc.)
  DELETE FROM public.tenants WHERE id = p_tenant_id;

  -- Limpiar auth.users huérfanos (y por CASCADE: auth.identities,
  -- auth.sessions, user_profiles, etc.)
  IF v_orphan_ids IS NOT NULL AND array_length(v_orphan_ids, 1) > 0 THEN
    DELETE FROM auth.users WHERE id = ANY(v_orphan_ids);
  END IF;

  RETURN jsonb_build_object(
    'success',       true,
    'deleted_name',  v_name,
    'orphans_cleaned', COALESCE(array_length(v_orphan_ids, 1), 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_tenant(UUID) TO authenticated;

SELECT 'Migración 012 (backfill + cascade delete) aplicada ✅' AS resultado;
