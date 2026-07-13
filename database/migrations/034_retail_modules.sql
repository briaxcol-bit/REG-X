-- ============================================================
-- REG-X — Migration 034: Módulos Retail
--   • Órdenes de Compra (purchase_orders + items)
--   • Listas de Precios (price_lists + items)
--   • Tarjetas de Regalo (gift_cards + transactions)
--   • Apartados / Layaway (layaways + items + payments)
-- ------------------------------------------------------------
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb (NO "SGIO").
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) ÓRDENES DE COMPRA
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  branch_id     UUID          REFERENCES public.branches(id)  ON DELETE SET NULL,
  supplier_id   UUID          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  code          VARCHAR(40)  NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',  -- DRAFT|SENT|RECEIVED|CANCELLED
  order_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  notes         TEXT,
  total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency      VARCHAR(3)   NOT NULL DEFAULT 'COP',
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_id  UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id         UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  description        VARCHAR(255) NOT NULL,
  quantity           NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit_cost          NUMERIC(14,2) NOT NULL DEFAULT 0,
  total              NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_po_tenant   ON public.purchase_orders (tenant_id, order_date);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.purchase_order_items (purchase_order_id);

-- ══════════════════════════════════════════════════════════════
-- 2) LISTAS DE PRECIOS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.price_lists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  list_type   VARCHAR(20)  NOT NULL DEFAULT 'CUSTOMER', -- CUSTOMER|CHANNEL|VOLUME
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.price_list_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_qty       NUMERIC(14,2) NOT NULL DEFAULT 1,
  price         NUMERIC(14,2) NOT NULL DEFAULT 0,
  UNIQUE (price_list_id, product_id, min_qty)
);
CREATE INDEX IF NOT EXISTS idx_pl_tenant     ON public.price_lists (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pl_items_list ON public.price_list_items (price_list_id);

-- ══════════════════════════════════════════════════════════════
-- 3) TARJETAS DE REGALO
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code            VARCHAR(40) NOT NULL,
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance         NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(3)  NOT NULL DEFAULT 'COP',
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE|REDEEMED|EXPIRED|CANCELLED
  customer_id     UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
  expires_at      DATE,
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);
CREATE TABLE IF NOT EXISTS public.gift_card_transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  gift_card_id UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL,  -- ISSUE|REDEEM|ADJUST|CANCEL
  amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  note         VARCHAR(255),
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gc_tenant   ON public.gift_cards (tenant_id);
CREATE INDEX IF NOT EXISTS idx_gc_tx_card  ON public.gift_card_transactions (gift_card_id);

-- ══════════════════════════════════════════════════════════════
-- 4) APARTADOS (LAYAWAY)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.layaways (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  branch_id   UUID          REFERENCES public.branches(id)  ON DELETE SET NULL,
  customer_id UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
  code        VARCHAR(40)  NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'OPEN', -- OPEN|COMPLETED|CANCELLED
  total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid        NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency    VARCHAR(3)   NOT NULL DEFAULT 'COP',
  due_date    DATE,
  notes       TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.layaway_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  layaway_id  UUID NOT NULL REFERENCES public.layaways(id) ON DELETE CASCADE,
  product_id  UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  quantity    NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total       NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.layaway_payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  layaway_id  UUID NOT NULL REFERENCES public.layaways(id) ON DELETE CASCADE,
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  method      VARCHAR(20)  NOT NULL DEFAULT 'CASH',
  note        VARCHAR(255),
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID
);
CREATE INDEX IF NOT EXISTS idx_lay_tenant     ON public.layaways (tenant_id);
CREATE INDEX IF NOT EXISTS idx_lay_items_lay  ON public.layaway_items (layaway_id);
CREATE INDEX IF NOT EXISTS idx_lay_pay_lay    ON public.layaway_payments (layaway_id);

-- ══════════════════════════════════════════════════════════════
-- 5) RLS + POLÍTICAS  (helper para no repetir)
-- ══════════════════════════════════════════════════════════════
-- Aplica: SELECT a cualquier miembro; INSERT/UPDATE a los roles dados.
DO $$
DECLARE
  cfg RECORD;
BEGIN
  FOR cfg IN
    SELECT * FROM (VALUES
      ('purchase_orders',       ARRAY['OWNER','ADMIN','INVENTORY_MANAGER']),
      ('purchase_order_items',  ARRAY['OWNER','ADMIN','INVENTORY_MANAGER']),
      ('price_lists',           ARRAY['OWNER','ADMIN']),
      ('price_list_items',      ARRAY['OWNER','ADMIN']),
      ('gift_cards',            ARRAY['OWNER','ADMIN','CASHIER']),
      ('gift_card_transactions',ARRAY['OWNER','ADMIN','CASHIER']),
      ('layaways',              ARRAY['OWNER','ADMIN','CASHIER']),
      ('layaway_items',         ARRAY['OWNER','ADMIN','CASHIER']),
      ('layaway_payments',      ARRAY['OWNER','ADMIN','CASHIER'])
    ) AS t(tbl, roles)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', cfg.tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated;', cfg.tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', cfg.tbl||'_select', cfg.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (user_belongs_to_tenant(tenant_id));',
                   cfg.tbl||'_select', cfg.tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', cfg.tbl||'_insert', cfg.tbl);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) = ANY(%L));$f$,
                   cfg.tbl||'_insert', cfg.tbl, cfg.roles);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', cfg.tbl||'_update', cfg.tbl);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE USING (user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) = ANY(%L));$f$,
                   cfg.tbl||'_update', cfg.tbl, cfg.roles);
  END LOOP;
END $$;

-- Triggers updated_at en las cabeceras
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_orders','price_lists','gift_cards','layaways'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', 'trg_'||t||'_updated', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
                   'trg_'||t||'_updated', t);
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 6) HABILITAR LOS MÓDULOS EN TODOS LOS TENANTS
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug IN ('purchase_orders', 'price_lists', 'gift_cards', 'layaway')
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 034 (módulos retail) aplicada ✅' AS resultado;
