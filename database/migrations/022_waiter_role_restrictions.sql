-- ============================================================
-- REG-X — Migration 022: Restricción del rol WAITER (mesero)
-- ============================================================
-- Objetivo (espejo a nivel BD de la restricción de UI):
--   El mesero SOLO puede:
--     • leer el mapa de mesas y el catálogo (tables, products, categories,
--       inventory, ...)  -> SELECT permitido como cualquier miembro del tenant
--     • crear / actualizar cuentas (orders, order_items)
--     • cambiar el estado de una mesa (tables UPDATE)
--   El mesero NO puede escribir en NINGUNA otra tabla (products, inventory,
--   sales, customers, cash_registers, etc.) aunque llame a Supabase directo.
--
-- Estrategia: políticas RESTRICTIVE (se combinan con AND sobre las
-- permissive existentes) aplicadas SOLO a INSERT/UPDATE/DELETE. No tocan
-- SELECT, por lo que el mesero conserva la lectura que necesita.
--
-- Helpers reutilizados / creados: public.is_waiter()
-- Idempotente.
-- ============================================================

-- ── Helper: ¿el usuario actual es mesero (en algún tenant activo)? ──
CREATE OR REPLACE FUNCTION public.is_waiter()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenant_roles
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role::text = 'WAITER'
  );
$$;

-- ── Bloqueo de escritura para el mesero en tablas "de gestión" ──────
-- Se recorre una lista de tablas y, para cada una que exista, se crean
-- políticas RESTRICTIVE que niegan INSERT/UPDATE/DELETE si el usuario es
-- mesero. Las lecturas (SELECT) quedan intactas.
DO $$
DECLARE
  t        text;
  locked   text[] := ARRAY[
    'products', 'categories', 'brands', 'suppliers',
    'inventory', 'stock_movements',
    'customers',
    'sales', 'sale_items', 'sale_payments',
    'cash_registers',
    'tenants', 'branches', 'user_tenant_roles',
    'transfers', 'transfer_items'
  ];
BEGIN
  FOREACH t IN ARRAY locked LOOP
    -- Solo si la tabla existe en el esquema public
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'waiter_block_insert', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'waiter_block_update', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'waiter_block_delete', t);

      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_waiter())',
        'waiter_block_insert', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_waiter())',
        'waiter_block_update', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_waiter())',
        'waiter_block_delete', t);
    END IF;
  END LOOP;
END $$;

-- ── tables: el mesero SÍ puede actualizar el estado (OCCUPIED, etc.)
--     pero NO puede crear ni borrar mesas. ────────────────────────────
DROP POLICY IF EXISTS "waiter_block_insert" ON public.tables;
DROP POLICY IF EXISTS "waiter_block_delete" ON public.tables;
CREATE POLICY "waiter_block_insert" ON public.tables
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_waiter());
CREATE POLICY "waiter_block_delete" ON public.tables
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_waiter());

-- NOTA: orders y order_items NO se restringen aquí a propósito: son las
-- tablas donde el mesero crea y modifica las cuentas. Sus políticas
-- permissive (MIGRATION_restaurant_orders.sql) ya limitan por tenant.

-- ============================================================
-- Verificación rápida (opcional, ejecutar manualmente):
--   SELECT relname, polname, polcmd, polpermissive
--   FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--   WHERE polname LIKE 'waiter_block%' ORDER BY relname, polname;
-- ============================================================
