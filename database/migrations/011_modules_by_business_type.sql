-- ============================================================
-- REG-X — Migration 011: Módulos por Tipo de Negocio
-- ------------------------------------------------------------
-- 1. Pobla marketplace_modules con el catálogo base de módulos
-- 2. Reemplaza seed_tenant_roles para filtrar roles por business_type
-- 3. Crea seed_tenant_modules(tenant_id, business_type) que activa
--    los módulos correctos al crear un tenant
-- 4. Actualiza create_tenant_with_owner para llamar ambas funciones
--
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) CATÁLOGO DE MÓDULOS
-- ══════════════════════════════════════════════════════════════
-- Módulos del sistema. Cada tenant activa un subconjunto según
-- su business_type (y el super admin puede ajustar manualmente).

INSERT INTO public.marketplace_modules (slug, name, description, category, is_free, min_plan, is_active) VALUES
  -- Core (todos los negocios)
  ('pos',                'Punto de Venta',         'Ventas, caja, cobros y recibos',                           'core',        TRUE,  'FREE',         TRUE),
  ('inventory',          'Inventario',             'Control de stock, alertas y transferencias entre bodegas', 'core',        TRUE,  'FREE',         TRUE),
  ('customers',          'Clientes',               'CRM básico: historial de compras y datos de contacto',     'core',        TRUE,  'FREE',         TRUE),
  ('reports',            'Reportes',               'Reportes de ventas, caja e inventario',                    'analytics',   TRUE,  'FREE',         TRUE),

  -- Restauración / F&B
  ('kitchen_display',    'Pantalla de Cocina (KDS)','Órdenes en tiempo real para cocina y barra',              'restaurant',  TRUE,  'BASIC',        TRUE),
  ('tables',             'Gestión de Mesas',       'Mapa de mesas, asignación y estado de ocupación',          'restaurant',  TRUE,  'BASIC',        TRUE),
  ('reservations',       'Reservas',               'Agenda de reservas con confirmación y recordatorios',      'restaurant',  FALSE, 'PROFESSIONAL', TRUE),
  ('bar_tabs',           'Comandas de Bar',         'Tabs abiertos por mesa o cliente, cierre y división',     'restaurant',  TRUE,  'BASIC',        TRUE),
  ('delivery',           'Delivery',               'Pedidos a domicilio y seguimiento de repartidores',        'restaurant',  FALSE, 'PROFESSIONAL', TRUE),
  ('menu_digital',       'Menú Digital',           'QR con menú interactivo para que el cliente ordene',       'restaurant',  FALSE, 'PROFESSIONAL', TRUE),

  -- Retail / Comercio
  ('promotions',         'Promociones',            'Descuentos, combos y precios por volumen',                 'retail',      TRUE,  'BASIC',        TRUE),
  ('loyalty',            'Fidelización',           'Puntos, recompensas y tarjetas de cliente frecuente',      'retail',      FALSE, 'PROFESSIONAL', TRUE),
  ('suppliers',          'Proveedores',            'Órdenes de compra y gestión de proveedores',               'retail',      TRUE,  'BASIC',        TRUE),
  ('label_printer',      'Impresora de Etiquetas', 'Generación e impresión de etiquetas de precio y código',   'retail',      TRUE,  'FREE',         TRUE),

  -- Finanzas / Contabilidad
  ('accounting',         'Contabilidad',           'Libro diario, cuentas por pagar/cobrar y balances',        'finance',     FALSE, 'PROFESSIONAL', TRUE),
  ('expenses',           'Gastos',                 'Registro y categorización de gastos operativos',           'finance',     TRUE,  'BASIC',        TRUE),

  -- Multi-sucursal / Avanzado
  ('multi_branch',       'Multi-Sucursal',         'Gestión centralizada de múltiples sucursales',             'advanced',    FALSE, 'PROFESSIONAL', TRUE),
  ('warehouse_transfer', 'Transferencia de Bodega','Movimientos de stock entre sucursales y bodegas',          'advanced',    FALSE, 'PROFESSIONAL', TRUE),
  ('webhooks',           'Webhooks / API',         'Integración con sistemas externos vía webhooks',           'advanced',    FALSE, 'ENTERPRISE',   TRUE)

ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_free     = EXCLUDED.is_free,
  min_plan    = EXCLUDED.min_plan,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();


-- ══════════════════════════════════════════════════════════════
-- 2) seed_tenant_roles — filtra roles por business_type
-- ══════════════════════════════════════════════════════════════
-- Roles incluidos por tipo de negocio:
--
--  STORE / PHARMACY / MINIMARKET  → OWNER, ADMIN, CASHIER, ACCOUNTANT, INVENTORY_MANAGER
--  RESTAURANT                     → todos
--  BAR                            → OWNER, ADMIN, CASHIER, WAITER, BARTENDER, ACCOUNTANT
--  RESTOBAR                       → todos
--  BAKERY / ICE_CREAM_SHOP        → OWNER, ADMIN, CASHIER, CHEF, ACCOUNTANT, INVENTORY_MANAGER
--  CUSTOM                         → todos (el owner decide qué usar)

CREATE OR REPLACE FUNCTION public.seed_tenant_roles(
  p_tenant_id     UUID,
  p_business_type TEXT DEFAULT 'CUSTOM'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r              RECORD;
  v_role_id      UUID;
  v_active_roles TEXT[];

  -- Mapa completo rol → permisos. '*' = todos los permisos del catálogo.
  role_map JSONB := '{
    "OWNER":             ["*"],
    "ADMIN":             ["users.view","users.create","users.edit","users.delete",
                          "products.view","products.create","products.edit","products.delete",
                          "inventory.view","inventory.update","inventory.transfer",
                          "sales.create","sales.cancel","sales.view","sales.refund",
                          "customers.view","customers.create","customers.edit",
                          "cash.open","cash.close","cash.view",
                          "reports.view","reports.export",
                          "kitchen.view","kitchen.update","tables.manage",
                          "promotions.view","promotions.manage",
                          "settings.view","settings.manage",
                          "discounts.apply","discounts.manage"],
    "CASHIER":           ["sales.create","sales.view","products.view",
                          "customers.view","customers.create",
                          "cash.open","cash.close","cash.view","discounts.apply"],
    "WAITER":            ["sales.create","sales.view","kitchen.view","tables.manage","customers.view"],
    "CHEF":              ["kitchen.view","kitchen.update"],
    "BARTENDER":         ["sales.create","sales.view","kitchen.view","kitchen.update","tables.manage"],
    "ACCOUNTANT":        ["reports.view","reports.export","inventory.view","cash.view","sales.view"],
    "INVENTORY_MANAGER": ["inventory.view","inventory.update","inventory.transfer",
                          "products.view","products.create","products.edit"]
  }'::jsonb;

BEGIN
  -- Seleccionar qué roles corresponden a este tipo de negocio
  v_active_roles := CASE upper(p_business_type)
    WHEN 'RESTAURANT'    THEN ARRAY['OWNER','ADMIN','CASHIER','WAITER','CHEF','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'BAR'           THEN ARRAY['OWNER','ADMIN','CASHIER','WAITER','BARTENDER','ACCOUNTANT']
    WHEN 'RESTOBAR'      THEN ARRAY['OWNER','ADMIN','CASHIER','WAITER','CHEF','BARTENDER','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'BAKERY'        THEN ARRAY['OWNER','ADMIN','CASHIER','CHEF','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'ICE_CREAM_SHOP'THEN ARRAY['OWNER','ADMIN','CASHIER','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'PHARMACY'      THEN ARRAY['OWNER','ADMIN','CASHIER','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'MINIMARKET'    THEN ARRAY['OWNER','ADMIN','CASHIER','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'STORE'         THEN ARRAY['OWNER','ADMIN','CASHIER','ACCOUNTANT','INVENTORY_MANAGER']
    ELSE                      -- CUSTOM y cualquier valor desconocido → todos
                              ARRAY['OWNER','ADMIN','CASHIER','WAITER','CHEF','BARTENDER','ACCOUNTANT','INVENTORY_MANAGER']
  END;

  FOR r IN
    SELECT key AS role_name, value AS perms
      FROM jsonb_each(role_map)
     WHERE key = ANY(v_active_roles)
  LOOP
    -- upsert del rol de sistema para el tenant
    INSERT INTO public.roles (tenant_id, name, description, is_system)
    VALUES (p_tenant_id, r.role_name, 'Rol de sistema', TRUE)
    ON CONFLICT (tenant_id, name) DO UPDATE SET is_system = TRUE
    RETURNING id INTO v_role_id;

    IF v_role_id IS NULL THEN
      SELECT id INTO v_role_id FROM public.roles
       WHERE tenant_id = p_tenant_id AND name = r.role_name;
    END IF;

    -- limpiar permisos previos y re-insertar
    DELETE FROM public.role_permissions WHERE role_id = v_role_id;

    IF r.perms ? '*' THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, p.id FROM public.permissions p
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, p.id
        FROM public.permissions p
       WHERE p.permission_key IN (SELECT jsonb_array_elements_text(r.perms))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 3) seed_tenant_modules — activa módulos según business_type
-- ══════════════════════════════════════════════════════════════
-- Módulos activados por tipo de negocio:
--
--  Todos                → pos, inventory, customers, reports
--  RESTAURANT           → + kitchen_display, tables, reservations, delivery, menu_digital, expenses, suppliers
--  BAR                  → + kitchen_display, tables, bar_tabs, expenses
--  RESTOBAR             → + kitchen_display, tables, bar_tabs, reservations, delivery, menu_digital, expenses, suppliers
--  BAKERY               → + kitchen_display, delivery, promotions, suppliers, expenses
--  ICE_CREAM_SHOP       → + promotions, loyalty, suppliers, expenses
--  STORE / MINIMARKET   → + promotions, loyalty, suppliers, label_printer, expenses
--  PHARMACY             → + suppliers, label_printer, expenses
--  CUSTOM               → solo core (el super admin activa el resto manualmente)

CREATE OR REPLACE FUNCTION public.seed_tenant_modules(
  p_tenant_id     UUID,
  p_business_type TEXT DEFAULT 'CUSTOM'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slugs   TEXT[];
  v_slug    TEXT;
  v_mod_id  UUID;
BEGIN
  -- Core universal
  v_slugs := ARRAY['pos', 'inventory', 'customers', 'reports'];

  -- Módulos adicionales por tipo
  v_slugs := v_slugs || CASE upper(p_business_type)
    WHEN 'RESTAURANT'    THEN ARRAY['kitchen_display','tables','reservations','delivery','menu_digital','expenses','suppliers']
    WHEN 'BAR'           THEN ARRAY['kitchen_display','tables','bar_tabs','expenses']
    WHEN 'RESTOBAR'      THEN ARRAY['kitchen_display','tables','bar_tabs','reservations','delivery','menu_digital','expenses','suppliers']
    WHEN 'BAKERY'        THEN ARRAY['kitchen_display','delivery','promotions','suppliers','expenses']
    WHEN 'ICE_CREAM_SHOP'THEN ARRAY['promotions','loyalty','suppliers','expenses']
    WHEN 'STORE'         THEN ARRAY['promotions','loyalty','suppliers','label_printer','expenses']
    WHEN 'MINIMARKET'    THEN ARRAY['promotions','loyalty','suppliers','label_printer','expenses']
    WHEN 'PHARMACY'      THEN ARRAY['suppliers','label_printer','expenses']
    ELSE                      ARRAY[]::TEXT[]   -- CUSTOM: solo core
  END;

  FOREACH v_slug IN ARRAY v_slugs
  LOOP
    SELECT id INTO v_mod_id
      FROM public.marketplace_modules
     WHERE slug = v_slug AND is_active = TRUE;

    IF v_mod_id IS NOT NULL THEN
      INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled, config)
      VALUES (p_tenant_id, v_mod_id, TRUE, '{}'::jsonb)
      ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_enabled = TRUE, updated_at = NOW();
    END IF;
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 4) Actualizar create_tenant_with_owner
--    Llama a seed_tenant_roles Y seed_tenant_modules con business_type
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
  p_name           TEXT,
  p_slug           TEXT,
  p_business_type  TEXT,
  p_plan           TEXT,
  p_country        TEXT,
  p_currency       TEXT,
  p_owner_email    TEXT,
  p_owner_name     TEXT,
  p_owner_password TEXT,
  p_timezone       TEXT DEFAULT 'America/Bogota',
  p_locale         TEXT DEFAULT 'es-CO',
  p_logo_url       TEXT DEFAULT NULL,
  p_primary_color  TEXT DEFAULT '#F20D18'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_tenant   UUID := uuid_generate_v4();
  v_branch   UUID := uuid_generate_v4();
  v_owner    UUID;
  v_now      TIMESTAMPTZ := now();
BEGIN
  -- ── Seguridad: solo SUPER_ADMIN ─────────────────────────
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede crear tenants';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'El slug "%" ya existe', p_slug;
  END IF;

  -- ── 1. Tenant ───────────────────────────────────────────
  INSERT INTO public.tenants (
    id, name, slug, business_type, plan, country, currency,
    timezone, locale, is_active, created_by, logo_url, primary_color
  ) VALUES (
    v_tenant, p_name, p_slug, p_business_type::business_type, p_plan,
    p_country, p_currency, p_timezone, p_locale, TRUE, v_caller, p_logo_url, p_primary_color
  );

  -- ── 2. Sucursal principal ───────────────────────────────
  INSERT INTO public.branches (
    id, tenant_id, name, code, is_main, is_active, currency, timezone, created_by
  ) VALUES (
    v_branch, v_tenant, 'Sucursal Principal', 'MAIN', TRUE, TRUE, p_currency, p_timezone, v_caller
  );

  -- ── 3. Bodega por defecto ───────────────────────────────
  INSERT INTO public.warehouses (tenant_id, branch_id, name, code, is_default, created_by)
  VALUES (v_tenant, v_branch, 'Bodega Principal', 'MAIN', TRUE, v_caller);

  -- ── 4. Suscripción (trial 30 días) ──────────────────────
  INSERT INTO public.subscriptions (
    tenant_id, plan, status, billing_cycle, price, currency,
    trial_ends_at, current_period_start, current_period_end, created_by
  ) VALUES (
    v_tenant, p_plan, 'TRIAL', 'MONTHLY', 0, p_currency,
    v_now + INTERVAL '30 days', v_now, v_now + INTERVAL '30 days', v_caller
  );

  -- ── 5. Roles de negocio filtrados por business_type ─────
  PERFORM public.seed_tenant_roles(v_tenant, p_business_type);

  -- ── 6. Módulos activados por business_type ──────────────
  PERFORM public.seed_tenant_modules(v_tenant, p_business_type);

  -- ── 7. Usuario OWNER ────────────────────────────────────
  SELECT id INTO v_owner FROM auth.users WHERE email = lower(p_owner_email);

  IF v_owner IS NULL THEN
    v_owner := uuid_generate_v4();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
      lower(p_owner_email), extensions.crypt(p_owner_password, extensions.gen_salt('bf')),
      v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_owner_name),
      v_now, v_now, '', '', '', ''
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_owner::text, v_owner,
      jsonb_build_object('sub', v_owner::text, 'email', lower(p_owner_email)),
      'email', v_now, v_now, v_now
    );
  END IF;

  -- ── 8. Perfil + rol OWNER en el tenant ──────────────────
  INSERT INTO public.user_profiles (id, full_name, locale)
  VALUES (v_owner, p_owner_name, p_locale)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.user_tenant_roles (user_id, tenant_id, branch_id, role, is_active, invited_by)
  VALUES (v_owner, v_tenant, v_branch, 'OWNER', TRUE, v_caller)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'OWNER', is_active = TRUE;

  RETURN jsonb_build_object(
    'tenant_id',   v_tenant,
    'branch_id',   v_branch,
    'owner_id',    v_owner,
    'owner_email', lower(p_owner_email)
  );
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 5) RLS para tenant_modules (super admin puede gestionar)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_write_tenant_modules" ON public.tenant_modules;
CREATE POLICY "super_admin_write_tenant_modules" ON public.tenant_modules
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- El owner/admin del tenant puede ver sus propios módulos
DROP POLICY IF EXISTS "tenant_modules_select" ON public.tenant_modules;
CREATE POLICY "tenant_modules_select" ON public.tenant_modules
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_tenant_roles utr
       WHERE utr.user_id = auth.uid()
         AND utr.tenant_id = tenant_modules.tenant_id
         AND utr.is_active = TRUE
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 6) Permisos de ejecución
-- ══════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.seed_tenant_roles(UUID, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_tenant_modules(UUID, TEXT)  TO authenticated;
GRANT SELECT ON public.marketplace_modules TO authenticated, anon;
GRANT SELECT ON public.tenant_modules      TO authenticated;
GRANT INSERT, UPDATE ON public.tenant_modules TO authenticated;


SELECT 'Migración 011 (módulos por tipo de negocio) aplicada ✅' AS resultado;
