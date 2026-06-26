-- ============================================================
-- REG-X — Seed 001: System Permissions
-- ============================================================
INSERT INTO permissions (id, permission_key, description, module) VALUES
  -- Users
  (uuid_generate_v4(), 'users.view',              'Ver usuarios',                         'users'),
  (uuid_generate_v4(), 'users.create',            'Crear usuarios',                       'users'),
  (uuid_generate_v4(), 'users.edit',              'Editar usuarios',                      'users'),
  (uuid_generate_v4(), 'users.delete',            'Eliminar usuarios',                    'users'),
  -- Products
  (uuid_generate_v4(), 'products.view',           'Ver productos',                        'products'),
  (uuid_generate_v4(), 'products.create',         'Crear productos',                      'products'),
  (uuid_generate_v4(), 'products.edit',           'Editar productos',                     'products'),
  (uuid_generate_v4(), 'products.delete',         'Eliminar productos',                   'products'),
  -- Inventory
  (uuid_generate_v4(), 'inventory.view',          'Ver inventario',                       'inventory'),
  (uuid_generate_v4(), 'inventory.update',        'Ajustar inventario',                   'inventory'),
  (uuid_generate_v4(), 'inventory.transfer',      'Transferir inventario',                'inventory'),
  -- Sales
  (uuid_generate_v4(), 'sales.create',            'Crear ventas (POS)',                   'pos'),
  (uuid_generate_v4(), 'sales.cancel',            'Cancelar ventas',                      'pos'),
  (uuid_generate_v4(), 'sales.view',              'Ver ventas',                           'pos'),
  (uuid_generate_v4(), 'sales.refund',            'Hacer devoluciones',                   'pos'),
  -- Customers
  (uuid_generate_v4(), 'customers.view',          'Ver clientes',                         'customers'),
  (uuid_generate_v4(), 'customers.create',        'Crear clientes',                       'customers'),
  (uuid_generate_v4(), 'customers.edit',          'Editar clientes',                      'customers'),
  -- Cash register
  (uuid_generate_v4(), 'cash.open',               'Abrir caja',                           'cash'),
  (uuid_generate_v4(), 'cash.close',              'Cerrar caja',                          'cash'),
  (uuid_generate_v4(), 'cash.view',               'Ver caja',                             'cash'),
  -- Reports
  (uuid_generate_v4(), 'reports.view',            'Ver reportes',                         'reports'),
  (uuid_generate_v4(), 'reports.export',          'Exportar reportes',                    'reports'),
  -- Kitchen / Restaurant
  (uuid_generate_v4(), 'kitchen.view',            'Ver pedidos cocina',                   'restaurant'),
  (uuid_generate_v4(), 'kitchen.update',          'Actualizar estado cocina',             'restaurant'),
  (uuid_generate_v4(), 'tables.manage',           'Gestionar mesas',                      'restaurant'),
  -- Promotions
  (uuid_generate_v4(), 'promotions.view',         'Ver promociones',                      'promotions'),
  (uuid_generate_v4(), 'promotions.manage',       'Gestionar promociones',                'promotions'),
  -- Settings
  (uuid_generate_v4(), 'settings.view',           'Ver configuración',                    'settings'),
  (uuid_generate_v4(), 'settings.manage',         'Gestionar configuración',              'settings'),
  -- Subscriptions
  (uuid_generate_v4(), 'subscriptions.manage',    'Gestionar suscripción',                'subscriptions'),
  -- Discounts
  (uuid_generate_v4(), 'discounts.apply',         'Aplicar descuentos en POS',            'pos'),
  (uuid_generate_v4(), 'discounts.manage',        'Gestionar descuentos',                 'pos')
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================
-- Seed 002: Demo Tenant + Branch
-- ============================================================
INSERT INTO tenants (id, name, slug, business_type, plan, country, currency, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Store',
  'demo-store',
  'STORE',
  'PROFESSIONAL',
  'COL',
  'COP',
  'America/Bogota'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO branches (id, tenant_id, name, code, is_main, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Sucursal Principal',
  'MAIN',
  TRUE,
  TRUE
) ON CONFLICT DO NOTHING;

INSERT INTO warehouses (id, tenant_id, branch_id, name, code, is_default)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Bodega Principal',
  'MAIN',
  TRUE
) ON CONFLICT DO NOTHING;

-- ── Marketplace modules ────────────────────────────────────────
INSERT INTO marketplace_modules (slug, name, description, version, category, price, is_free, min_plan)
VALUES
  ('restaurant',    'Módulo Restaurante',  'Mesas, órdenes, cocina, KDS',         '1.0.0', 'restaurant', 0, TRUE,  'BASIC'),
  ('bar',           'Módulo Bar',          'Coctelería, barra, display de bar',   '1.0.0', 'restaurant', 0, TRUE,  'BASIC'),
  ('loyalty',       'Fidelización',        'Puntos, tarjetas, beneficios',        '1.0.0', 'marketing',  0, TRUE,  'PROFESSIONAL'),
  ('e-invoice-co',  'Factura Electrónica Colombia (DIAN)', '🚧 En construcción', '0.1.0', 'compliance', 0, FALSE, 'PROFESSIONAL'),
  ('e-invoice-mx',  'Factura Electrónica México (SAT)',    '🚧 En construcción', '0.1.0', 'compliance', 0, FALSE, 'PROFESSIONAL'),
  ('ai-forecast',   'IA Predictiva',       '🚧 En construcción — Fase 5',        '0.0.1', 'ai',         0, FALSE, 'ENTERPRISE'),
  ('mobile-mgr',    'App Gerencial',       'KPIs y alertas en tu celular',        '1.0.0', 'mobile',     0, TRUE,  'PROFESSIONAL')
ON CONFLICT (slug) DO NOTHING;

-- ── Feature flags ──────────────────────────────────────────────
INSERT INTO feature_flags (key, description, is_enabled)
VALUES
  ('FF_ELECTRONIC_INVOICE', 'Facturación electrónica',      FALSE),
  ('FF_AI_FORECASTING',     'IA y forecasting predictivo',  FALSE),
  ('FF_MOBILE_APP',         'Aplicación móvil gerencial',   FALSE),
  ('FF_MARKETPLACE',        'Marketplace de módulos',       TRUE),
  ('FF_LOYALTY_PROGRAM',    'Programa de fidelización',     TRUE),
  ('FF_BARCODE_SCANNER',    'Scanner de código de barras',  TRUE),
  ('FF_SCALE_INTEGRATION',  'Integración con balanza',      FALSE),
  ('FF_MULTI_CURRENCY',     'Multi-moneda avanzada',        FALSE)
ON CONFLICT (key) DO NOTHING;

-- ── Demo categories ────────────────────────────────────────────
INSERT INTO categories (tenant_id, name, slug, color, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Bebidas',     'bebidas',     '#3B82F6', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'Alimentos',   'alimentos',   '#10B981', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'Electrónica', 'electronica', '#8B5CF6', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'Limpieza',    'limpieza',    '#F59E0B', TRUE)
ON CONFLICT DO NOTHING;
