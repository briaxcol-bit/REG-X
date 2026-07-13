-- ============================================================
-- REG-X — Migration 026: Módulos Gastos Operativos + Proveedores
-- ------------------------------------------------------------
-- 1. Crea la tabla `expenses` (gastos operativos) + RLS.
-- 2. Agrega políticas de escritura a `suppliers` (solo tenía lectura).
-- 3. Habilita los módulos 'expenses' y 'suppliers' en tenant_modules
--    para todos los tenants existentes (para que aparezcan en el menú).
--
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb (NO "SGIO").
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) TABLA DE GASTOS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.expenses (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  branch_id      UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
  supplier_id    UUID          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  category       VARCHAR(60)  NOT NULL DEFAULT 'Otros',
  description    TEXT,
  amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency       VARCHAR(3)   NOT NULL DEFAULT 'COP',
  expense_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(20)  NOT NULL DEFAULT 'CASH',   -- CASH|TRANSFER|CARD|OTHER
  reference      VARCHAR(120),                            -- # factura / nota
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant   ON public.expenses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON public.expenses (tenant_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_supplier ON public.expenses (supplier_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro del tenant. Escritura: OWNER/ADMIN/ACCOUNTANT.
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (user_belongs_to_tenant(tenant_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
  );

DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
  );

GRANT SELECT, INSERT, UPDATE ON public.expenses TO authenticated;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 2) COLUMNAS EXTRA EN SUPPLIERS (categoría, web, condición de pago)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS category      VARCHAR(60),
  ADD COLUMN IF NOT EXISTS website       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(10) NOT NULL DEFAULT 'CASH', -- CASH | CREDIT
  ADD COLUMN IF NOT EXISTS credit_days   INTEGER;

-- ══════════════════════════════════════════════════════════════
-- 3) POLÍTICAS DE ESCRITURA PARA SUPPLIERS (antes solo lectura)
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;
CREATE POLICY "suppliers_insert" ON public.suppliers
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
CREATE POLICY "suppliers_update" ON public.suppliers
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN', 'INVENTORY_MANAGER')
  );

GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 4) HABILITAR LOS MÓDULOS EN TODOS LOS TENANTS EXISTENTES
--    (para que aparezcan en el menú gateado por módulo)
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug IN ('expenses', 'suppliers')
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 026 (gastos + proveedores) aplicada ✅' AS resultado;
