-- ═════════════════════════════════════════════════════════════
-- 058 · Performance: índices faltantes + RLS initplan + RPC dashboard
--
-- Problema principal detectado en auditoría:
--   Las ~173 políticas RLS llaman user_belongs_to_tenant(tenant_id) /
--   is_super_admin() POR CADA FILA leída. Al ser SECURITY DEFINER,
--   Postgres NO puede inlinearlas → cada fila ejecuta una subconsulta
--   sobre user_tenant_roles / user_profiles. Un SELECT de 2 000
--   productos = 2 000+ subconsultas extra.
--
-- Fix: reescribir las políticas para que la parte que NO depende de
--   la fila se evalúe UNA vez por sentencia (InitPlan / subplan hasheado):
--     user_belongs_to_tenant(tenant_id)
--       → (tenant_id IN (SELECT unnest(get_user_tenant_ids())))
--     is_super_admin()
--       → (SELECT is_super_admin())
--   Semánticamente idéntico; solo cambia el plan de ejecución.
--   Nota: NO usar "= ANY ((SELECT fn()))" — Postgres lo parsea como
--   sublink por filas y falla con "uuid = uuid[]".
--
-- Idempotente: se puede re-ejecutar sin efectos dobles.
-- Ejecutar en el proyecto Supabase de la app (ofsgenbpqfrcyvtiannb).
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) Índices faltantes en rutas calientes
-- ─────────────────────────────────────────────────────────────

-- sale_payments.sale_id: SIN índice hasta ahora. Se usa en cada listado
-- de ventas (join embebido) y en la política RLS de sale_payments
-- (EXISTS sobre sales). Crítico.
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale
  ON public.sale_payments (sale_id);

-- order_items.order_id: SIN índice. Cada carga de comanda lo filtra.
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);

-- inventory por tenant+branch (dashboard: stock total de la sucursal)
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_branch
  ON public.inventory (tenant_id, branch_id);

-- customers por fecha (dashboard: clientes nuevos hoy/ayer)
CREATE INDEX IF NOT EXISTS idx_customers_tenant_created
  ON public.customers (tenant_id, created_at DESC);

-- sales: patrón exacto del dashboard/reportes (tenant+branch+status+fecha)
CREATE INDEX IF NOT EXISTS idx_sales_tenant_branch_status_created
  ON public.sales (tenant_id, branch_id, status, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 2) Reescritura masiva de políticas RLS → InitPlan
--    Recorre pg_policies y reescribe la expresión de cada política.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION pg_temp._rw_policy_expr(expr text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT
    -- 4) envolver is_super_admin() bare → (SELECT is_super_admin())
    regexp_replace(
      -- 3) "col = ANY (get_user_tenant_ids())" bare (política de tenants)
      --    → "col IN (SELECT unnest(get_user_tenant_ids()))"
      regexp_replace(
        -- 2) user_belongs_to_tenant(col) → (col IN (SELECT unnest(get_user_tenant_ids())))
        regexp_replace(
          -- 1) normalizar formas ya envueltas (idempotencia; incluye la
          --    forma normalizada "( SELECT fn() AS fn)" que produce pg_get_expr)
          replace(
            replace(expr,
              '( SELECT is_super_admin() AS is_super_admin)', 'is_super_admin()'),
            '(SELECT is_super_admin())', 'is_super_admin()'),
          '(public\.)?user_belongs_to_tenant\(([a-zA-Z_][a-zA-Z0-9_\.]*)\)',
          '(\2 IN (SELECT unnest(get_user_tenant_ids())))',
          'g'),
        '= ANY \((public\.)?get_user_tenant_ids\(\)\)',
        'IN (SELECT unnest(get_user_tenant_ids()))',
        'g'),
      '(public\.)?is_super_admin\(\)',
      '(SELECT is_super_admin())',
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
        coalesce(qual, '')       ~ 'user_belongs_to_tenant|get_user_tenant_ids|is_super_admin'
        OR coalesce(with_check, '') ~ 'user_belongs_to_tenant|get_user_tenant_ids|is_super_admin'
      )
  LOOP
    new_qual  := CASE WHEN pol.qual       IS NOT NULL THEN pg_temp._rw_policy_expr(pol.qual)       END;
    new_check := CASE WHEN pol.with_check IS NOT NULL THEN pg_temp._rw_policy_expr(pol.with_check) END;

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

  RAISE NOTICE 'Políticas RLS optimizadas: %', n_changed;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3) RPC del dashboard: 8 requests secuenciales → 1 sola llamada
--    SECURITY INVOKER: respeta RLS del usuario.
--    Los límites de fecha vienen del cliente (zona horaria local).
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_tenant_id       uuid,
  p_branch_id       uuid,
  p_today_start     timestamptz,
  p_yesterday_start timestamptz,
  p_year_start      timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'sales_today', (
      SELECT coalesce(sum(total), 0)
      FROM sales
      WHERE tenant_id = p_tenant_id AND branch_id = p_branch_id
        AND status = 'COMPLETED' AND created_at >= p_today_start
    ),
    'sales_yesterday', (
      SELECT coalesce(sum(total), 0)
      FROM sales
      WHERE tenant_id = p_tenant_id AND branch_id = p_branch_id
        AND status = 'COMPLETED'
        AND created_at >= p_yesterday_start AND created_at < p_today_start
    ),
    'active_orders', (
      SELECT count(*)
      FROM sales
      WHERE tenant_id = p_tenant_id AND branch_id = p_branch_id
        AND status = 'PENDING'
    ),
    'new_customers_today', (
      SELECT count(*)
      FROM customers
      WHERE tenant_id = p_tenant_id AND created_at >= p_today_start
    ),
    'new_customers_yesterday', (
      SELECT count(*)
      FROM customers
      WHERE tenant_id = p_tenant_id
        AND created_at >= p_yesterday_start AND created_at < p_today_start
    ),
    'total_stock', (
      SELECT coalesce(sum(quantity), 0)
      FROM inventory
      WHERE tenant_id = p_tenant_id AND branch_id = p_branch_id
    ),
    'recent_sales', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb)
      FROM (
        SELECT s.id, s.total, s.status, s.created_at,
               c.full_name AS customer_name
        FROM sales s
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.tenant_id = p_tenant_id AND s.branch_id = p_branch_id
        ORDER BY s.created_at DESC
        LIMIT 5
      ) x
    ),
    'monthly_sales', (
      SELECT coalesce(jsonb_agg(m ORDER BY m.month), '[]'::jsonb)
      FROM (
        SELECT extract(month FROM created_at)::int AS month,
               sum(total) AS total
        FROM sales
        WHERE tenant_id = p_tenant_id AND branch_id = p_branch_id
          AND status = 'COMPLETED' AND created_at >= p_year_start
        GROUP BY 1
      ) m
    )
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, uuid, timestamptz, timestamptz, timestamptz) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Verificación sugerida tras ejecutar:
--   EXPLAIN ANALYZE SELECT id FROM products WHERE tenant_id = '<tu-tenant>';
--   → el filtro RLS debe aparecer como "InitPlan" (una sola ejecución),
--     no como llamada a user_belongs_to_tenant en el Filter por fila.
-- ─────────────────────────────────────────────────────────────
