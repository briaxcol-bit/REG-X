-- ============================================================
-- REG-X — Migration 036: Módulos Ferretería / Industrial
--   • Cotizaciones           (quotes + quote_items)
--   • Órdenes de Trabajo      (work_orders + work_order_items)
--   • Ensambles y Kits        (assemblies + assembly_components)
--   • Conversión de Unidades  (product_units)
--   • Seguimiento por Serial  (product_serials)
-- ------------------------------------------------------------
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb (NO "SGIO").
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) COTIZACIONES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.quotes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  branch_id    UUID          REFERENCES public.branches(id)  ON DELETE SET NULL,
  customer_id  UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
  code         VARCHAR(40)  NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'DRAFT', -- DRAFT|SENT|ACCEPTED|REJECTED|CONVERTED
  quote_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until  DATE,
  total        NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency     VARCHAR(3)   NOT NULL DEFAULT 'COP',
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.quote_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_id    UUID NOT NULL REFERENCES public.quotes(id)  ON DELETE CASCADE,
  product_id  UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  quantity    NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total       NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ══════════════════════════════════════════════════════════════
-- 2) ÓRDENES DE TRABAJO
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.work_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  branch_id      UUID          REFERENCES public.branches(id)  ON DELETE SET NULL,
  customer_id    UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
  assigned_to    UUID          REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  code           VARCHAR(40)  NOT NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  priority       VARCHAR(10)  NOT NULL DEFAULT 'NORMAL', -- LOW|NORMAL|HIGH
  status         VARCHAR(20)  NOT NULL DEFAULT 'OPEN',   -- OPEN|IN_PROGRESS|DONE|DELIVERED|CANCELLED
  due_date       DATE,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency       VARCHAR(3)   NOT NULL DEFAULT 'COP',
  notes          TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.work_order_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_id  UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  product_id     UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  kind           VARCHAR(10)  NOT NULL DEFAULT 'PART', -- PART|LABOR
  description    VARCHAR(255) NOT NULL,
  quantity       NUMERIC(14,2) NOT NULL DEFAULT 1,
  unit_price     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ══════════════════════════════════════════════════════════════
-- 3) ENSAMBLES Y KITS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.assemblies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id  UUID          REFERENCES public.products(id) ON DELETE SET NULL, -- producto resultante (opcional)
  name        VARCHAR(200) NOT NULL,
  sale_price  NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.assembly_components (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assembly_id          UUID NOT NULL REFERENCES public.assemblies(id) ON DELETE CASCADE,
  component_product_id UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  description          VARCHAR(255),
  quantity             NUMERIC(14,2) NOT NULL DEFAULT 1
);

-- ══════════════════════════════════════════════════════════════
-- 4) CONVERSIÓN DE UNIDADES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.product_units (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_name   VARCHAR(40)  NOT NULL,             -- metro, bulto, docena…
  factor      NUMERIC(14,4) NOT NULL DEFAULT 1,  -- unidades base que representa
  price       NUMERIC(14,2),
  is_base     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, unit_name)
);

-- ══════════════════════════════════════════════════════════════
-- 5) SEGUIMIENTO POR SERIAL
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.product_serials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id)  ON DELETE CASCADE,
  supplier_id   UUID          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  serial_number VARCHAR(120) NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'IN_STOCK', -- IN_STOCK|SOLD|RETURNED|DEFECTIVE
  notes         TEXT,
  received_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (tenant_id, product_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_quotes_tenant    ON public.quotes (tenant_id, quote_date);
CREATE INDEX IF NOT EXISTS idx_wo_tenant         ON public.work_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_asm_tenant        ON public.assemblies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_punits_product    ON public.product_units (product_id);
CREATE INDEX IF NOT EXISTS idx_serials_tenant    ON public.product_serials (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_serials_product   ON public.product_serials (product_id);

-- ══════════════════════════════════════════════════════════════
-- 6) RLS + POLÍTICAS
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE cfg RECORD;
BEGIN
  FOR cfg IN
    SELECT * FROM (VALUES
      ('quotes',              ARRAY['OWNER','ADMIN','CASHIER']),
      ('quote_items',         ARRAY['OWNER','ADMIN','CASHIER']),
      ('work_orders',         ARRAY['OWNER','ADMIN','CASHIER']),
      ('work_order_items',    ARRAY['OWNER','ADMIN','CASHIER']),
      ('assemblies',          ARRAY['OWNER','ADMIN','INVENTORY_MANAGER']),
      ('assembly_components', ARRAY['OWNER','ADMIN','INVENTORY_MANAGER']),
      ('product_units',       ARRAY['OWNER','ADMIN','INVENTORY_MANAGER']),
      ('product_serials',     ARRAY['OWNER','ADMIN','INVENTORY_MANAGER'])
    ) AS t(tbl, roles)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', cfg.tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', cfg.tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', cfg.tbl||'_select', cfg.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (user_belongs_to_tenant(tenant_id));',
                   cfg.tbl||'_select', cfg.tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', cfg.tbl||'_insert', cfg.tbl);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) = ANY(%L));$f$,
                   cfg.tbl||'_insert', cfg.tbl, cfg.roles);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', cfg.tbl||'_update', cfg.tbl);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE USING (user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) = ANY(%L));$f$,
                   cfg.tbl||'_update', cfg.tbl, cfg.roles);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', cfg.tbl||'_delete', cfg.tbl);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR DELETE USING (user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) = ANY(%L));$f$,
                   cfg.tbl||'_delete', cfg.tbl, cfg.roles);
  END LOOP;
END $$;

-- Triggers updated_at (cabeceras con esa columna)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['quotes','work_orders','assemblies','product_serials'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', 'trg_'||t||'_updated', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
                   'trg_'||t||'_updated', t);
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 7) HABILITAR MÓDULOS EN TODOS LOS TENANTS
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug IN ('quotes', 'work_orders', 'assemblies', 'unit_conversion', 'serial_tracking')
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 036 (módulos ferretería) aplicada ✅' AS resultado;
