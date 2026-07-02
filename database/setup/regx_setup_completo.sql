-- ============================================================
-- REG-X — Setup completo para Supabase
-- Ejecutar TODO este archivo en: Supabase → SQL Editor → Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "btree_gist";


-- ══ 001_initial_schema.sql ══
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


-- ══ 002_rls_policies.sql ══
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
DROP POLICY IF EXISTS "tenants_select" ON tenants;
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (id = ANY(get_user_tenant_ids()));

DROP POLICY IF EXISTS "tenants_insert" ON tenants;
CREATE POLICY "tenants_insert" ON tenants
  FOR INSERT WITH CHECK (TRUE); -- Handled by backend service role

DROP POLICY IF EXISTS "tenants_update" ON tenants;
CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (
    id = ANY(get_user_tenant_ids()) AND
    user_role_in_tenant(id) IN ('OWNER', 'ADMIN')
  );

-- branches
DROP POLICY IF EXISTS "branches_select" ON branches;
CREATE POLICY "branches_select" ON branches
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "branches_insert" ON branches;
CREATE POLICY "branches_insert" ON branches
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
  );

DROP POLICY IF EXISTS "branches_update" ON branches;
CREATE POLICY "branches_update" ON branches
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
  );

-- user_profiles: users see own profile OR profiles of teammates in the same tenant
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_tenant_roles my_role
      JOIN user_tenant_roles their_role ON their_role.tenant_id = my_role.tenant_id
      WHERE my_role.user_id   = auth.uid()
        AND their_role.user_id = user_profiles.id
    )
  );

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- user_tenant_roles
DROP POLICY IF EXISTS "user_tenant_roles_select" ON user_tenant_roles;
CREATE POLICY "user_tenant_roles_select" ON user_tenant_roles
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

-- products
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products
  FOR SELECT USING (user_belongs_to_tenant(tenant_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
  );

-- categories, brands, suppliers — same pattern as products
DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT USING (user_belongs_to_tenant(tenant_id));
DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (
  user_belongs_to_tenant(tenant_id) AND
  user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
);
DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (
  user_belongs_to_tenant(tenant_id) AND
  user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
);
DROP POLICY IF EXISTS "brands_select" ON brands;
CREATE POLICY "brands_select" ON brands     FOR SELECT USING (user_belongs_to_tenant(tenant_id));
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

-- inventory
DROP POLICY IF EXISTS "inventory_select" ON inventory;
CREATE POLICY "inventory_select" ON inventory
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "inventory_insert" ON inventory;
CREATE POLICY "inventory_insert" ON inventory
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

DROP POLICY IF EXISTS "inventory_update" ON inventory;
CREATE POLICY "inventory_update" ON inventory
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

-- stock_movements
DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
CREATE POLICY "stock_movements_select" ON stock_movements
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
CREATE POLICY "stock_movements_insert" ON stock_movements
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));

-- customers
DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (user_belongs_to_tenant(tenant_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));

-- sales
DROP POLICY IF EXISTS "sales_select" ON sales;
CREATE POLICY "sales_select" ON sales
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "sales_insert" ON sales;
CREATE POLICY "sales_insert" ON sales
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'CASHIER', 'WAITER')
  );

-- sale_items and sale_payments (parent-based security)
DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
CREATE POLICY "sale_items_select" ON sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND user_belongs_to_tenant(sales.tenant_id))
  );

DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
CREATE POLICY "sale_items_insert" ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND user_belongs_to_tenant(sales.tenant_id))
  );

DROP POLICY IF EXISTS "sale_payments_select" ON sale_payments;
CREATE POLICY "sale_payments_select" ON sale_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_payments.sale_id AND user_belongs_to_tenant(sales.tenant_id))
);

-- tables
DROP POLICY IF EXISTS "tables_select" ON tables;
CREATE POLICY "tables_select" ON tables FOR SELECT USING (user_belongs_to_tenant(tenant_id));
DROP POLICY IF EXISTS "tables_update" ON tables;
CREATE POLICY "tables_update" ON tables FOR UPDATE USING (user_belongs_to_tenant(tenant_id));

-- orders
DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT USING (user_belongs_to_tenant(tenant_id));
DROP POLICY IF EXISTS "orders_insert" ON orders;
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (user_belongs_to_tenant(tenant_id));

-- cash_registers
DROP POLICY IF EXISTS "cash_registers_select" ON cash_registers;
CREATE POLICY "cash_registers_select" ON cash_registers FOR SELECT USING (user_belongs_to_tenant(tenant_id));
DROP POLICY IF EXISTS "cash_registers_update" ON cash_registers;
CREATE POLICY "cash_registers_update" ON cash_registers FOR UPDATE USING (
  user_belongs_to_tenant(tenant_id) AND
  user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'CASHIER', 'ACCOUNTANT')
);

-- notifications: personal
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR user_belongs_to_tenant(tenant_id));

-- audit_logs: admins only
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
  );

-- api_keys, webhooks
DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
CREATE POLICY "api_keys_select" ON api_keys FOR SELECT USING (
  user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
);
DROP POLICY IF EXISTS "webhook_endpoints_select" ON webhook_endpoints;
CREATE POLICY "webhook_endpoints_select" ON webhook_endpoints FOR SELECT USING (
  user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
);

-- subscriptions
DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT USING (user_belongs_to_tenant(tenant_id));

-- tenant_mod

-- ══ 003_indexes.sql ══
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


-- ══ 004_functions_views.sql ══
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


-- ══ 001_permissions.sql ══
-- ============================================================
-- REG-X — Seed 001: System Permissions
-- ============================================================
INSERT INTO permissions (id, permission_key, description, module) VALUES
  -- Users
  (uuid_generate_v4(), 'users.view',              'Ver usuarios',                         'users'),
  (uuid_generate_v4(), 'users.create',            'Crear usuarios',                       'users'),
  (uuid_generate_v4(), 'users.edit',              'Editar usuarios',                      'users'),
  (uuid_generate_v4(), 'users.delete',            'Eliminar usuarios',                    'users'),
  -- Products
  (uuid_generate_v4(), 'products.view',           'Ver productos',                        'products'),
  (uuid_generate_v4(), 'products.create',         'Crear productos',                      'products'),
  (uuid_generate_v4(), 'products.edit',           'Editar productos',                     'products'),
  (uuid_generate_v4(), 'products.delete',         'Eliminar productos',                   'products'),
  -- Inventory
  (uuid_generate_v4(), 'inventory.view',          'Ver inventario',                       'inventory'),
  (uuid_generate_v4(), 'inventory.update',        'Ajustar inventario',                   'inventory'),
  (uuid_generate_v4(), 'inventory.transfer',      'Transferir inventario',                'inventory'),
  -- Sales
  (uuid_generate_v4(), 'sales.create',            'Crear ventas (POS)',                   'pos'),
  (uuid_generate_v4(), 'sales.cancel',            'Cancelar ventas',                      'pos'),
  (uuid_generate_v4(), 'sales.view',              'Ver ventas',                           'pos'),
  (uuid_generate_v4(), 'sales.refund',            'Hacer devoluciones',                   'pos'),
  -- Customers
  (uuid_generate_v4(), 'customers.view',          'Ver clientes',                         'customers'),
  (uuid_generate_v4(), 'customers.create',        'Crear clientes',                       'customers'),
  (uuid_generate_v4(), 'customers.edit',          'Editar clientes',                      'customers'),
  -- Cash register
  (uuid_generate_v4(), 'cash.open',               'Abrir caja',                           'cash'),
  (uuid_generate_v4(), 'cash.close',              'Cerrar caja',                          'cash'),
  (uuid_generate_v4(), 'cash.view',               'Ver caja',                             'cash'),
  -- Reports
  (uuid_generate_v4(), 'reports.view',            'Ver reportes',                         'reports'),
  (uuid_generate_v4(), 'reports.export',          'Exportar reportes',                    'reports'),
  -- Kitchen / Restaurant
  (uuid_generate_v4(), 'kitchen.view',            'Ver pedidos cocina',                   'restaurant'),
  (uuid_generate_v4(), 'kitchen.update',          'Actualizar estado cocina',             'restaurant'),
  (uuid_generate_v4(), 'tables.manage',           'Gestionar mesas',                      'restaurant'),
  -- Promotions
  (uuid_generate_v4(), 'promotions.view',         'Ver promociones',                      'promotions'),
  (uuid_generate_v4(), 'promotions.manage',       'Gestionar promociones',                'promotions'),
  -- Settings
  (uuid_generate_v4(), 'settings.view',           'Ver configuración',                    'settings'),
  (uuid_generate_v4(), 'settings.manage',         'Gestionar configuración',              'settings'),
  -- Subscriptions
  (uuid_generate_v4(), 'subscriptions.manage',    'Gestionar suscripción',                'subscriptions'),
  -- Discounts
  (uuid_generate_v4(), 'discounts.apply',         'Aplicar descuentos en POS',            'pos'),
  (uuid_generate_v4(), 'discounts.manage',        'Gestionar descuentos',                 'pos')
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================
-- Seed 002: Demo Tenant + Branch
-- ============================================================
INSERT INTO tenants (id, name, slug, business_type, plan, country, currency, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Store',
  'demo-store',
  'STORE',
  'PROFESSIONAL',
  'COL',
  'COP',
  'America/Bogota'
) ON CONFLICT DO NOTHING;

INSERT INTO branches (id, tenant_id, name, code, is_main, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Sucursal Principal',
  'MAIN',
  TRUE,
  TRUE
) ON CONFLICT DO NOTHING;

INSERT INTO warehouses (id, tenant_id, branch_id, name, code, is_default)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Bodega Principal',
  'MAIN',
  TRUE
) ON CONFLICT DO NOTHING;

-- ── Marketplace modules ────────────────────────────────────────
INSERT INTO marketplace_modules (slug, name, description, version, category, price, is_free, min_plan)
VALUES
  ('restaurant',    'Módulo Restaurante',  'Mesas, órdenes, cocina, KDS',         '1.0.0', 'restaurant', 0, TRUE,  'BASIC'),
  ('bar',           'Módulo Bar',          'Coctelería, barra, display de bar',   '1.0.0', 'restaurant', 0, TRUE,  'BASIC'),
  ('loyalty',       'Fidelización',        'Puntos, tarjetas, beneficios',        '1.0.0', 'marketing',  0, TRUE,  'PROFESSIONAL'),
  ('e-invoice-co',  'Factura Electrónica Colombia (DIAN)', '🚧 En construcción', '0.1.0', 'compliance', 0, FALSE, 'PROFESSIONAL'),
  ('e-invoice-mx',  'Factura Electrónica México (SAT)',    '🚧 En construcción', '0.1.0', 'compliance', 0, FALSE, 'PROFESSIONAL'),
  ('ai-forecast',   'IA Predictiva',       '🚧 En construcción — Fase 5',        '0.0.1', 'ai',         0, FALSE, 'ENTERPRISE'),
  ('mobile-mgr',    'App Gerencial',       'KPIs y alertas en tu celular',        '1.0.0', 'mobile',     0, TRUE,  'PROFESSIONAL')
ON CONFLICT DO NOTHING;

-- ── Feature flags ──────────────────────────────────────────────
INSERT INTO feature_flags (key, description, is_enabled)
VALUES
  ('FF_ELECTRONIC_INVOICE', 'Facturación electrónica',      FALSE),
  ('FF_AI_FORECASTING',     'IA y forecasting predictivo',  FALSE),
  ('FF_MOBILE_APP',         'Aplicación móvil gerencial',   FALSE),
  ('FF_MARKETPLACE',        'Marketplace de módulos',       TRUE),
  ('FF_LOYALTY_PROGRAM',    'Programa de fidelización',     TRUE),
  ('FF_BARCODE_SCANNER',    'Scanner de código de barras',  TRUE),
  ('FF_SCALE_INTEGRATION',  'Integración con balanza',      FALSE),
  ('FF_MULTI_CURRENCY',     'Multi-moneda avanzada',        FALSE)
ON CONFLICT (key) DO NOTHING;

-- ── Demo categories ────────────────────────────────────────────
INSERT INTO categories (tenant_id, name, slug, color, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Bebidas',     'bebidas',     '#3B82F6', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'Alimentos',   'alimentos',   '#10B981', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'Electrónica', 'electronica', '#8B5CF6', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'Limpieza',    'limpieza',    '#F59E0B', TRUE)
ON CONFLICT DO NOTHING;


-- ══ 002_test_user.sql ══
-- REG-X: Usuario de prueba
-- Email: admin@regx.test
-- Password: Admin123!

DO $body$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_branch_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN

  -- 1. Buscar si el usuario ya existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@regx.test';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@regx.test',
      crypt('Admin123!', gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin Demo"}',
      NOW(), NOW(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@regx.test'),
      'email',
      'admin@regx.test',
      NOW(), NOW(), NOW()
    );
  END IF;

  -- 2. Tenant
  INSERT INTO tenants (
    id, name, slug, business_type, plan,
    country, currency, timezone, locale,
    tax_id, primary_color, is_active, created_by
  ) VALUES (
    v_tenant_id, 'Tienda Demo REG-X', 'demo-regx',
    'STORE', 'PROFESSIONAL',
    'CO', 'COP', 'America/Bogota', 'es-CO',
    '900123456-1', '#F20D18', TRUE, v_user_id
  ) ON CONFLICT (id) DO NOTHING;

  -- 3. Sucursal
  INSERT INTO branches (
    id, tenant_id, name, code, phone, email,
    is_main, is_active, created_by, address
  ) VALUES (
    v_branch_id, v_tenant_id,
    'Sucursal Principal', 'SUC-001',
    '+57 300 000 0000', 'admin@regx.test',
    TRUE, TRUE, v_user_id,
    '{"street":"Calle 1 # 1-01","city":"Bogota","country":"CO"}'
  ) ON CONFLICT (id) DO NOTHING;

  -- 4. Perfil
  INSERT INTO user_profiles (id, full_name, locale)
  VALUES (v_user_id, 'Admin Demo', 'es-CO')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- 5. Rol OWNER
  INSERT INTO user_tenant_roles (user_id, tenant_id, branch_id, role, is_active, joined_at)
  VALUES (v_user_id, v_tenant_id, v_branch_id, 'OWNER', TRUE, NOW())
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'OWNER', is_active = TRUE;

  -- 6. Suscripcion
  INSERT INTO subscriptions (
    tenant_id, plan, status, billing_cycle,
    price, currency,
    current_period_start, current_period_end
  ) VALUES (
    v_tenant_id, 'PROFESSIONAL', 'ACTIVE', 'MONTHLY',
    0, 'COP',
    NOW(), NOW() + INTERVAL '1 year'
  ) ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Listo: admin@regx.test | Admin123! | user_id=%', v_user_id;

END $body$;


-- ── WAREHOUSE demo ──────────────────────────────────────────
INSERT INTO warehouses (id, tenant_id, branch_id, name, code, is_default, is_active)
VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002','Bodega Principal','BOD-001',TRUE,TRUE)
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- STORAGE — Bucket productos
-- ════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('products','products',TRUE,5242880,
        ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public=TRUE, file_size_limit=5242880,
  allowed_mime_types=ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'];

DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Product images are publicly readable" ON storage.objects;
CREATE POLICY "Product images are publicly readable" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Users can update their own product images" ON storage.objects;
CREATE POLICY "Users can update their own product images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Users can delete their own product images" ON storage.objects;
CREATE POLICY "Users can delete their own product images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'products');


-- ── Política faltante: sale_payments INSERT ──────────────────
DROP POLICY IF EXISTS "sale_payments_insert" ON sale_payments;
DROP POLICY IF EXISTS "sale_payments_insert" ON sale_payments;
CREATE POLICY "sale_payments_insert" ON sale_payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sales
            WHERE sales.id = sale_payments.sale_id
              AND user_belongs_to_tenant(sales.tenant_id))
  );


-- ════════════════════════════════════════════════════════════════
-- REAL-TIME para inventario y productos
-- ════════════════════════════════════════════════════════════════
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE products;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ════════════════════════════════════════════════════════════════
-- 011 — RPC: add_employee_to_tenant
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION add_employee_to_tenant(
  p_email      TEXT,
  p_full_name  TEXT,
  p_password   TEXT,
  p_role       TEXT,
  p_tenant_id  UUID,
  p_branch_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_role IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'No se puede asignar el rol % mediante esta función.', p_role;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id,
      'authenticated', 'authenticated', lower(trim(p_email)),
      crypt(p_password, gen_salt('bf', 10)), NOW(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name),
      NOW(), NOW(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
      'email', lower(trim(p_email)), NOW(), NOW(), NOW()
    );
  END IF;

  INSERT INTO user_profiles (id, full_name)
  VALUES (v_user_id, p_full_name)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO user_tenant_roles (user_id, tenant_id, branch_id, role, is_active)
  VALUES (v_user_id, p_tenant_id, p_branch_id, p_role::business_role, true)
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET role = p_role::business_role, is_active = true, branch_id = p_branch_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION add_employee_to_tenant TO authenticated;
