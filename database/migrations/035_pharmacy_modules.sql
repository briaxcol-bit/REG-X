-- ============================================================
-- REG-X — Migration 035: Módulos Farmacia
--   • Catálogo de Medicamentos (drug_catalog)
--   • Trazabilidad por Lotes    (product_batches)
--   • Control de Vencimientos   (vista sobre product_batches)
--   • Recetas Médicas           (prescriptions + items)
-- ------------------------------------------------------------
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb (NO "SGIO").
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) CATÁLOGO DE MEDICAMENTOS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.drug_catalog (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id           UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  name                 VARCHAR(200) NOT NULL,
  active_ingredient    VARCHAR(200),
  concentration        VARCHAR(80),
  pharma_form          VARCHAR(60),   -- tableta, jarabe, cápsula…
  invima_reg           VARCHAR(80),   -- registro sanitario INVIMA
  atc_code             VARCHAR(20),
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
  notes                TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_by           UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_drug_tenant ON public.drug_catalog (tenant_id);

-- ══════════════════════════════════════════════════════════════
-- 2) LOTES (Trazabilidad + base de Vencimientos)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.product_batches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id)    ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id)   ON DELETE CASCADE,
  supplier_id   UUID          REFERENCES public.suppliers(id)  ON DELETE SET NULL,
  batch_number  VARCHAR(80)  NOT NULL,
  expiry_date   DATE,
  quantity      NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost          NUMERIC(14,2),
  received_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_batch_tenant  ON public.product_batches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_batch_expiry  ON public.product_batches (tenant_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_batch_product ON public.product_batches (product_id);

-- ══════════════════════════════════════════════════════════════
-- 3) RECETAS MÉDICAS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  branch_id         UUID          REFERENCES public.branches(id)  ON DELETE SET NULL,
  customer_id       UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
  code              VARCHAR(40)  NOT NULL,
  patient_name      VARCHAR(200) NOT NULL,
  doctor_name       VARCHAR(200),
  doctor_license    VARCHAR(80),
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis         TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT|VALIDATED|DISPENSED|CANCELLED
  notes             TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  drug_id         UUID          REFERENCES public.drug_catalog(id) ON DELETE SET NULL,
  product_id      UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  description     VARCHAR(255) NOT NULL,
  dosage          VARCHAR(160),
  quantity        NUMERIC(14,2) NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_presc_tenant   ON public.prescriptions (tenant_id, prescription_date);
CREATE INDEX IF NOT EXISTS idx_presc_items_p  ON public.prescription_items (prescription_id);

-- ══════════════════════════════════════════════════════════════
-- 4) RLS + POLÍTICAS
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE cfg RECORD;
BEGIN
  FOR cfg IN
    SELECT * FROM (VALUES
      ('drug_catalog',       ARRAY['OWNER','ADMIN','INVENTORY_MANAGER']),
      ('product_batches',    ARRAY['OWNER','ADMIN','INVENTORY_MANAGER']),
      ('prescriptions',      ARRAY['OWNER','ADMIN','CASHIER']),
      ('prescription_items', ARRAY['OWNER','ADMIN','CASHIER'])
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

-- Triggers updated_at
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['drug_catalog','product_batches','prescriptions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', 'trg_'||t||'_updated', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
                   'trg_'||t||'_updated', t);
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 5) HABILITAR MÓDULOS EN TODOS LOS TENANTS
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug IN ('prescriptions', 'expiry_control', 'batch_tracking', 'drug_catalog')
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 035 (módulos farmacia) aplicada ✅' AS resultado;
