-- ============================================================
-- REG-X — Migration 003: Indexes, Constraints, Full-text Search
-- ============================================================

-- ── Tenants ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_slug       ON tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_plan       ON tenants (plan);
CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants (deleted_at) WHERE deleted_at IS NULL;

-- ── Branches ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_branches_tenant    ON branches (tenant_id);

-- ── User tenant roles ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_utr_user       ON user_tenant_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_utr_tenant     ON user_tenant_roles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_utr_user_tenant ON user_tenant_roles (user_id, tenant_id) WHERE is_active = TRUE;

-- ── Products ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_tenant      ON products (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku         ON products (tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode     ON products (tenant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category    ON products (category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_status      ON products (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_products_deleted     ON products (deleted_at) WHERE deleted_at IS NULL;

-- Full-text search on products
CREATE INDEX IF NOT EXISTS idx_products_fts ON products
  USING gin(to_tsvector('spanish', coalesce(name,'') || ' ' || coalesce(sku,'') || ' ' || coalesce(description,'')));

-- Trigram index for LIKE/ILIKE searches
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm  ON products USING gin(sku gin_trgm_ops);

-- ── Inventory ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_tenant    ON inventory (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product   ON inventory (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory (tenant_id, product_id)
  WHERE quantity <= 0;

-- ── Stock movements ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stock_mov_tenant    ON stock_movements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mov_product   ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mov_warehouse ON stock_movements (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_ref       ON stock_movements (reference_type, reference_id);

-- ── Customers ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_tenant   ON customers (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email    ON customers (tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone    ON customers (tenant_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_fts ON customers
  USING gin(to_tsvector('spanish', coalesce(full_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'')));

-- ── Sales ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_tenant          ON sales (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_branch          ON sales (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer        ON sales (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_status          ON sales (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_order_number    ON sales (tenant_id, order_number);
CREATE INDEX IF NOT EXISTS idx_sales_cash_register   ON sales (cash_register_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_range      ON sales (tenant_id, created_at) WHERE status = 'COMPLETED';

-- ── Sale items ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sale_items_sale       ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product    ON sale_items (product_id);

-- ── Orders (Restaurant) ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_tenant         ON orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_table          ON orders (table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders (tenant_id, status) WHERE status NOT IN ('SERVED', 'CANCELLED');
CREATE INDEX IF NOT EXISTS idx_orders_waiter         ON orders (waiter_id);

-- ── Tables ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tables_tenant         ON tables (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tables_status         ON tables (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tables_area           ON tables (area_id);

-- ── Cash registers ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cash_reg_tenant       ON cash_registers (tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_reg_status       ON cash_registers (tenant_id, status);

-- ── Audit logs ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_tenant          ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user            ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource        ON audit_logs (resource_type, resource_id);

-- ── Subscriptions ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant  ON subscriptions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions (status, current_period_end);

-- ── Promotions ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_promotions_tenant     ON promotions (tenant_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_promotions_dates      ON promotions (start_at, end_at) WHERE is_active = TRUE;

-- ── Notifications ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notif_user            ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notif_tenant          ON notifications (tenant_id, created_at DESC);

-- ── Webhook deliveries ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_webhook_del_endpoint  ON webhook_deliveries (endpoint_id, delivered_at DESC);

-- ── Coupons ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coupons_tenant_code   ON coupons (tenant_id, code);
