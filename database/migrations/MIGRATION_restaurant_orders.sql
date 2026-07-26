-- ============================================================
-- MIGRACIÓN: Soporte completo para órdenes de restaurante
-- Aplica en: Supabase SQL Editor
-- ============================================================

-- ── 1. Extender tabla `orders` ────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS waiter_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waiter_name text;

-- ── 2. Extender tabla `order_items` ──────────────────────────
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS name       text,
  ADD COLUMN IF NOT EXISTS sku        text,
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes      text;

-- Poblar `name` y `unit_price` en ítems existentes (desde products)
UPDATE order_items oi
SET
  name       = p.name,
  sku        = p.sku,
  unit_price = p.price
FROM products p
WHERE oi.product_id = p.id
  AND (oi.name IS NULL OR oi.unit_price = 0);

-- ── 3. RLS en `orders` ───────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier usuario activo del tenant
DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles utr
      WHERE utr.user_id   = auth.uid()
        AND utr.tenant_id = orders.tenant_id
        AND utr.is_active = true
    )
  );

-- INSERT: cualquier usuario activo (meseros, admins)
DROP POLICY IF EXISTS "orders_insert" ON orders;
CREATE POLICY "orders_insert" ON orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenant_roles utr
      WHERE utr.user_id   = auth.uid()
        AND utr.tenant_id = orders.tenant_id
        AND utr.is_active = true
    )
  );

-- UPDATE: cualquier usuario activo del tenant
DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles utr
      WHERE utr.user_id   = auth.uid()
        AND utr.tenant_id = orders.tenant_id
        AND utr.is_active = true
    )
  );

-- DELETE: solo OWNER o ADMIN
DROP POLICY IF EXISTS "orders_delete" ON orders;
CREATE POLICY "orders_delete" ON orders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles utr
      WHERE utr.user_id   = auth.uid()
        AND utr.tenant_id = orders.tenant_id
        AND utr.role      IN ('OWNER', 'ADMIN')
        AND utr.is_active = true
    )
  );

-- ── 4. RLS en `order_items` ──────────────────────────────────

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- SELECT: usuario activo del mismo tenant (via orders.tenant_id)
DROP POLICY IF EXISTS "order_items_select" ON order_items;
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM orders o
      JOIN user_tenant_roles utr
        ON utr.tenant_id = o.tenant_id
       AND utr.user_id   = auth.uid()
       AND utr.is_active = true
      WHERE o.id = order_items.order_id
    )
  );

-- INSERT: usuario activo del tenant
DROP POLICY IF EXISTS "order_items_insert" ON order_items;
CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM orders o
      JOIN user_tenant_roles utr
        ON utr.tenant_id = o.tenant_id
       AND utr.user_id   = auth.uid()
       AND utr.is_active = true
      WHERE o.id = order_items.order_id
    )
  );

-- UPDATE: usuario activo del tenant
DROP POLICY IF EXISTS "order_items_update" ON order_items;
CREATE POLICY "order_items_update" ON order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM orders o
      JOIN user_tenant_roles utr
        ON utr.tenant_id = o.tenant_id
       AND utr.user_id   = auth.uid()
       AND utr.is_active = true
      WHERE o.id = order_items.order_id
    )
  );

-- ── 5. Habilitar Realtime en tabla `tables` ──────────────────
-- (Solo si no está habilitado ya)
ALTER PUBLICATION supabase_realtime ADD TABLE tables;

-- ── 6. Índices útiles ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
