-- ── 013: Campos de facturación electrónica en customers ───────────────────────
-- person_type : NATURAL (persona natural) | EMPRESA (persona jurídica)
-- doc_type    : CC, CE, NIT, PA, TI
-- regime      : SIMPLIFICADO (no responsable IVA) | COMUN (responsable IVA)
-- business_name: razón social — solo para EMPRESA

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS person_type   VARCHAR(10)  NOT NULL DEFAULT 'NATURAL',
  ADD COLUMN IF NOT EXISTS doc_type      VARCHAR(20)  NOT NULL DEFAULT 'CC',
  ADD COLUMN IF NOT EXISTS regime        VARCHAR(20)  NOT NULL DEFAULT 'SIMPLIFICADO',
  ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);

-- Índice para búsqueda por razón social
CREATE INDEX IF NOT EXISTS idx_customers_business_name
  ON customers (tenant_id, business_name)
  WHERE business_name IS NOT NULL AND deleted_at IS NULL;
