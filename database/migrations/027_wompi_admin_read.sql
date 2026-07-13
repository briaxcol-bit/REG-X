-- ============================================================
-- REG-X — Migration 027: Lectura de pagos para el SUPER_ADMIN
-- ------------------------------------------------------------
-- El dashboard "Pasarela de pagos" (solo super admin) necesita ver
-- las transacciones de TODOS los tenants. La migración 025 solo dejó
-- una policy `user_belongs_to_tenant`, que limita al propio tenant.
-- Aquí se agrega una policy SELECT extra basada en is_super_admin().
--
-- Requiere que exista la función public.is_super_admin() (migración 005).
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb. Ejecutar en el SQL Editor. Idempotente.
-- ============================================================

DROP POLICY IF EXISTS "payment_tx_select_superadmin" ON public.payment_transactions;
CREATE POLICY "payment_tx_select_superadmin" ON public.payment_transactions
  FOR SELECT USING (public.is_super_admin());

SELECT 'Migración 027 (lectura de pagos para super admin) aplicada ✅' AS resultado;
