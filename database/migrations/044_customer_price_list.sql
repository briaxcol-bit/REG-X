-- ============================================================
-- REG-X — Migration 044: Clientes ↔ Listas de precios
-- ------------------------------------------------------------
-- Las listas tipo CUSTOMER no tenían forma de aplicarse: no existía
-- el vínculo cliente → lista. Este campo lo crea. El POS lo usa para
-- aplicar precios diferenciados automáticamente.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS price_list_id UUID REFERENCES public.price_lists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_price_list ON public.customers (price_list_id);
