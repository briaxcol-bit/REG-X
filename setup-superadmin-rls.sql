-- ═══════════════════════════════════════════════════════════════
-- REG-X — RLS Policies para SUPER_ADMIN
-- Ejecutar en Supabase SQL Editor
-- Permite que el SUPER_ADMIN lea todos los tenants, usuarios y suscripciones
-- ═══════════════════════════════════════════════════════════════

-- Helper: verifica si el usuario actual es SUPER_ADMIN
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND platform_role = 'SUPER_ADMIN'
  );
$$;

-- ── tenants ────────────────────────────────────────────────────
-- (Agrega policy, no borra las existentes)
DROP POLICY IF EXISTS "super_admin_select_all_tenants" ON tenants;
CREATE POLICY "super_admin_select_all_tenants" ON tenants
  FOR SELECT USING (is_super_admin());

-- ── branches ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "super_admin_select_all_branches" ON branches;
CREATE POLICY "super_admin_select_all_branches" ON branches
  FOR SELECT USING (is_super_admin());

-- ── subscriptions ──────────────────────────────────────────────
DROP POLICY IF EXISTS "super_admin_select_all_subscriptions" ON subscriptions;
CREATE POLICY "super_admin_select_all_subscriptions" ON subscriptions
  FOR SELECT USING (is_super_admin());

-- ── user_profiles ──────────────────────────────────────────────
DROP POLICY IF EXISTS "super_admin_select_all_profiles" ON user_profiles;
CREATE POLICY "super_admin_select_all_profiles" ON user_profiles
  FOR SELECT USING (is_super_admin());

-- ── user_tenant_roles ──────────────────────────────────────────
DROP POLICY IF EXISTS "super_admin_select_all_roles" ON user_tenant_roles;
CREATE POLICY "super_admin_select_all_roles" ON user_tenant_roles
  FOR SELECT USING (is_super_admin());

-- ── SUPER_ADMIN puede insertar/actualizar/eliminar tenants ─────
DROP POLICY IF EXISTS "super_admin_write_tenants" ON tenants;
CREATE POLICY "super_admin_write_tenants" ON tenants
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "super_admin_write_subscriptions" ON subscriptions;
CREATE POLICY "super_admin_write_subscriptions" ON subscriptions
  FOR ALL USING (is_super_admin());

-- ═══════════════════════════════════════════════════════════════
-- Verificación
-- ═══════════════════════════════════════════════════════════════
SELECT 'Políticas SUPER_ADMIN creadas exitosamente ✅' AS resultado;
