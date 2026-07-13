-- ============================================================
-- REG-X — Migration 038: Módulos Avanzados
--   • Multi-Sucursal      (usa tabla branches existente)
--   • Tienda en Línea      (config en tenants.settings, sin tabla)
--   • Webhooks / API       (api_keys + webhook_endpoints existentes)
--   • Auditoría            (audit_logs existente + trigger)
-- ------------------------------------------------------------
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb (NO "SGIO").
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) POLÍTICAS DE ESCRITURA: api_keys + webhook_endpoints
--    (antes solo tenían SELECT)
-- ══════════════════════════════════════════════════════════════
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['api_keys','webhook_endpoints'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl||'_insert', tbl);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'));$f$, tbl||'_insert', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl||'_update', tbl);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE USING (user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'));$f$, tbl||'_update', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl||'_delete', tbl);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR DELETE USING (user_belongs_to_tenant(tenant_id) AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'));$f$, tbl||'_delete', tbl);
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 2) AUDITORÍA: trigger genérico que registra cambios críticos
--    Inserta en audit_logs (que ya existe) el usuario, la acción,
--    la tabla, el id y los valores antes/después.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant UUID;
  v_rid    UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tenant := OLD.tenant_id; v_rid := OLD.id;
  ELSE
    v_tenant := NEW.tenant_id; v_rid := NEW.id;
  END IF;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    v_tenant,
    auth.uid(),
    TG_OP,               -- INSERT | UPDATE | DELETE
    TG_TABLE_NAME,       -- sales | products | cash_registers ...
    v_rid,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Adjuntar a las tablas críticas (idempotente).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales','products','cash_registers'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s ON public.%I;', t, t);
      EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();', t, t);
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 3) HABILITAR MÓDULOS EN TODOS LOS TENANTS
--    (warehouse_transfer ya venía disponible)
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, m.id, TRUE
  FROM public.tenants t
  CROSS JOIN public.marketplace_modules m
 WHERE m.slug IN ('multi_branch', 'ecommerce', 'webhooks', 'audit_log')
ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE;

SELECT 'Migración 038 (módulos avanzados) aplicada ✅' AS resultado;
