-- ============================================================
-- REG-X — Migration 024: Self-service del Dueño (OWNER/ADMIN)
-- ------------------------------------------------------------
-- OPCIONAL pero recomendada. Habilita dos cosas para el panel de
-- Ajustes del dueño (que edita su propia empresa vía RLS):
--
--   1. Subida de LOGO por el propio dueño a Storage, restringida
--      a la carpeta de SU tenant (tenant-assets/<tenant_id>/...).
--   2. Blindaje: impide que un OWNER/ADMIN se cambie el plan,
--      el slug o reactive su tenant editando la tabla directamente.
--      (La app solo envía campos seguros, pero esto lo garantiza a
--       nivel de base de datos.)
--
-- Proyecto Supabase correcto: ofsgenbpqfrcyvtiannb
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) STORAGE: el dueño sube su propio logo a su carpeta
-- ══════════════════════════════════════════════════════════════
-- El nombre del objeto empieza por el tenant_id:  <tenant_id>/logo-....png
-- (storage.foldername(name))[1]  ->  '<tenant_id>'

DROP POLICY IF EXISTS "Owner Insert Own Tenant Assets" ON storage.objects;
CREATE POLICY "Owner Insert Own Tenant Assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND public.user_belongs_to_tenant(((storage.foldername(name))[1])::uuid)
  AND public.user_role_in_tenant(((storage.foldername(name))[1])::uuid) IN ('OWNER','ADMIN')
);

DROP POLICY IF EXISTS "Owner Update Own Tenant Assets" ON storage.objects;
CREATE POLICY "Owner Update Own Tenant Assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND public.user_belongs_to_tenant(((storage.foldername(name))[1])::uuid)
  AND public.user_role_in_tenant(((storage.foldername(name))[1])::uuid) IN ('OWNER','ADMIN')
)
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND public.user_belongs_to_tenant(((storage.foldername(name))[1])::uuid)
  AND public.user_role_in_tenant(((storage.foldername(name))[1])::uuid) IN ('OWNER','ADMIN')
);

DROP POLICY IF EXISTS "Owner Delete Own Tenant Assets" ON storage.objects;
CREATE POLICY "Owner Delete Own Tenant Assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND public.user_belongs_to_tenant(((storage.foldername(name))[1])::uuid)
  AND public.user_role_in_tenant(((storage.foldername(name))[1])::uuid) IN ('OWNER','ADMIN')
);

-- ══════════════════════════════════════════════════════════════
-- 2) BLINDAJE: el dueño no puede tocar plan / slug / is_active
--    ni cambiar de tenant. Solo el SUPER_ADMIN puede.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.protect_tenant_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- El super admin puede cambiar todo (paneles de plataforma / RPCs)
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Para cualquier otro (OWNER/ADMIN editando su empresa), conserva
  -- los campos sensibles con su valor anterior.
  NEW.plan       := OLD.plan;
  NEW.slug       := OLD.slug;
  NEW.is_active  := OLD.is_active;
  NEW.id         := OLD.id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_tenant_fields ON public.tenants;
CREATE TRIGGER trg_protect_tenant_fields
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_privileged_fields();

SELECT 'Migración 024 (self-service del dueño) aplicada ✅' AS resultado;
