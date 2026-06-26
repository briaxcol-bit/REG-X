-- ============================================================
-- REG-X ERP/POS SaaS Enterprise — Migration 001
-- Initial Schema: Tenants, Users, RBAC, Products,
--                 Inventory, Sales, POS, Subscriptions
-- Compatible with Supabase PostgreSQL
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- Fuzzy search
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- Accent-insensitive search
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- Exclusion constraints

-- ── Custom types ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE business_type AS ENUM (
    'STORE', 'RESTAURANT', 'BAR', 'RESTOBAR',
    'BAKERY', 'ICE_CREAM_SHOP', 'PHARMACY', 'MINIMARKET', 'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_role AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'SALES_MANAGER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE business_role AS ENUM (
    'OWNER', 'ADMIN', 'CASHIER', 'WAITER',
    'CHEF', 'BARTENDER', 'ACCOUNTANT', 'INVENTORY_MANAGER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sale_status AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'TRANSFER', 'QR', 'GIFT_CARD', 'MIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM (
    'IN', 'OUT', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT',
    'PURCHASE', 'SALE', 'RETURN', 'WASTE', 'PRODUCTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE table_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cash_register_status AS ENUM ('OPEN', 'CLOSED', 'PAUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SECTION 1: PLATFORM — Tenants & Users
-- ============================================================

-- ── tenants ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  business_type   business_type NOT NULL DEFAULT 'STORE',
  plan            subscription_plan NOT NULL DEFAULT 'FREE',
  logo_url        TEXT,
  primary_color   VARCHAR(7) DEFAULT '#F20D18',
  country         VARCHAR(3) DEFAULT 'CO',      -- ISO 3166-1 alpha-3
  currency        VARCHAR(3) DEFAULT 'COP',     -- ISO 4217
  timezone        VARCHAR(64) DEFAULT 'America/Bogota',
  locale          VARCHAR(10) DEFAULT 'es-CO',
  tax_id          VARCHAR(50),                  -- NIT, RFC, RUC, etc.
  address         JSONB,
  settings        JSONB DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  trial_ends_at   TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ── branches ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(20) NOT NULL,
  address         JSONB,
  phone           VARCHAR(50),
  email           VARCHAR(255),
  currency        VARCHAR(3),
  timezone        VARCHAR(64),
  is_main         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  settings        JSONB DEFAULT '{}',
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (tenant_id, code)
);

-- ── user_profiles (extends Supabase auth.users) ──────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       VARCHAR(255),
  avatar_url      TEXT,
  phone           VARCHAR(50),
  platform_role   platform_role,
  locale          VARCHAR(10) DEFAULT 'es-CO',
  settings        JSONB DEFAULT '{}',
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── user_tenant_roles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_tenant_roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  role            business_role NOT NULL DEFAULT 'CASHIER',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by      UUID,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tenant_id)
);

-- ── roles (custom roles per tenant) ──────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

-- ── permissions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permission_key  VARCHAR(100) NOT NULL UNIQUE,
  description     TEXT,
  module          VARCHAR(50) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── role_permissions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- SECTION 2: SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan                    subscription_plan NOT NULL,
  status                  subscription_status NOT NULL DEFAULT 'TRIAL',
  billing_cycle           VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
  price                   NUMERIC(12,2) NOT NULL,
  currency                VARCHAR(3) NOT NULL DEFAULT 'USD',
  trial_ends_at           TIMESTAMPTZ,
  current_period_start    TIMESTAMPTZ NOT NULL,
  current_period_end      TIMESTAMPTZ NOT NULL,
  cancelled_at            TIMESTAMPTZ,
  cancel_reason           TEXT,
  external_subscription_id VARCHAR(255),   -- Stripe / MercadoPago ID
  created_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 3: PRODUCTS & CATALOG
-- ============================================================

-- ── categories ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255),
  description     TEXT,
  color           VARCHAR(7) DEFAULT '#374151',
  icon            VARCHAR(100),
  image_url       TEXT,
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ── brands ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  logo_url        TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (tenant_id, name)
);

-- ── suppliers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  tax_id          VARCHAR(50),
  email           VARCHAR(255),
  phone           VARCHAR(50),
  address         JSONB,
  contact_name    VARCHAR(255),
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ── products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id             UUID REFERENCES branches(id) ON DELETE SET NULL,
  category_id           UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id              UUID REFERENCES brands(id) ON DELETE SET NULL,
  supplier_id           UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  sku                   VARCHAR(100) NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  price                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price            NUMERIC(12,2),
  currency              VARCHAR(3) NOT NULL DEFAULT 'COP',
  tax                   NUMERIC(5,2) NOT NULL DEFAULT 0,
  image_url             TEXT,
  barcode               VARCHAR(100),
  unit                  VARCHAR(20) NOT NULL DEFAULT 'UNIT',
  min_stock             NUMERIC(12,3) NOT NULL DEFAULT 0,
  max_stock             NUMERIC(12,3),
  track_inventory       BOOLEAN NOT NULL DEFAULT TRUE,
  allow_negative_stock  BOOLEAN NOT NULL DEFAULT FALSE,
  status                product_status NOT NULL DEFAULT 'ACTIVE',
  tags                  TEXT[] DEFAULT '{}',
  meta                  JSONB DEFAULT '{}',
  created_by            UUID,
  updated_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  UNIQUE (tenant_id, sku)
);

-- ── product_variants ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku             VARCHAR(100) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  price           NUMERIC(12,2),
  cost_price      NUMERIC(12,2),
  barcode         VARCHAR(100),
  attributes      JSONB DEFAULT '{}',  -- {"size": "L", "color": "Red"}
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sku)
);

-- ── recipes (for restaurants, bakeries) ──────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  yield_quantity  NUMERIC(12,3) NOT NULL DEFAULT 1,
  yield_unit      VARCHAR(20) NOT NULL DEFAULT 'UNIT',
  instructions    TEXT,
  prep_time_min   INTEGER,
  cook_time_min   INTEGER,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id   UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity        NUMERIC(12,4) NOT NULL,
  unit            VARCHAR(20) NOT NULL,
  notes           TEXT
);

-- ============================================================
-- SECTION 4: INVENTORY
-- ============================================================

-- ── warehouses ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(20) NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

-- ── inventory (current stock per product per warehouse) ───────
CREATE TABLE IF NOT EXISTS inventory (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity        NUMERIC(12,4) NOT NULL DEFAULT 0,
  reserved        NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit            VARCHAR(20) NOT NULL DEFAULT 'UNIT',
  last_counted_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, product_id, variant_id)
);

-- ── stock_movements ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  variant_id      UUID REFERENCES product_variants(id),
  type            stock_movement_type NOT NULL,
  quantity        NUMERIC(12,4) NOT NULL,
  unit_cost       NUMERIC(12,4),
  reference_type  VARCHAR(50),    -- 'SALE', 'PURCHASE', 'TRANSFER', etc.
  reference_id    UUID,
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── transfers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_warehouse_id   UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  notes               TEXT,
  requested_by        UUID,
  approved_by         UUID,
  completed_at        TIMESTAMPTZ,
  created_by          UUID,
  updated_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id     UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  variant_id      UUID REFERENCES product_variants(id),
  quantity        NUMERIC(12,4) NOT NULL,
  unit            VARCHAR(20) NOT NULL DEFAULT 'UNIT',
  received_qty    NUMERIC(12,4) DEFAULT 0
);

-- ============================================================
-- SECTION 5: CUSTOMERS & CRM
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  full_name       VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  tax_id          VARCHAR(50),
  address         JSONB,
  birthday        DATE,
  loyalty_points  INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  meta            JSONB DEFAULT '{}',
  created_by      UUID,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ============================================================
-- SECTION 6: CASH REGISTER
-- ============================================================

CREATE TABLE IF NOT EXISTS cash_registers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  status              cash_register_status NOT NULL DEFAULT 'CLOSED',
  opened_at           TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  opening_cash        NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_cash        NUMERIC(12,2),
  expected_cash       NUMERIC(12,2),
  cash_difference     NUMERIC(12,2),
  opened_by           UUID,
  closed_by           UUID,
  notes               TEXT,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 7: SALES / POS
-- ============================================================

CREATE TABLE IF NOT EXISTS sales (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id         UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cash_register_id  UUID REFERENCES cash_registers(id),
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  table_id          UUID,              -- FK to tables (defined later)
  order_number      VARCHAR(50) NOT NULL,
  receipt_number    VARCHAR(50),
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_total    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3) NOT NULL DEFAULT 'COP',
  status            sale_status NOT NULL DEFAULT 'PENDING',
  notes             TEXT,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,
  created_by        UUID,
  completed_by      UUID,
  cancelled_by      UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  variant_id      UUID REFERENCES product_variants(id),
  sku             VARCHAR(100) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  quantity        NUMERIC(12,4) NOT NULL,
  unit_price      NUMERIC(12,2) NOT NULL,
  discount        NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL,
  notes           TEXT,
  sent_to_kitchen BOOLEAN DEFAULT FALSE,
  sent_to_bar     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method          payment_method NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  reference       VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 8: RESTAURANT / BAR
-- ============================================================

CREATE TABLE IF NOT EXISTS dining_areas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tables (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  area_id         UUID REFERENCES dining_areas(id) ON DELETE SET NULL,
  number          VARCHAR(20) NOT NULL,
  name            VARCHAR(100),
  capacity        INTEGER NOT NULL DEFAULT 4,
  status          table_status NOT NULL DEFAULT 'AVAILABLE',
  position_x      NUMERIC(8,2) DEFAULT 0,
  position_y      NUMERIC(8,2) DEFAULT 0,
  shape           VARCHAR(20) DEFAULT 'rectangle',
  width           NUMERIC(8,2) DEFAULT 80,
  height          NUMERIC(8,2) DEFAULT 80,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, branch_id, number)
);

CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  table_id        UUID REFERENCES tables(id) ON DELETE SET NULL,
  sale_id         UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_number    VARCHAR(50) NOT NULL,
  status          order_status NOT NULL DEFAULT 'PENDING',
  notes           TEXT,
  guests          INTEGER DEFAULT 1,
  waiter_id       UUID,
  created_by      UUID,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  variant_id      UUID REFERENCES product_variants(id),
  quantity        NUMERIC(12,4) NOT NULL,
  unit_price      NUMERIC(12,2) NOT NULL,
  status          order_status NOT NULL DEFAULT 'PENDING',
  notes           TEXT,
  sent_at         TIMESTAMPTZ,
  ready_at        TIMESTAMPTZ,
  destination     VARCHAR(10) DEFAULT 'KITCHEN', -- 'KITCHEN' | 'BAR'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 9: PROMOTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS promotions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  type            VARCHAR(30) NOT NULL, -- 'PERCENTAGE', 'AMOUNT', 'BOGO', 'COMBO', 'HAPPY_HOUR', 'COUPON'
  value           NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_amount      NUMERIC(12,2) DEFAULT 0,
  max_uses        INTEGER,
  uses_count      INTEGER NOT NULL DEFAULT 0,
  start_at        TIMESTAMPTZ,
  end_at          TIMESTAMPTZ,
  conditions      JSONB DEFAULT '{}',  -- {"days": [1,2,3], "hours": {"from": 14, "to": 18}}
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  promotion_id    UUID REFERENCES promotions(id) ON DELETE CASCADE,
  code            VARCHAR(50) NOT NULL,
  uses_limit      INTEGER DEFAULT 1,
  uses_count      INTEGER NOT NULL DEFAULT 0,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

-- ============================================================
-- SECTION 10: NOTIFICATIONS & AUDIT
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  body            TEXT,
  type            VARCHAR(50) NOT NULL DEFAULT 'INFO',
  data            JSONB DEFAULT '{}',
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     UUID,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 11: API KEYS & WEBHOOKS
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  key_hash        VARCHAR(64) NOT NULL UNIQUE,
  key_prefix      VARCHAR(10) NOT NULL,
  scopes          TEXT[] DEFAULT '{}',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  secret          VARCHAR(64) NOT NULL,
  events          TEXT[] NOT NULL DEFAULT '{}',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event           VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error_message   TEXT,
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECTION 12: MARKETPLACE MODULES
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_modules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            VARCHAR(100) NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  version         VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  icon_url        TEXT,
  category        VARCHAR(50),
  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_free         BOOLEAN NOT NULL DEFAULT TRUE,
  min_plan        subscription_plan NOT NULL DEFAULT 'FREE',
  dependencies    TEXT[] DEFAULT '{}',
  config_schema   JSONB DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_modules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_id       UUID NOT NULL REFERENCES marketplace_modules(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  config          JSONB DEFAULT '{}',
  installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, module_id)
);

-- ── Feature flags ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key             VARCHAR(100) NOT NULL UNIQUE,
  description     TEXT,
  is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent INTEGER DEFAULT 0,
  conditions      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flag_key        VARCHAR(100) NOT NULL,
  is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (tenant_id, flag_key)
);

-- ── updated_at triggers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants', 'branches', 'user_profiles', 'user_tenant_roles',
    'products', 'product_variants', 'categories', 'brands', 'suppliers',
    'inventory', 'transfers', 'customers', 'cash_registers',
    'tables', 'orders', 'order_items', 'promotions',
    'webhook_endpoints', 'marketplace_modules', 'tenant_modules',
    'subscriptions', 'feature_flags'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
       CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %s
         FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      t, t, t, t
    );
  END LOOP;
END;
$$;
