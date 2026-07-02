-- ============================================================
-- REG-X — Fix: Warehouse + Inventory + RLS
-- Ejecutar en: Supabase → SQL Editor → Run
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- PASO 1: Crear warehouse para cada tenant/branch que no tenga
-- ══════════════════════════════════════════════════════════════
INSERT INTO warehouses (tenant_id, branch_id, name, code, is_default, is_active)
SELECT b.tenant_id, b.id, 'Bodega Principal', 'MAIN', TRUE, TRUE
FROM branches b
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses w
  WHERE w.tenant_id = b.tenant_id AND w.branch_id = b.id
);

-- ══════════════════════════════════════════════════════════════
-- PASO 2: RLS para warehouses (faltaba completamente)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouses_select" ON warehouses;
CREATE POLICY "warehouses_select" ON warehouses
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "warehouses_insert" ON warehouses;
CREATE POLICY "warehouses_insert" ON warehouses
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- ══════════════════════════════════════════════════════════════
-- PASO 3: RLS para inventory (SELECT, INSERT, UPDATE)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_select" ON inventory;
CREATE POLICY "inventory_select" ON inventory
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "inventory_insert" ON inventory;
CREATE POLICY "inventory_insert" ON inventory
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "inventory_update" ON inventory;
CREATE POLICY "inventory_update" ON inventory
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- ══════════════════════════════════════════════════════════════
-- Verificación
-- ══════════════════════════════════════════════════════════════
SELECT w.tenant_id, t.name as tenant, b.name as branch, w.name as warehouse, w.is_default
FROM warehouses w
JOIN tenants t ON t.id = w.tenant_id
JOIN branches b ON b.id = w.branch_id
ORDER BY w.tenant_id;
