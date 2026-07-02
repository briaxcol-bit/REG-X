-- ============================================================
-- REG-X — Migration 022: Restricción del rol WAITER (mesero)
-- ============================================================
-- El mesero SOLO puede:
--   • leer mapa de mesas y catálogo (SELECT como cualquier miembro)
--   • crear / actualizar cuentas (orders, order_items)
--   • cambiar el estado de una mesa (tables UPDATE)
-- NO puede escribir en ninguna otra tabla (products, inventory, sales,
-- customers, cash_registers, etc.), aunque llame a Supabase directo.
--
-- Estrategia: políticas RESTRICTIVE (se combinan con AND sobre las
-- permissive existentes) SOLO en INSERT/UPDATE/DELETE. No tocan SELECT.
--
-- La restricción es POR TENANT: usa is_waiter_only(tenant), que solo es
-- true cuando el usuario es EXCLUSIVAMENTE mesero en ese tenant. Así un
-- OWNER/ADMIN que además tenga un rol WAITER (p. ej. de pruebas) no queda
-- bloqueado donde tiene privilegios.
--
-- Idempotente: vuelve a ejecutarla cuantas veces necesites.
-- ============================================================

-- ── 1) Eliminar TODAS las políticas waiter_block_* previas ──────────
-- (deben irse ANTES de tocar la función de la que dependen)
DO $$
DECLARE
  t   text;
  all_tables text[] := ARRAY[
    'products', 'categories', 'brands', 'suppliers',
    'inventory', 'stock_movements',
    'customers',
    'sales', 'sale_items', 'sale_payments',
    'cash_registers',
    'tenants', 'branches', 'user_tenant_roles',
    'transfers', 'transfer_items',
    'tables'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'waiter_block_insert', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'waiter_block_update', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'waiter_block_delete', t);
    END IF;
  END LOOP;
END $$;

-- ── 2) Eliminar la función global anterior (ya sin dependientes) ────
DROP FUNCTION IF EXISTS public.is_waiter();

-- ── 3) Helper: ¿usuario EXCLUSIVAMENTE mesero en ESTE tenant? ───────
CREATE OR REPLACE FUNCTION public.is_waiter_only(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p_tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
        AND tenant_id = p_tenant_id
        AND is_active = true
        AND role::text = 'WAITER'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
        AND tenant_id = p_tenant_id
        AND is_active = true
        AND role::text <> 'WAITER'
    );
$$;

-- ── 4a) Tablas CON columna tenant_id (bloqueo total de escritura) ───
DO $$
DECLARE
  t        text;
  locked   text[] := ARRAY[
    'products', 'categories', 'brands', 'suppliers',
    'inventory', 'stock_movements',
    'customers',
    'sales',
    'cash_registers',
    'branches', 'user_tenant_roles',
    'transfers'
  ];
BEGIN
  FOREACH t IN ARRAY locked LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id'
       )
    THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_waiter_only(tenant_id))',
        'waiter_block_insert', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_waiter_only(tenant_id))',
        'waiter_block_update', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_waiter_only(tenant_id))',
        'waiter_block_delete', t);
    END IF;
  END LOOP;
END $$;

-- ── 4b) tenants: el propio tenant se identifica por su columna id ───
CREATE POLICY "waiter_block_insert" ON public.tenants
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_waiter_only(id));
CREATE POLICY "waiter_block_update" ON public.tenants
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_waiter_only(id));
CREATE POLICY "waiter_block_delete" ON public.tenants
  AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_waiter_only(id));

-- ── 4c) Tablas hijas: tenant vía la fila padre ─────────────────────
-- sale_items / sale_payments -> sales.tenant_id
CREATE POLICY "waiter_block_insert" ON public.sale_items
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_waiter_only((SELECT s.tenant_id FROM public.sales s WHERE s.id = sale_items.sale_id)));
CREATE POLICY "waiter_block_update" ON public.sale_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_waiter_only((SELECT s.tenant_id FROM public.sales s WHERE s.id = sale_items.sale_id)));
CREATE POLICY "waiter_block_delete" ON public.sale_items
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_waiter_only((SELECT s.tenant_id FROM public.sales s WHERE s.id = sale_items.sale_id)));

CREATE POLICY "waiter_block_insert" ON public.sale_payments
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_waiter_only((SELECT s.tenant_id FROM public.sales s WHERE s.id = sale_payments.sale_id)));
CREATE POLICY "waiter_block_update" ON public.sale_payments
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_waiter_only((SELECT s.tenant_id FROM public.sales s WHERE s.id = sale_payments.sale_id)));
CREATE POLICY "waiter_block_delete" ON public.sale_payments
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_waiter_only((SELECT s.tenant_id FROM public.sales s WHERE s.id = sale_payments.sale_id)));

-- transfer_items -> transfers.tenant_id
CREATE POLICY "waiter_block_insert" ON public.transfer_items
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_waiter_only((SELECT tr.tenant_id FROM public.transfers tr WHERE tr.id = transfer_items.transfer_id)));
CREATE POLICY "waiter_block_update" ON public.transfer_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_waiter_only((SELECT tr.tenant_id FROM public.transfers tr WHERE tr.id = transfer_items.transfer_id)));
CREATE POLICY "waiter_block_delete" ON public.transfer_items
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_waiter_only((SELECT tr.tenant_id FROM public.transfers tr WHERE tr.id = transfer_items.transfer_id)));

-- ── 4d) tables: el mesero SÍ actualiza estado; NO crea ni borra ─────
CREATE POLICY "waiter_block_insert" ON public.tables
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_waiter_only(tenant_id));
CREATE POLICY "waiter_block_delete" ON public.tables
  AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_waiter_only(tenant_id));

-- NOTA: orders y order_items NO se restringen: son donde el mesero crea y
-- modifica las cuentas. Sus policies permissive ya limitan por tenant.

-- ============================================================
-- Verificación (opcional):
--   SELECT c.relname, p.polname, p.polcmd
--   FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--   WHERE p.polname LIKE 'waiter_block%' ORDER BY 1, 2;
-- ============================================================
