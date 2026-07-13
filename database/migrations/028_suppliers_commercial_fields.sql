-- ============================================================
-- REG-X — Migration 028: Campos comerciales de Proveedores
-- ------------------------------------------------------------
-- Amplía `suppliers` con datos comerciales para un módulo más completo:
--   - category       : tipo de proveedor (Insumos, Servicios, Empaques…)
--   - website        : sitio web
--   - payment_terms  : 'CASH' (contado) | 'CREDIT' (crédito)
--   - credit_days    : plazo de crédito en días (si aplica)
-- La dirección (calle/ciudad/departamento) sigue viviendo en el JSONB `address`.
--
-- Proyecto Supabase: ofsgenbpqfrcyvtiannb. Ejecutar en el SQL Editor. Idempotente.
-- ============================================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS category      VARCHAR(60),
  ADD COLUMN IF NOT EXISTS website       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(20) NOT NULL DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS credit_days   INTEGER;

CREATE INDEX IF NOT EXISTS idx_suppliers_category ON public.suppliers (tenant_id, category);

SELECT 'Migración 028 (campos comerciales de proveedores) aplicada ✅' AS resultado;
