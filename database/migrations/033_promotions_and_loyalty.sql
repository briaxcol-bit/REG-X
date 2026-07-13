-- ============================================================
-- REG-X — Migration 033: Promociones/Descuentos y Fidelización
-- ------------------------------------------------------------
-- 1. promotions          : reglas de descuento (%, fijo, 2x1, combo).
-- 2. loyalty_config       : parámetros de puntos por tenant.
-- 3. loyalty_transactions : movimientos de puntos por cliente.
-- 4. loyalty_rewards      : catálogo de recompensas canjeables.
--    (El saldo de puntos vive en customers.loyalty_points.)
-- 5. Habilita promotions, loyalty y label_printer.
--
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb. Ejecutar en el SQL Editor. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) PROMOCIONES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.promotions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id)      ON DELETE CASCADE,
  name         VARCHAR(160) NOT NULL,
  type         VARCHAR(20)  NOT NULL DEFAULT 'PERCENT',  -- PERCENT|FIXED|BOGO|COMBO
  value        NUMERIC(12,2) NOT NULL DEFAULT 0,          -- % | monto fijo | precio combo
  scope        VARCHAR(20)  NOT NULL DEFAULT 'ALL',       -- ALL|CATEGORY|PRODUCT
  category_id  UUID          REFERENCES public.categories(id) ON DELETE SET NULL,
  product_id   UUID          REFERENCES public.products(id)   ON DELETE SET NULL,
  min_qty      INTEGER      NOT NULL DEFAULT 1,
  starts_at    DATE,
  ends_at      DATE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promotions_tenant ON public.promotions (tenant_id, is_active);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promotions_all" ON public.promotions;
CREATE POLICY "promotions_all" ON public.promotions FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;

DROP TRIGGER IF EXISTS trg_promotions_updated_at ON public.promotions;
CREATE TRIGGER trg_promotions_updated_at BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 2) FIDELIZACIÓN — configuración por tenant
--    currency_per_point : cuánta plata da 1 punto (ej. 1000 = 1 pt / $1000)
--    point_value        : cuánto vale 1 punto al redimir (ej. 50 = $50/pt)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.loyalty_config (
  tenant_id          UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  currency_per_point NUMERIC(12,2) NOT NULL DEFAULT 1000,
  point_value        NUMERIC(12,2) NOT NULL DEFAULT 50,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_config_all" ON public.loyalty_config;
CREATE POLICY "loyalty_config_all" ON public.loyalty_config FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_config TO authenticated;

-- ── movimientos de puntos ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)    ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id)  ON DELETE CASCADE,
  points      INTEGER NOT NULL DEFAULT 0,                    -- + gana / - redime
  kind        VARCHAR(20) NOT NULL DEFAULT 'EARN',           -- EARN|REDEEM|ADJUST
  note        TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_tenant   ON public.loyalty_transactions (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON public.loyalty_transactions (customer_id);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_tx_all" ON public.loyalty_transactions;
CREATE POLICY "loyalty_tx_all" ON public.loyalty_transactions FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_transactions TO authenticated;

-- ── recompensas canjeables ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        VARCHAR(160) NOT NULL,
  points_cost INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_tenant ON public.loyalty_rewards (tenant_id);
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_rewards_all" ON public.loyalty_rewards;
CREATE POLICY "loyalty_rewards_all" ON public.loyalty_rewards FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3) HABILITAR MÓDULOS
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug IN ('promotions', 'loyalty', 'label_printer')
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 033 (promociones y fidelización) aplicada ✅' AS resultado;
