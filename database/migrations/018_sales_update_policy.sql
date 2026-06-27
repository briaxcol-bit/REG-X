-- ================================================================
-- Migration 018: Add UPDATE policy for sales table
-- Allows OWNER/ADMIN to update any sale in their tenant,
-- and CASHIER to update their own sales.
-- Run in Supabase SQL Editor
-- ================================================================

-- No existía política UPDATE en sales — crearla ahora
CREATE POLICY "sales_update" ON sales
  FOR UPDATE
  USING (
    user_belongs_to_tenant(tenant_id)
    AND (
      user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (
    user_belongs_to_tenant(tenant_id)
  );

-- sale_payments tampoco tiene UPDATE ni INSERT para admin — aseguramos INSERT
DROP POLICY IF EXISTS "sale_payments_insert" ON sale_payments;
CREATE POLICY "sale_payments_insert" ON sale_payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_payments.sale_id
        AND user_belongs_to_tenant(sales.tenant_id)
    )
  );
