-- ============================================================
-- REG-X — Migration 031: Reservas, Comandas de Bar, Delivery y Menú QR
-- ------------------------------------------------------------
-- 1. reservations                 : agenda de reservas.
-- 2. bar_tabs + bar_tab_items      : cuentas/tabs abiertos por mesa o cliente.
-- 3. couriers + deliveries         : domicilios y repartidores.
-- 4. get_public_menu(slug)         : menú público (para el QR), sin login.
-- 5. Habilita los 4 módulos en todos los tenants.
--
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb. Ejecutar en el SQL Editor. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) RESERVAS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reservations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  branch_id      UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
  table_id       UUID          REFERENCES public.tables(id)   ON DELETE SET NULL,
  customer_name  VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(40),
  party_size     INTEGER      NOT NULL DEFAULT 1,
  reserved_at    TIMESTAMPTZ  NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING|CONFIRMED|SEATED|CANCELLED|NO_SHOW
  notes          TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON public.reservations (tenant_id, reserved_at);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reservations_select" ON public.reservations;
CREATE POLICY "reservations_select" ON public.reservations FOR SELECT USING (user_belongs_to_tenant(tenant_id));
DROP POLICY IF EXISTS "reservations_write" ON public.reservations;
CREATE POLICY "reservations_write" ON public.reservations FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON public.reservations;
CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 2) COMANDAS DE BAR (tabs)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bar_tabs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  branch_id   UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
  table_id    UUID          REFERENCES public.tables(id)   ON DELETE SET NULL,
  name        VARCHAR(160) NOT NULL,                       -- nombre del tab / cliente
  status      VARCHAR(20)  NOT NULL DEFAULT 'OPEN',        -- OPEN|CLOSED
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  opened_by   UUID,
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bar_tabs_tenant ON public.bar_tabs (tenant_id, status);

CREATE TABLE IF NOT EXISTS public.bar_tab_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  tab_id      UUID NOT NULL REFERENCES public.bar_tabs(id)  ON DELETE CASCADE,
  product_id  UUID          REFERENCES public.products(id)  ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  quantity    NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bar_tab_items_tab ON public.bar_tab_items (tab_id);

ALTER TABLE public.bar_tabs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_tab_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bar_tabs_all" ON public.bar_tabs;
CREATE POLICY "bar_tabs_all" ON public.bar_tabs FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
DROP POLICY IF EXISTS "bar_tab_items_all" ON public.bar_tab_items;
CREATE POLICY "bar_tab_items_all" ON public.bar_tab_items FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_tabs      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_tab_items TO authenticated;

DROP TRIGGER IF EXISTS trg_bar_tabs_updated_at ON public.bar_tabs;
CREATE TRIGGER trg_bar_tabs_updated_at BEFORE UPDATE ON public.bar_tabs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 3) DELIVERY (repartidores + pedidos)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.couriers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       VARCHAR(160) NOT NULL,
  phone      VARCHAR(40),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_couriers_tenant ON public.couriers (tenant_id);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  branch_id      UUID          REFERENCES public.branches(id)  ON DELETE SET NULL,
  courier_id     UUID          REFERENCES public.couriers(id)  ON DELETE SET NULL,
  sale_id        UUID          REFERENCES public.sales(id)     ON DELETE SET NULL,
  customer_name  VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(40),
  address        TEXT         NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING|PREPARING|ON_WAY|DELIVERED|CANCELLED
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  fee            NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant ON public.deliveries (tenant_id, status);

ALTER TABLE public.couriers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "couriers_all" ON public.couriers;
CREATE POLICY "couriers_all" ON public.couriers FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
DROP POLICY IF EXISTS "deliveries_all" ON public.deliveries;
CREATE POLICY "deliveries_all" ON public.deliveries FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couriers   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;

DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 4) MENÚ PÚBLICO (para el QR) — sin login
--    Devuelve el negocio + categorías + productos ACTIVOS por slug.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_public_menu(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE slug = p_slug AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'tenant', jsonb_build_object('name', v_tenant.name, 'slug', v_tenant.slug, 'logo_url', v_tenant.logo_url),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'price', p.price, 'image_url', p.image_url,
        'category_id', p.category_id, 'category', c.name
      ) ORDER BY c.name NULLS LAST, p.name)
      FROM public.products p
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE p.tenant_id = v_tenant.id AND p.status = 'ACTIVE' AND p.deleted_at IS NULL
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_menu(TEXT) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 5) HABILITAR LOS MÓDULOS
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug IN ('reservations', 'bar_tabs', 'delivery', 'menu_digital')
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 031 (reservas, bar, delivery, menú QR) aplicada ✅' AS resultado;
