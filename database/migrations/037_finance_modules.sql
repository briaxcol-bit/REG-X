-- ============================================================
-- REG-X — Migration 037: Módulos Finanzas
--   • Contabilidad          (accounts + journal_entries + journal_lines)
--   • Cuentas por Cobrar     (receivables + receivable_payments)
--   • Cuentas por Pagar      (payables + payable_payments)
--   • Informes Tributarios   (lee ventas; sin tabla propia)
--   • Nómina                 (payroll_entries)
-- ------------------------------------------------------------
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb (NO "SGIO").
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) CONTABILIDAD
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        VARCHAR(20)  NOT NULL,
  name        VARCHAR(160) NOT NULL,
  type        VARCHAR(12)  NOT NULL DEFAULT 'ASSET', -- ASSET|LIABILITY|EQUITY|INCOME|EXPENSE
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  reference   VARCHAR(80),
  description TEXT,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  journal_entry_id  UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  debit             NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit            NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON public.accounts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_tenant  ON public.journal_entries (tenant_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_jlines_entry    ON public.journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jlines_account  ON public.journal_lines (account_id);

-- ══════════════════════════════════════════════════════════════
-- 2) CUENTAS POR COBRAR
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.receivables (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  customer_id UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
  reference   VARCHAR(80),
  description VARCHAR(255),
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid        NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency    VARCHAR(3)   NOT NULL DEFAULT 'COP',
  due_date    DATE,
  status      VARCHAR(12)  NOT NULL DEFAULT 'OPEN', -- OPEN|PAID|CANCELLED
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.receivable_payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receivable_id  UUID NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
  method         VARCHAR(20)  NOT NULL DEFAULT 'CASH',
  note           VARCHAR(255),
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID
);

-- ══════════════════════════════════════════════════════════════
-- 3) CUENTAS POR PAGAR
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payables (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  supplier_id UUID          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  reference   VARCHAR(80),
  description VARCHAR(255),
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid        NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency    VARCHAR(3)   NOT NULL DEFAULT 'COP',
  due_date    DATE,
  status      VARCHAR(12)  NOT NULL DEFAULT 'OPEN', -- OPEN|PAID|CANCELLED
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.payable_payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payable_id  UUID NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  method      VARCHAR(20)  NOT NULL DEFAULT 'CASH',
  note        VARCHAR(255),
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID
);

-- ══════════════════════════════════════════════════════════════
-- 4) NÓMINA
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id   UUID,                       -- user id del empleado (snapshot de nombre abajo)
  employee_name VARCHAR(200) NOT NULL,
  period_label  VARCHAR(40)  NOT NULL,       -- "Marzo 2026", "Q1"...
  base_salary   NUMERIC(14,2) NOT NULL DEFAULT 0,
  bonuses       NUMERIC(14,2) NOT NULL DEFAULT 0,
  deductions    NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_pay       NUMERIC(14,2) NOT NULL DEFAULT 0,
  status        VARCHAR(12)  NOT NULL DEFAULT 'DRAFT', -- DRAFT|PAID
  paid_at       TIMESTAMPTZ,
  notes         TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recv_tenant   ON public.receivables (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pay_tenant     ON public.payables (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_tenant ON public.payroll_entries (tenant_id);

-- ══════════════════════════════════════════════════════════════
-- 5) RLS + POLÍTICAS
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE cfg RECORD;
BEGIN
  FOR cfg IN
    SELECT * FROM (VALUES
      ('accounts',            ARRAY['OWNER','ADMIN','ACCOUNTANT']),
      ('journal_entries',     ARRAY['OWNER','ADMIN','ACCOUNTANT']),
      ('journal_lines',       ARRAY['OWNER','ADMIN','ACCOUNTANT']),
      ('receivables',         ARRAY['OWNER','ADMIN','ACCOUNTANT','CASHIER']),
      ('receivable_payments', ARRAY['OWNER','ADMIN','ACCOUNTANT','CASHIER']),
      ('payables',            ARRAY['OWNER','ADMIN','ACCOUNTANT']),
      ('payable_payments',    ARRAY['OWNER','ADMIN','ACCOUNTANT']),
      ('payroll_entries',     ARRAY['OWNER','ADMIN','ACCOUNTANT'])
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

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','receivables','payables','payroll_entries'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', 'trg_'||t||'_updated', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
                   'trg_'||t||'_updated', t);
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 6) HABILITAR MÓDULOS EN TODOS LOS TENANTS
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug IN ('accounting', 'accounts_receivable', 'accounts_payable', 'tax_reports', 'payroll')
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 037 (módulos finanzas) aplicada ✅' AS resultado;
