-- ============================================================
-- REG-X — Migration 046: Auditoría que no bloquea el borrado de tenants
-- ------------------------------------------------------------
-- Problema: al eliminar un tenant, el CASCADE borra sales/products/
-- cash_registers; sus triggers de auditoría (038) intentan INSERTAR en
-- audit_logs un registro con el tenant_id que se está borrando →
-- "violates foreign key constraint audit_logs_tenant_id_fkey" y el
-- borrado completo falla.
--
-- Solución: audit_row_change() ignora los casos en que el tenant ya no
-- existe (borrado en curso). La auditoría es best-effort: nunca puede
-- tumbar la operación que audita.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

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

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, user_id, action, resource_type, resource_id, old_values, new_values)
    VALUES (
      v_tenant,
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      v_rid,
      CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
    );
  EXCEPTION
    WHEN foreign_key_violation THEN
      -- El tenant está siendo eliminado (CASCADE): no hay dónde auditar.
      NULL;
    WHEN OTHERS THEN
      RAISE WARNING 'audit_row_change falló en %: %', TG_TABLE_NAME, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;
