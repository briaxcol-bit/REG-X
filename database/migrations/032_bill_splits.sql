-- ============================================================
-- REG-X — Migration 032: División de Cuenta (split bill)
-- ------------------------------------------------------------
-- Registra cómo se dividió una cuenta entre comensales (para historial).
-- La fuente puede ser una comanda de bar (tab_id) o un total manual.
-- Habilita el módulo 'split_bill' en todos los tenants.
--
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb. Ejecutar en el SQL Editor. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bill_splits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  branch_id   UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
  tab_id      UUID          REFERENCES public.bar_tabs(id) ON DELETE SET NULL,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,     -- base (sin propina)
  tip         NUMERIC(12,2) NOT NULL DEFAULT 0,
  method      VARCHAR(20)  NOT NULL DEFAULT 'EQUAL', -- EQUAL|ITEMS|CUSTOM
  people      INTEGER      NOT NULL DEFAULT 1,
  detail      JSONB,                                 -- [{ label, amount }]
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bill_splits_tenant ON public.bill_splits (tenant_id, created_at);

ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bill_splits_all" ON public.bill_splits;
CREATE POLICY "bill_splits_all" ON public.bill_splits FOR ALL
  USING (user_belongs_to_tenant(tenant_id)) WITH CHECK (user_belongs_to_tenant(tenant_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_splits TO authenticated;

-- Habilitar el módulo
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug = 'split_bill'
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 032 (división de cuenta) aplicada ✅' AS resultado;
