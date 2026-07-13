-- ============================================================
-- REG-X — Migration 029: Asistencia y Turnos + Comisiones
-- ------------------------------------------------------------
-- 1. attendance        : registro de entrada/salida por empleado.
-- 2. shifts            : programación de turnos (horario asignado).
-- 3. commission_rules  : % base por empleado (+ overrides por categoría).
-- 4. get_commission_report(...) : calcula comisiones por venta a nivel de
--    ítem (override por categoría si existe, si no el % base del empleado).
-- 5. Habilita los módulos 'attendance' y 'commissions' en todos los tenants.
--
-- Empleados = usuarios en user_tenant_roles. Ventas: sales.created_by = vendedor.
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb. Ejecutar en el SQL Editor. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) ASISTENCIA (entrada / salida)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.attendance (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  branch_id   UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL,
  work_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  check_in    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out   TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON public.attendance (tenant_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_user   ON public.attendance (tenant_id, user_id, work_date);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

-- Insert/Update: OWNER/ADMIN administran a todos; cualquier miembro puede
-- registrar SU propia asistencia (fichar).
DROP POLICY IF EXISTS "attendance_insert" ON public.attendance;
CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    (user_id = auth.uid() OR user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'))
  );

DROP POLICY IF EXISTS "attendance_update" ON public.attendance;
CREATE POLICY "attendance_update" ON public.attendance
  FOR UPDATE USING (
    user_belongs_to_tenant(tenant_id) AND
    (user_id = auth.uid() OR user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'))
  );

DROP POLICY IF EXISTS "attendance_delete" ON public.attendance;
CREATE POLICY "attendance_delete" ON public.attendance
  FOR DELETE USING (
    user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON public.attendance;
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 2) TURNOS (programación)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.shifts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  branch_id   UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL,
  shift_date  DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON public.shifts (tenant_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_user   ON public.shifts (tenant_id, user_id, shift_date);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_select" ON public.shifts;
CREATE POLICY "shifts_select" ON public.shifts
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "shifts_write" ON public.shifts;
CREATE POLICY "shifts_write" ON public.shifts
  FOR ALL USING (
    user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
  ) WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;

DROP TRIGGER IF EXISTS trg_shifts_updated_at ON public.shifts;
CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 3) REGLAS DE COMISIÓN (base por empleado + override por categoría)
--    category_id NULL  → % base del empleado.
--    category_id != NULL → override para esa categoría.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id)     ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  category_id  UUID          REFERENCES public.categories(id)  ON DELETE CASCADE,
  percent      NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Una sola regla base por empleado y una sola por (empleado, categoría).
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_base
  ON public.commission_rules (tenant_id, user_id) WHERE category_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_override
  ON public.commission_rules (tenant_id, user_id, category_id) WHERE category_id IS NOT NULL;

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_rules_select" ON public.commission_rules;
CREATE POLICY "commission_rules_select" ON public.commission_rules
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "commission_rules_write" ON public.commission_rules;
CREATE POLICY "commission_rules_write" ON public.commission_rules
  FOR ALL USING (
    user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
  ) WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;

DROP TRIGGER IF EXISTS trg_commission_rules_updated_at ON public.commission_rules;
CREATE TRIGGER trg_commission_rules_updated_at BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 4) REPORTE DE COMISIONES POR PERIODO
--    Calcula a nivel de ítem: rate = override(categoría) ?? base(empleado) ?? 0
--    SECURITY DEFINER con guardia de pertenencia al tenant.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_commission_report(
  p_tenant_id UUID,
  p_from      DATE,
  p_to        DATE
)
RETURNS TABLE (user_id UUID, sales_base NUMERIC, commission NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT user_belongs_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'not a member of tenant';
  END IF;

  RETURN QUERY
  SELECT s.created_by AS user_id,
         SUM(si.total) AS sales_base,
         SUM(si.total * COALESCE(ov.percent, base.percent, 0) / 100.0) AS commission
    FROM public.sales s
    JOIN public.sale_items si ON si.sale_id = s.id
    JOIN public.products   p  ON p.id = si.product_id
    LEFT JOIN public.commission_rules ov
           ON ov.tenant_id = s.tenant_id AND ov.user_id = s.created_by AND ov.category_id = p.category_id
    LEFT JOIN public.commission_rules base
           ON base.tenant_id = s.tenant_id AND base.user_id = s.created_by AND base.category_id IS NULL
   WHERE s.tenant_id = p_tenant_id
     AND s.status = 'COMPLETED'
     AND s.created_by IS NOT NULL
     AND COALESCE(s.completed_at, s.created_at)::date BETWEEN p_from AND p_to
   GROUP BY s.created_by;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_commission_report(UUID, DATE, DATE) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 5) HABILITAR LOS MÓDULOS EN TODOS LOS TENANTS
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug IN ('attendance', 'commissions')
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 029 (asistencia, turnos y comisiones) aplicada ✅' AS resultado;
