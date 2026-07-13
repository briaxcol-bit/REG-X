-- ============================================================
-- REG-X — Migration 047: Idempotencia para ventas offline
-- ------------------------------------------------------------
-- El POS encola ventas hechas sin internet y las reenvía al volver
-- la conexión. Para que un reintento JAMÁS duplique una venta, el
-- número de orden es único por tenant: si el reenvío llega dos veces,
-- el segundo intento falla con 23505 y el cliente lo trata como
-- "ya sincronizada".
--
-- 1. Renombra números de orden duplicados preexistentes (si los hay).
-- 2. Crea el índice único (tenant_id, order_number).
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- 1) Deduplicar históricos: a los repetidos se les agrega sufijo -D2, -D3…
WITH dups AS (
  SELECT id,
         order_number,
         ROW_NUMBER() OVER (PARTITION BY tenant_id, order_number ORDER BY created_at) AS rn
    FROM public.sales
)
UPDATE public.sales s
   SET order_number = s.order_number || '-D' || d.rn
  FROM dups d
 WHERE s.id = d.id AND d.rn > 1;

-- 2) Único por tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_tenant_order_number
  ON public.sales (tenant_id, order_number);
