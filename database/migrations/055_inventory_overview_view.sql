-- ─────────────────────────────────────────────────────────────
-- 055 · Vista de inventario legible
-- El editor de tablas de Supabase solo muestra product_id (uuid)
-- en `inventory`. Esta vista une inventario + producto + categoría
-- + bodega para inspeccionar el stock con nombres reales.
-- Aparece en Supabase: Table Editor → esquema public → inventory_overview
-- (o Database → Views).
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW inventory_overview
WITH (security_invoker = on)   -- respeta RLS del usuario que consulta
AS
SELECT
  i.id,
  i.tenant_id,
  i.branch_id,
  p.name         AS producto,
  p.sku,
  p.barcode      AS codigo_barras,
  c.name         AS categoria,
  i.quantity     AS cantidad,
  i.reserved     AS reservado,
  p.min_stock    AS stock_minimo,
  w.name         AS bodega,
  p.status       AS estado_producto,
  i.updated_at
FROM inventory i
JOIN      products   p ON p.id = i.product_id
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN warehouses w ON w.id = i.warehouse_id
WHERE p.deleted_at IS NULL;

COMMENT ON VIEW inventory_overview IS
  'Inventario con nombre de producto, categoría y bodega — solo lectura, para inspección en Supabase.';
