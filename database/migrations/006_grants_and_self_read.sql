-- ============================================================
-- REG-X — Migration 006: GRANTs + políticas de auto-lectura
-- ------------------------------------------------------------
-- Corrige los 403 (Forbidden) al leer user_profiles / user_tenant_roles:
-- en Supabase, además de las políticas RLS, el rol `authenticated`
-- necesita GRANT a nivel de tabla. Las migraciones hechas a mano
-- a veces no los incluyen.
-- Ejecutar en el SQL Editor de Supabase. Es idempotente.
-- ============================================================

-- ── 1) Permisos de esquema y tablas para los roles de Supabase ──
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT SELECT                         ON ALL TABLES    IN SCHEMA public TO anon;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

-- Para tablas/funciones/secuencias que se creen a futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, anon;

-- ── 2) Re-asegurar políticas de auto-lectura (por si 002 no corrió completo) ──
ALTER TABLE public.user_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- user_profiles: cada usuario ve su propio perfil; el super admin ve todos
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_super_admin());

-- user_tenant_roles: cada usuario ve sus propios roles; el super admin ve todos
DROP POLICY IF EXISTS "user_tenant_roles_select" ON public.user_tenant_roles;
CREATE POLICY "user_tenant_roles_select" ON public.user_tenant_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_super_admin()
  );

SELECT 'Migración 006 (grants + auto-lectura) aplicada ✅' AS resultado;
