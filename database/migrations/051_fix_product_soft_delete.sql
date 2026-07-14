-- ============================================================
-- REG-X — Migration 051: Fix Soft Delete para Products
-- ------------------------------------------------------------
-- Problema: Al hacer un "Soft Delete" (UPDATE deleted_at = NOW()), 
-- PostgREST internamente evalúa la política de SELECT en la nueva 
-- fila. Como la política de SELECT anterior exigía `deleted_at IS NULL`,
-- Postgres lanzaba el error "new row violates row-level security policy".
--
-- Solución: Se elimina la restricción `deleted_at IS NULL` de la 
-- política de RLS (el frontend ya filtra los productos eliminados 
-- usando `.is('deleted_at', null)` explícitamente en sus consultas).
-- ============================================================

DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products
  FOR SELECT USING (public.user_belongs_to_tenant(tenant_id));

SELECT 'Migración 051 aplicada ✅ (Soft delete de productos corregido)' AS result;
