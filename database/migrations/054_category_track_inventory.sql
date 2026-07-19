-- ─────────────────────────────────────────────────────────────
-- 054 · Categorías sin control de stock
-- Permite marcar una categoría (p. ej. "Platos", "Comidas") como
-- "sin stock": sus productos se venden sin validar inventario
-- (preparados al momento). Por defecto todas manejan stock.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN categories.track_inventory IS
  'FALSE = los productos de esta categoría se venden sin validar stock (p. ej. platos preparados)';
