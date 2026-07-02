-- ============================================================
-- REG-X — Migration 019: Cierre de huecos de RLS multi-tenant
-- ============================================================
-- Contexto: el frontend consulta Supabase directamente con la ANON key,
-- por lo que TODO el aislamiento entre tenants depende de RLS.
--
-- Esta migración corrige dos problemas detectados en la auditoría (01/07/2026):
--   A) Tablas con tenant_id SIN RLS habilitado  -> lectura/escritura cruzada
--      entre tenants (fuga de datos).
--   B) Tablas con RLS habilitado pero SIN políticas -> quedaron bloqueadas
--      (deny-all): la funcionalidad no lee/escribe nada.
--
-- Reutiliza los helpers definidos en 002_rls_policies.sql:
--   user_belongs_to_tenant(uuid), user_role_in_tenant(uuid)
--
-- Idempotente: se puede re-ejecutar sin error.
-- ============================================================

-- ── A) Habilitar RLS en tablas expuestas ─────────────────────
ALTER TABLE coupons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_areas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles         ENABLE ROW LEVEL SECURITY;

-- ── Políticas: patrón estándar de aislamiento por tenant ─────
-- Todas estas tablas tienen columna tenant_id (verificado en 001_initial_schema).

-- coupons
DROP POLICY IF EXISTS "coupons_select" ON coupons;
DROP POLICY IF EXISTS "coupons_insert" ON coupons;
DROP POLICY IF EXISTS "coupons_update" ON coupons;
CREATE POLICY "coupons_select" ON coupons FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "coupons_insert" ON coupons FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'));
CREATE POLICY "coupons_update" ON coupons FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'));

-- recipes
DROP POLICY IF EXISTS "recipes_select" ON recipes;
DROP POLICY IF EXISTS "recipes_insert" ON recipes;
DROP POLICY IF EXISTS "recipes_update" ON recipes;
CREATE POLICY "recipes_select" ON recipes FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "recipes_insert" ON recipes FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN','INVENTORY_MANAGER'));
CREATE POLICY "recipes_update" ON recipes FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN','INVENTORY_MANAGER'));

-- recipe_items (sin tenant_id propio -> aislamiento por la receta padre)
DROP POLICY IF EXISTS "recipe_items_select" ON recipe_items;
DROP POLICY IF EXISTS "recipe_items_insert" ON recipe_items;
DROP POLICY IF EXISTS "recipe_items_update" ON recipe_items;
CREATE POLICY "recipe_items_select" ON recipe_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM recipes r
    WHERE r.id = recipe_items.recipe_id AND user_belongs_to_tenant(r.tenant_id)));
CREATE POLICY "recipe_items_insert" ON recipe_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r
    WHERE r.id = recipe_items.recipe_id AND user_belongs_to_tenant(r.tenant_id)));
CREATE POLICY "recipe_items_update" ON recipe_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM recipes r
    WHERE r.id = recipe_items.recipe_id AND user_belongs_to_tenant(r.tenant_id)));

-- warehouses
DROP POLICY IF EXISTS "warehouses_select" ON warehouses;
DROP POLICY IF EXISTS "warehouses_insert" ON warehouses;
DROP POLICY IF EXISTS "warehouses_update" ON warehouses;
CREATE POLICY "warehouses_select" ON warehouses FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "warehouses_insert" ON warehouses FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN','INVENTORY_MANAGER'));
CREATE POLICY "warehouses_update" ON warehouses FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN','INVENTORY_MANAGER'));

-- dining_areas
DROP POLICY IF EXISTS "dining_areas_select" ON dining_areas;
DROP POLICY IF EXISTS "dining_areas_insert" ON dining_areas;
DROP POLICY IF EXISTS "dining_areas_update" ON dining_areas;
CREATE POLICY "dining_areas_select" ON dining_areas FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "dining_areas_insert" ON dining_areas FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'));
CREATE POLICY "dining_areas_update" ON dining_areas FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'));

-- roles (roles personalizados por tenant — solo OWNER/ADMIN escriben)
DROP POLICY IF EXISTS "roles_select" ON roles;
DROP POLICY IF EXISTS "roles_insert" ON roles;
DROP POLICY IF EXISTS "roles_update" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "roles_insert" ON roles FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'));
CREATE POLICY "roles_update" ON roles FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN'));

-- ── B) Tablas con RLS habilitado pero SIN políticas (deny-all) ─
-- product_variants y transfers tienen tenant_id; order_items se aisla por su orden padre.

-- product_variants
DROP POLICY IF EXISTS "product_variants_select" ON product_variants;
DROP POLICY IF EXISTS "product_variants_insert" ON product_variants;
DROP POLICY IF EXISTS "product_variants_update" ON product_variants;
CREATE POLICY "product_variants_select" ON product_variants FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "product_variants_insert" ON product_variants FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN','INVENTORY_MANAGER'));
CREATE POLICY "product_variants_update" ON product_variants FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN','INVENTORY_MANAGER'));

-- transfers
DROP POLICY IF EXISTS "transfers_select" ON transfers;
DROP POLICY IF EXISTS "transfers_insert" ON transfers;
DROP POLICY IF EXISTS "transfers_update" ON transfers;
CREATE POLICY "transfers_select" ON transfers FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "transfers_insert" ON transfers FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN','INVENTORY_MANAGER'));
CREATE POLICY "transfers_update" ON transfers FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id)
    AND user_role_in_tenant(tenant_id) IN ('OWNER','ADMIN','INVENTORY_MANAGER'));

-- order_items (sin tenant_id propio -> aislamiento por la orden padre)
DROP POLICY IF EXISTS "order_items_select" ON order_items;
DROP POLICY IF EXISTS "order_items_insert" ON order_items;
DROP POLICY IF EXISTS "order_items_update" ON order_items;
CREATE POLICY "order_items_select" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id AND user_belongs_to_tenant(o.tenant_id)));
CREATE POLICY "order_items_insert" ON order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id AND user_belongs_to_tenant(o.tenant_id)));
CREATE POLICY "order_items_update" ON order_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id AND user_belongs_to_tenant(o.tenant_id)));

-- ============================================================
-- Verificación posterior sugerida (correr en el SQL editor de Supabase):
--   SELECT relname, relrowsecurity
--   FROM pg_class WHERE relkind='r' AND relnamespace='public'::regnamespace
--   ORDER BY relrowsecurity, relname;
-- Toda tabla con tenant_id debe tener relrowsecurity = true.
-- ============================================================
