-- ============================================================
-- REG-X — Migration 023: Trazabilidad por ítem (quién agregó qué)
-- ============================================================
-- Modelo: cualquier mesero puede agregar productos a cualquier mesa,
-- pero cada order_item registra QUIÉN lo agregó.
--
--   added_by       -> uuid del usuario que agregó el ítem (default auth.uid())
--   added_by_name  -> nombre visible del mesero (lo envía el cliente)
--
-- Backfill: los ítems existentes se atribuyen al mesero que abrió la orden.
-- Idempotente.
-- ============================================================

-- ── 1. Columnas nuevas ───────────────────────────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS added_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS added_by_name text;

-- Default a nivel BD: si el cliente no lo envía, se sella el usuario real
-- de la sesión (defensa en profundidad — el nombre lo pone el cliente).
ALTER TABLE public.order_items
  ALTER COLUMN added_by SET DEFAULT auth.uid();

-- ── 2. Backfill de ítems existentes desde la orden padre ─────
UPDATE public.order_items oi
SET
  added_by      = COALESCE(oi.added_by, o.waiter_id),
  added_by_name = COALESCE(oi.added_by_name, o.waiter_name)
FROM public.orders o
WHERE oi.order_id = o.id
  AND (oi.added_by IS NULL OR oi.added_by_name IS NULL);

-- ── 3. Índice para consultas por mesero ──────────────────────
CREATE INDEX IF NOT EXISTS idx_order_items_added_by ON public.order_items(added_by);

-- NOTA: no se requieren nuevas políticas RLS. Las columnas viajan con la
-- fila de order_items, cuyas policies (MIGRATION_restaurant_orders.sql) ya
-- permiten insertar/leer a cualquier miembro activo del tenant.
