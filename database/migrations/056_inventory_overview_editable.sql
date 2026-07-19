-- ─────────────────────────────────────────────────────────────
-- 056 · inventory_overview editable (alta rápida de productos)
-- Permite INSERTAR y ACTUALIZAR desde la vista:
--   INSERT → crea el producto (+ categoría si no existe, + bodega
--            principal si no existe) y su fila de inventario.
--   UPDATE → actualiza cantidad / precio / nombre / mínimo y
--            registra el movimiento de stock.
-- Campos mínimos para insertar: tenant_id, branch_id, producto.
-- Opcionales: sku, codigo_barras, categoria (por nombre), precio,
--             costo, cantidad, stock_minimo.
-- ─────────────────────────────────────────────────────────────

-- Redefinir la vista incluyendo precio y costo (editables)
DROP VIEW IF EXISTS inventory_overview;

CREATE VIEW inventory_overview
WITH (security_invoker = on)
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
  p.price        AS precio,
  p.cost_price   AS costo,
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
  'Inventario legible y editable: INSERT crea producto+stock, UPDATE ajusta cantidad/precio.';

-- ── INSERT: alta rápida de producto + stock ──────────────────
CREATE OR REPLACE FUNCTION inventory_overview_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_category_id  UUID;
  v_warehouse_id UUID;
  v_product_id   UUID;
  v_qty          NUMERIC := COALESCE(NEW.cantidad, 0);
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.branch_id IS NULL OR NEW.producto IS NULL THEN
    RAISE EXCEPTION 'tenant_id, branch_id y producto son obligatorios';
  END IF;

  -- Categoría por nombre: buscar o crear
  IF NEW.categoria IS NOT NULL AND btrim(NEW.categoria) <> '' THEN
    SELECT id INTO v_category_id FROM categories
    WHERE tenant_id = NEW.tenant_id
      AND lower(name) = lower(btrim(NEW.categoria))
      AND deleted_at IS NULL
    LIMIT 1;
    IF v_category_id IS NULL THEN
      INSERT INTO categories (tenant_id, name, is_active)
      VALUES (NEW.tenant_id, btrim(NEW.categoria), TRUE)
      RETURNING id INTO v_category_id;
    END IF;
  END IF;

  -- Bodega de la sucursal: buscar o crear la principal
  SELECT id INTO v_warehouse_id FROM warehouses
  WHERE tenant_id = NEW.tenant_id AND branch_id = NEW.branch_id
  ORDER BY is_default DESC NULLS LAST
  LIMIT 1;
  IF v_warehouse_id IS NULL THEN
    INSERT INTO warehouses (tenant_id, branch_id, name, code, is_default, is_active)
    VALUES (NEW.tenant_id, NEW.branch_id, 'Bodega Principal', 'MAIN', TRUE, TRUE)
    RETURNING id INTO v_warehouse_id;
  END IF;

  -- Producto
  INSERT INTO products (tenant_id, name, sku, barcode, category_id, price, cost_price, min_stock, status)
  VALUES (
    NEW.tenant_id,
    btrim(NEW.producto),
    COALESCE(NULLIF(btrim(NEW.sku), ''), 'SKU-' || upper(substr(md5(random()::text), 1, 8))),
    NULLIF(btrim(NEW.codigo_barras), ''),
    v_category_id,
    COALESCE(NEW.precio, 0),
    NEW.costo,
    COALESCE(NEW.stock_minimo, 0),
    'ACTIVE'
  )
  RETURNING id INTO v_product_id;

  -- Inventario
  INSERT INTO inventory (tenant_id, branch_id, warehouse_id, product_id, quantity)
  VALUES (NEW.tenant_id, NEW.branch_id, v_warehouse_id, v_product_id, v_qty);

  -- Movimiento inicial (auditoría)
  IF v_qty <> 0 THEN
    INSERT INTO stock_movements (tenant_id, branch_id, warehouse_id, product_id, type, quantity, unit_cost, reference_type, notes)
    VALUES (NEW.tenant_id, NEW.branch_id, v_warehouse_id, v_product_id, 'ADJUSTMENT', abs(v_qty), NEW.costo, 'MANUAL_ADJUSTMENT', 'Alta rápida desde inventory_overview');
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER inventory_overview_insert_trg
INSTEAD OF INSERT ON inventory_overview
FOR EACH ROW EXECUTE FUNCTION inventory_overview_insert();

-- ── UPDATE: ajustar cantidad / datos del producto ────────────
CREATE OR REPLACE FUNCTION inventory_overview_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_product_id   UUID;
  v_warehouse_id UUID;
  v_delta        NUMERIC;
BEGIN
  SELECT product_id, warehouse_id INTO v_product_id, v_warehouse_id
  FROM inventory WHERE id = OLD.id;

  -- Cantidad
  IF NEW.cantidad IS DISTINCT FROM OLD.cantidad THEN
    UPDATE inventory SET quantity = COALESCE(NEW.cantidad, 0), updated_at = NOW()
    WHERE id = OLD.id;
    v_delta := COALESCE(NEW.cantidad, 0) - COALESCE(OLD.cantidad, 0);
    INSERT INTO stock_movements (tenant_id, branch_id, warehouse_id, product_id, type, quantity, reference_type, notes)
    VALUES (OLD.tenant_id, OLD.branch_id, v_warehouse_id, v_product_id, 'ADJUSTMENT', abs(v_delta), 'MANUAL_ADJUSTMENT',
            'Ajuste desde inventory_overview (' || CASE WHEN v_delta > 0 THEN '+' ELSE '' END || v_delta || ' uds)');
  END IF;

  -- Datos del producto
  UPDATE products SET
    name      = COALESCE(btrim(NEW.producto), name),
    price     = COALESCE(NEW.precio, price),
    cost_price= COALESCE(NEW.costo, cost_price),
    min_stock = COALESCE(NEW.stock_minimo, min_stock),
    barcode   = COALESCE(NULLIF(btrim(NEW.codigo_barras), ''), barcode),
    updated_at= NOW()
  WHERE id = v_product_id;

  RETURN NEW;
END $$;

CREATE TRIGGER inventory_overview_update_trg
INSTEAD OF UPDATE ON inventory_overview
FOR EACH ROW EXECUTE FUNCTION inventory_overview_update();
