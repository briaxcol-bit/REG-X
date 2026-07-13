-- ============================================================
-- REG-X — Migration 045: delete_tenant blindado
-- ------------------------------------------------------------
-- Problemas que corrige:
-- 1. FKs ON DELETE RESTRICT frenaban el CASCADE del tenant:
--    • journal_lines.account_id  → accounts  (migración 037)
--    • recipe_items.ingredient_id → products (migración 001)
--    Se pre-limpian explícitamente antes de borrar el tenant.
-- 2. PELIGRO: la limpieza de "usuarios huérfanos" podía borrar de
--    auth.users a un SUPER_ADMIN/staff de plataforma si su único rol
--    de negocio estaba en el tenant eliminado. Ahora el staff de
--    plataforma (platform_role IS NOT NULL) NUNCA se elimina.
-- 3. La limpieza de auth.users ya no puede tumbar la eliminación del
--    tenant: va en bloque con manejo de excepción propio.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_tenant(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth AS $$
DECLARE
  v_name        TEXT;
  v_orphan_ids  UUID[];
  v_orphans     INT := 0;
  v_warn        TEXT := NULL;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede eliminar tenants';
  END IF;

  SELECT name INTO v_name FROM public.tenants WHERE id = p_tenant_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Tenant no encontrado: %', p_tenant_id;
  END IF;

  -- Usuarios que SOLO pertenecen a este tenant y NO son staff de plataforma
  SELECT ARRAY_AGG(DISTINCT utr.user_id) INTO v_orphan_ids
    FROM public.user_tenant_roles utr
   WHERE utr.tenant_id = p_tenant_id
     AND utr.user_id NOT IN (
       SELECT user_id FROM public.user_tenant_roles WHERE tenant_id <> p_tenant_id
     )
     AND utr.user_id NOT IN (
       SELECT id FROM public.user_profiles WHERE platform_role IS NOT NULL
     );

  -- Pre-limpieza de FKs RESTRICT que frenan el CASCADE
  DELETE FROM public.journal_lines WHERE tenant_id = p_tenant_id;

  DELETE FROM public.recipe_items ri
   USING public.recipes r
   WHERE ri.recipe_id = r.id AND r.tenant_id = p_tenant_id;

  -- Eliminar el tenant (FK CASCADE limpia todo lo demás:
  -- branches, warehouses, products, sales, inventory, subscriptions,
  -- roles, módulos, gastos, finanzas, etc.)
  DELETE FROM public.tenants WHERE id = p_tenant_id;

  -- Limpieza de auth.users huérfanos — best-effort, nunca tumba el borrado
  IF v_orphan_ids IS NOT NULL AND array_length(v_orphan_ids, 1) > 0 THEN
    BEGIN
      DELETE FROM auth.users WHERE id = ANY(v_orphan_ids);
      v_orphans := array_length(v_orphan_ids, 1);
    EXCEPTION WHEN OTHERS THEN
      v_warn := 'Tenant eliminado, pero quedaron usuarios sin limpiar: ' || SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'deleted_name',    v_name,
    'orphans_cleaned', v_orphans,
    'warning',         v_warn
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_tenant(UUID) TO authenticated;
