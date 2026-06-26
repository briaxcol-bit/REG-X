-- ============================================================
-- REG-X — Migration 002: Row Level Security Policies
-- ============================================================

-- Enable RLS on all multitenant tables
ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands               ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables               ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_feature_flags ENABLE ROW LEVEL SECURITY;

-- ── Helper function: get current user's tenants ───────────────
CREATE OR REPLACE FUNCTION get_user_tenant_ids()
RETURNS UUID[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT ARRAY(
    SELECT tenant_id FROM user_tenant_roles
    WHERE user_id = auth.uid() AND is_active = TRUE
  );
$$;

-- ── Helper: check if user belongs to a tenant ────────────────
CREATE OR REPLACE FUNCTION user_belongs_to_tenant(p_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_tenant_roles
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND is_active = TRUE
  );
$$;

-- ── Helper: user's role in a tenant ──────────────────────────
CREATE OR REPLACE FUNCTION user_role_in_tenant(p_tenant_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role::TEXT FROM user_tenant_roles
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND is_active = TRUE
  LIMIT 1;
$$;

-- ── Macro: standard multitenant SELECT policy ─────────────────
-- Pattern: user can SELECT rows where they belong to the tenant

-- tenants: users see only their own tenants
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (id = ANY(get_user_tenant_ids()));

CREATE POLICY "tenants_insert" ON tenants
  FOR INSERT WITH CHECK (TRUE); -- Handled by backend service role

CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (
    id = ANY(get_user_tenant_ids()) AND
    user_role_in_tenant(id) IN ('OWNER', 'ADMIN')
  );

-- branches
CREATE POLICY "branches_select" ON branches
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "branches_insert" ON branches
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
  );

CREATE POLICY "branches_update" ON branches
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
  );

-- user_profiles: users see their own profile
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- user_tenant_roles
CREATE POLICY "user_tenant_roles_select" ON user_tenant_roles
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

-- products
CREATE POLICY "products_select" ON products
  FOR SELECT USING (user_belongs_to_tenant(tenant_id) AND deleted_at IS NULL);

CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

CREATE POLICY "products_update" ON products
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

CREATE POLICY "products_delete" ON products
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
  );

-- categories, brands, suppliers — same pattern as products
CREATE POLICY "categories_select" ON categories FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (
  user_belongs_to_tenant(tenant_id) AND
  user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (
  user_belongs_to_tenant(tenant_id) AND
  user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
);
CREATE POLICY "brands_select"     ON brands     FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "suppliers_select"  ON suppliers  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

-- inventory
CREATE POLICY "inventory_select" ON inventory
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "inventory_insert" ON inventory
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

CREATE POLICY "inventory_update" ON inventory
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

-- stock_movements
CREATE POLICY "stock_movements_select" ON stock_movements
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "stock_movements_insert" ON stock_movements
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));

-- customers
CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (user_belongs_to_tenant(tenant_id) AND deleted_at IS NULL);

CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));

-- sales
CREATE POLICY "sales_select" ON sales
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "sales_insert" ON sales
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'CASHIER', 'WAITER')
  );

-- sale_items and sale_payments (parent-based security)
CREATE POLICY "sale_items_select" ON sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND user_belongs_to_tenant(sales.tenant_id))
  );

CREATE POLICY "sale_items_insert" ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND user_belongs_to_tenant(sales.tenant_id))
  );

CREATE POLICY "sale_payments_select" ON sale_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_payments.sale_id AND user_belongs_to_tenant(sales.tenant_id))
);

-- tables
CREATE POLICY "tables_select" ON tables FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tables_update" ON tables FOR UPDATE USING (user_belongs_to_tenant(tenant_id));

-- orders
CREATE POLICY "orders_select" ON orders FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (user_belongs_to_tenant(tenant_id));

-- cash_registers
CREATE POLICY "cash_registers_select" ON cash_registers FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "cash_registers_update" ON cash_registers FOR UPDATE USING (
  user_belongs_to_tenant(tenant_id) AND
  user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'CASHIER', 'ACCOUNTANT')
);

-- notifications: personal
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR user_belongs_to_tenant(tenant_id));

-- audit_logs: admins only
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
  );

-- api_keys, webhooks
CREATE POLICY "api_keys_select" ON api_keys FOR SELECT USING (
  user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
);
CREATE POLICY "webhook_endpoints_select" ON webhook_endpoints FOR SELECT USING (
  user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
);

-- subscriptions
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT USING (user_belongs_to_tenant(tenant_id));

-- tenant_modules / feature_flags
CREATE POLICY "tenant_modules_select" ON tenant_modules FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_feature_flags_select" ON tenant_feature_flags FOR SELECT USING (user_belongs_to_tenant(tenant_id));

-- promotions
CREATE POLICY "promotions_select" ON promotions FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "promotions_insert" ON promotions FOR INSERT WITH CHECK (
  user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
);
