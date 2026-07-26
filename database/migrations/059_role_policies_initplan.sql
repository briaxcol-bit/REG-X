-- ═════════════════════════════════════════════════════════════
-- 059 · Performance: chequeos de rol en RLS → InitPlan
--
-- Complemento de la 058. Ahí se optimizó user_belongs_to_tenant();
-- quedaba user_role_in_tenant(tenant_id), que también se ejecuta POR FILA
-- (SECURITY DEFINER → una subconsulta por fila) en políticas de
-- SELECT/UPDATE/INSERT/DELETE que exigen rol (OWNER, ADMIN, etc.).
--
-- Fix: nueva helper que devuelve "los tenants donde el usuario tiene
-- alguno de estos roles" (se evalúa UNA vez por sentencia) y reescritura:
--   user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
--     → (tenant_id IN (SELECT unnest(get_user_role_tenant_ids(ARRAY['OWNER'::text,'ADMIN'::text]))))
-- Semánticamente idéntico. Idempotente. Requiere haber corrido la 058.
-- Ejecutar en el proyecto Supabase de la app (ofsgenbpqfrcyvtiannb).
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) Helper: tenants donde el usuario actual tiene uno de estos roles
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role_tenant_ids(p_roles text[])
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid()
      AND is_active = TRUE
      AND role::text = ANY (p_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role_tenant_ids(text[]) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) Reescritura de políticas
--    Solo toca llamadas con columna simple como argumento
--    (p. ej. la política de storage con foldername() queda intacta).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp._rw_role_expr(expr text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT
    -- b) igualdad simple: user_role_in_tenant(col) = 'OWNER'::text
    regexp_replace(
      -- a) forma IN/ANY: user_role_in_tenant(col) = ANY (ARRAY['A'::text, 'B'::text])
      regexp_replace(
        expr,
        '(public\.)?user_role_in_tenant\(([a-zA-Z_][a-zA-Z0-9_\.]*)\) = ANY \((ARRAY\[[^\]]+\])\)',
        '\2 IN (SELECT unnest(get_user_role_tenant_ids(\3)))',
        'g'),
      '(public\.)?user_role_in_tenant\(([a-zA-Z_][a-zA-Z0-9_\.]*)\) = ''([A-Za-z_]+)''::text',
      '\2 IN (SELECT unnest(get_user_role_tenant_ids(ARRAY[''\3''::text])))',
      'g')
$fn$;

DO $$
DECLARE
  pol       RECORD;
  new_qual  TEXT;
  new_check TEXT;
  parts     TEXT;
  n_changed INT := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '')       LIKE '%user_role_in_tenant%'
        OR coalesce(with_check, '') LIKE '%user_role_in_tenant%'
      )
  LOOP
    new_qual  := CASE WHEN pol.qual       IS NOT NULL THEN pg_temp._rw_role_expr(pol.qual)       END;
    new_check := CASE WHEN pol.with_check IS NOT NULL THEN pg_temp._rw_role_expr(pol.with_check) END;

    parts := '';
    IF new_qual IS NOT NULL AND new_qual IS DISTINCT FROM pol.qual THEN
      parts := parts || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL AND new_check IS DISTINCT FROM pol.with_check THEN
      parts := parts || format(' WITH CHECK (%s)', new_check);
    END IF;

    IF parts <> '' THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I%s',
                     pol.policyname, pol.schemaname, pol.tablename, parts);
      n_changed := n_changed + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Políticas de rol optimizadas: %', n_changed;
END $$;
