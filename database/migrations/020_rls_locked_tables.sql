-- ============================================================
-- REG-X — Migration 020: Políticas para tablas con RLS activo pero bloqueadas
-- ============================================================
-- Detectadas en la auditoría (01/07/2026): tenían RLS habilitado pero SIN
-- ninguna política -> deny-all (la feature no lee/escribe nada en silencio).
--
--   transfer_items      -> datos de tenant, sin tenant_id propio (via transfers)
--   webhook_deliveries  -> datos de tenant, sin tenant_id propio (via webhook_endpoints)
--   feature_flags       -> catálogo GLOBAL de plataforma
--   marketplace_modules -> catálogo GLOBAL de plataforma (app store de módulos)
--
-- Helpers reutilizados: user_belongs_to_tenant(uuid), user_role_in_tenant(uuid)
--                        public.is_super_admin()
-- Idempotente.
-- ============================================================

-- ── transfer_items (aislamiento por la transferencia padre) ──
DROP POLICY IF EXISTS "transfer_items_select" ON transfer_items;
DROP POLICY IF EXISTS "transfer_items_insert" ON transfer_items;
DROP POLICY IF EXISTS "transfer_items_update" ON transfer_items;
CREATE POLICY "transfer_items_select" ON transfer_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM transfers t
    WHERE t.id = transfer_items.transfer_id AND user_belongs_to_tenant(t.tenant_id)));
CREATE POLICY "transfer_items_insert" ON transfer_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM transfers t
    WHERE t.id = transfer_items.transfer_id AND user_belongs_to_tenant(t.tenant_id)));
CREATE POLICY "transfer_items_update" ON transfer_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM transfers t
    WHERE t.id = transfer_items.transfer_id AND user_belongs_to_tenant(t.tenant_id)));

-- ── webhook_deliveries (via endpoint padre; solo OWNER/ADMIN leen) ──
-- La escritura de entregas la hace el backend con service_role (ignora RLS),
-- por eso aquí solo definimos lectura para administradores del tenant.
DROP POLICY IF EXISTS "webhook_deliveries_select" ON webhook_deliveries;
CREATE POLICY "webhook_deliveries_select" ON webhook_deliveries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM webhook_endpoints e
    WHERE e.id = webhook_deliveries.endpoint_id
      AND user_belongs_to_tenant(e.tenant_id)
      AND user_role_in_tenant(e.tenant_id) IN ('OWNER','ADMIN')
  ));

-- ── feature_flags (catálogo global: lee autenticado, escribe superadmin) ──
DROP POLICY IF EXISTS "feature_flags_select" ON feature_flags;
DROP POLICY IF EXISTS "feature_flags_write"  ON feature_flags;
CREATE POLICY "feature_flags_select" ON feature_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "feature_flags_write" ON feature_flags FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ── marketplace_modules (catálogo global: lee autenticado, escribe superadmin) ──
DROP POLICY IF EXISTS "marketplace_modules_select" ON marketplace_modules;
DROP POLICY IF EXISTS "marketplace_modules_write"  ON marketplace_modules;
CREATE POLICY "marketplace_modules_select" ON marketplace_modules FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "marketplace_modules_write" ON marketplace_modules FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- Verificación: no debe quedar ninguna tabla con RLS y sin política.
--   SELECT c.relname FROM pg_class c
--   LEFT JOIN pg_policy p ON p.polrelid = c.oid
--   WHERE c.relkind='r' AND c.relnamespace='public'::regnamespace
--     AND c.relrowsecurity = true
--   GROUP BY c.relname HAVING count(p.polname)=0;
-- (debe devolver 0 filas)
-- ============================================================
