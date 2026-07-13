-- ============================================================
-- REG-X — Migration 030: Propinas (bote) y repartos
-- ------------------------------------------------------------
-- Hasta ahora la propina se capturaba en el POS pero solo se anotaba en
-- las notas de la venta (texto), sin poder sumarse ni repartirse.
-- 1. tips        : cada propina como dato real (monto, mesero, venta, fecha).
-- 2. tip_payouts : histórico de repartos del bote entre el equipo.
-- 3. Habilita el módulo 'tips' en todos los tenants.
--
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb. Ejecutar en el SQL Editor. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) PROPINAS (bote)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tips (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  branch_id      UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
  sale_id        UUID          REFERENCES public.sales(id)    ON DELETE SET NULL,
  waiter_id      UUID,                              -- empleado atribuido (opcional)
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  tip_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
  distributed_at TIMESTAMPTZ,                        -- cuándo entró en un reparto
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tips_tenant ON public.tips (tenant_id, tip_date);
CREATE INDEX IF NOT EXISTS idx_tips_waiter ON public.tips (tenant_id, waiter_id);

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tips_select" ON public.tips;
CREATE POLICY "tips_select" ON public.tips
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

-- Insert: cualquier miembro del tenant (el cajero registra la propina al cobrar).
DROP POLICY IF EXISTS "tips_insert" ON public.tips;
CREATE POLICY "tips_insert" ON public.tips
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "tips_update" ON public.tips;
CREATE POLICY "tips_update" ON public.tips
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
  );

DROP POLICY IF EXISTS "tips_delete" ON public.tips;
CREATE POLICY "tips_delete" ON public.tips
  FOR DELETE USING (
    user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tips TO authenticated;

DROP TRIGGER IF EXISTS trg_tips_updated_at ON public.tips;
CREATE TRIGGER trg_tips_updated_at BEFORE UPDATE ON public.tips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 2) REPARTOS DEL BOTE (histórico)
--    method: EQUAL | HOURS | SALES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tip_payouts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  method      VARCHAR(20) NOT NULL DEFAULT 'EQUAL',
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tip_payouts_tenant ON public.tip_payouts (tenant_id, created_at);

ALTER TABLE public.tip_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tip_payouts_select" ON public.tip_payouts;
CREATE POLICY "tip_payouts_select" ON public.tip_payouts
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "tip_payouts_write" ON public.tip_payouts;
CREATE POLICY "tip_payouts_write" ON public.tip_payouts
  FOR ALL USING (
    user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
  ) WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tip_payouts TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3) HABILITAR EL MÓDULO 'tips' EN TODOS LOS TENANTS
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug = 'tips'
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 030 (propinas y repartos) aplicada ✅' AS resultado;
