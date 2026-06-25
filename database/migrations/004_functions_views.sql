-- ============================================================
-- REG-X — Migration 004: Functions, Views, Materialized Views
-- ============================================================

-- ── create_sale_transaction (atomic sale + items + payments) ──
CREATE OR REPLACE FUNCTION create_sale_transaction(
  p_sale     JSONB,
  p_items    JSONB,
  p_payments JSONB
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sale_id UUID;
  v_item    JSONB;
  v_payment JSONB;
BEGIN
  -- Insert sale
  INSERT INTO sales SELECT * FROM jsonb_populate_record(NULL::sales, p_sale)
  RETURNING id INTO v_sale_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items SELECT * FROM jsonb_populate_record(NULL::sale_items, v_item);
    -- Decrease stock
    IF (v_item->>'product_id') IS NOT NULL THEN
      UPDATE inventory
        SET quantity   = quantity - (v_item->>'quantity')::NUMERIC,
            updated_at = NOW()
        WHERE product_id = (v_item->>'product_id')::UUID
          AND tenant_id  = (p_sale->>'tenant_id')::UUID;
      -- Record stock movement
      INSERT INTO stock_movements (tenant_id, branch_id, warehouse_id, product_id, variant_id, type, quantity, reference_type, reference_id, created_by)
        SELECT
          (p_sale->>'tenant_id')::UUID,
          (p_sale->>'branch_id')::UUID,
          (SELECT id FROM warehouses WHERE branch_id = (p_sale->>'branch_id')::UUID AND is_default = TRUE LIMIT 1),
          (v_item->>'product_id')::UUID,
          NULLIF(v_item->>'variant_id', '')::UUID,
          'SALE',
          -((v_item->>'quantity')::NUMERIC),
          'SALE',
          v_sale_id,
          (p_sale->>'created_by')::UUID;
    END IF;
  END LOOP;

  -- Insert payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO sale_payments SELECT * FROM jsonb_populate_record(NULL::sale_payments, v_payment || jsonb_build_object('sale_id', v_sale_id));
  END LOOP;

  RETURN v_sale_id;
END;
$$;

-- ── increment_loyalty_points ───────────────────────────────────
CREATE OR REPLACE FUNCTION increment_loyalty_points(
  p_customer_id UUID,
  p_tenant_id   UUID,
  p_amount      NUMERIC,
  p_rate        NUMERIC DEFAULT 0.01  -- 1% of sale = points
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE customers
    SET loyalty_points = loyalty_points + FLOOR(p_amount * p_rate),
        updated_at     = NOW()
    WHERE id = p_customer_id AND tenant_id = p_tenant_id;
END;
$$;

-- ── get_daily_sales_summary ────────────────────────────────────
CREATE OR REPLACE FUNCTION get_daily_sales_summary(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_date      DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_sales    BIGINT,
  total_revenue  NUMERIC,
  total_tax      NUMERIC,
  total_discount NUMERIC,
  avg_ticket     NUMERIC,
  payment_methods JSONB
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    COUNT(*)                              AS total_sales,
    COALESCE(SUM(total), 0)              AS total_revenue,
    COALESCE(SUM(tax_total), 0)          AS total_tax,
    COALESCE(SUM(discount_total), 0)     AS total_discount,
    COALESCE(AVG(total), 0)              AS avg_ticket,
    (
      SELECT jsonb_object_agg(method, amount_sum)
      FROM (
        SELECT sp.method, SUM(sp.amount) AS amount_sum
        FROM sale_payments sp
        JOIN sales s2 ON s2.id = sp.sale_id
        WHERE s2.tenant_id = p_tenant_id
          AND (p_branch_id IS NULL OR s2.branch_id = p_branch_id)
          AND s2.status = 'COMPLETED'
          AND DATE(s2.created_at) = p_date
        GROUP BY sp.method
      ) pm
    )                                    AS payment_methods
  FROM sales
  WHERE tenant_id = p_tenant_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND status = 'COMPLETED'
    AND DATE(created_at) = p_date;
$$;

-- ── get_inventory_alerts ───────────────────────────────────────
CREATE OR REPLACE FUNCTION get_inventory_alerts(p_tenant_id UUID)
RETURNS TABLE (
  product_id   UUID,
  product_name TEXT,
  sku          TEXT,
  current_qty  NUMERIC,
  min_stock    NUMERIC,
  warehouse_id UUID
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    p.id,
    p.name,
    p.sku,
    i.quantity,
    p.min_stock,
    i.warehouse_id
  FROM inventory i
  JOIN products p ON p.id = i.product_id
  WHERE p.tenant_id = p_tenant_id
    AND p.track_inventory = TRUE
    AND p.deleted_at IS NULL
    AND i.quantity <= p.min_stock
  ORDER BY (i.quantity / NULLIF(p.min_stock, 0)) ASC;
$$;

-- ── VIEWS ─────────────────────────────────────────────────────

-- v_sales_with_details
CREATE OR REPLACE VIEW v_sales_with_details AS
SELECT
  s.*,
  c.full_name      AS customer_name,
  c.phone          AS customer_phone,
  b.name           AS branch_name,
  COUNT(si.id)     AS item_count
FROM sales s
LEFT JOIN customers c ON c.id = s.customer_id
LEFT JOIN branches  b ON b.id = s.branch_id
LEFT JOIN sale_items si ON si.sale_id = s.id
GROUP BY s.id, c.full_name, c.phone, b.name;

-- v_inventory_with_product
CREATE OR REPLACE VIEW v_inventory_with_product AS
SELECT
  i.*,
  p.name        AS product_name,
  p.sku         AS product_sku,
  p.barcode     AS product_barcode,
  p.min_stock,
  p.max_stock,
  p.status      AS product_status,
  w.name        AS warehouse_name,
  CASE WHEN i.quantity <= p.min_stock THEN TRUE ELSE FALSE END AS is_low_stock
FROM inventory i
JOIN products  p ON p.id = i.product_id
JOIN warehouses w ON w.id = i.warehouse_id
WHERE p.deleted_at IS NULL;

-- v_table_with_order
CREATE OR REPLACE VIEW v_table_with_order AS
SELECT
  t.*,
  o.id          AS active_order_id,
  o.status      AS order_status,
  o.created_at  AS order_opened_at,
  da.name       AS area_name
FROM tables t
LEFT JOIN orders o ON o.table_id = t.id AND o.status NOT IN ('SERVED', 'CANCELLED')
LEFT JOIN dining_areas da ON da.id = t.area_id;

-- v_active_cash_registers
CREATE OR REPLACE VIEW v_active_cash_registers AS
SELECT
  cr.*,
  up.full_name AS opened_by_name,
  b.name       AS branch_name,
  COALESCE(SUM(s.total), 0) AS sales_total
FROM cash_registers cr
LEFT JOIN user_profiles up ON up.id = cr.opened_by
LEFT JOIN branches b ON b.id = cr.branch_id
LEFT JOIN sales s ON s.cash_register_id = cr.id AND s.status = 'COMPLETED'
WHERE cr.status = 'OPEN'
GROUP BY cr.id, up.full_name, b.name;

-- ── MATERIALIZED VIEW: daily_sales_mv ────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_sales AS
SELECT
  tenant_id,
  branch_id,
  DATE(created_at)          AS sale_date,
  COUNT(*)                  AS total_transactions,
  SUM(total)                AS total_revenue,
  SUM(tax_total)            AS total_tax,
  SUM(discount_total)       AS total_discount,
  AVG(total)                AS avg_ticket,
  MIN(total)                AS min_ticket,
  MAX(total)                AS max_ticket
FROM sales
WHERE status = 'COMPLETED'
GROUP BY tenant_id, branch_id, DATE(created_at)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_sales ON mv_daily_sales (tenant_id, branch_id, sale_date);

-- Refresh function (call via cron or after each sale batch)
CREATE OR REPLACE FUNCTION refresh_daily_sales_mv()
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales;
$$;

-- ── MATERIALIZED VIEW: mv_product_sales_rank ─────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_sales_rank AS
SELECT
  s.tenant_id,
  s.branch_id,
  si.product_id,
  p.name           AS product_name,
  p.sku,
  DATE_TRUNC('month', s.created_at) AS month,
  SUM(si.quantity) AS total_quantity,
  SUM(si.total)    AS total_revenue,
  COUNT(DISTINCT s.id) AS sale_count
FROM sale_items si
JOIN sales     s ON s.id = si.sale_id
JOIN products  p ON p.id = si.product_id
WHERE s.status = 'COMPLETED'
GROUP BY s.tenant_id, s.branch_id, si.product_id, p.name, p.sku, DATE_TRUNC('month', s.created_at)
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_mv_product_sales ON mv_product_sales_rank (tenant_id, month DESC, total_revenue DESC);
