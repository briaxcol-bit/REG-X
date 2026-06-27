-- ============================================================
-- REG-X — Migration 013: Catálogo Completo de Módulos
-- ------------------------------------------------------------
-- 1. Extiende el enum business_type con nuevos tipos de negocio:
--    HARDWARE, CAFE, SERVICES, WHOLESALE
-- 2. Inserta/actualiza el catálogo completo de módulos (~35)
-- 3. Actualiza seed_tenant_modules para todos los business_type
-- 4. Actualiza seed_tenant_roles para los nuevos tipos
--
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) EXTENDER ENUM business_type
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'HARDWARE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'CAFE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'SERVICES';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'WHOLESALE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════
-- 2) CATÁLOGO COMPLETO DE MÓDULOS
-- ══════════════════════════════════════════════════════════════
--
-- Categorías:
--   core        → base para cualquier negocio
--   restaurant  → F&B, cocina, mesas
--   retail      → venta al detal, fidelización
--   pharmacy    → control medicamentos, lotes
--   hardware    → ferretería, cotizaciones, kits
--   services    → servicios técnicos y profesionales
--   finance     → contabilidad, cartera, nómina
--   hr          → empleados, asistencia, comisiones
--   advanced    → multi-sucursal, API, e-commerce

INSERT INTO public.marketplace_modules
  (slug, name, description, category, is_free, min_plan, is_active)
VALUES
  -- ── CORE ──────────────────────────────────────────────────
  ('pos',               'Punto de Venta',            'Ventas, caja, cobros y recibos',                               'core',       TRUE,  'FREE',         TRUE),
  ('inventory',         'Inventario',                'Control de stock, alertas y ajustes de inventario',            'core',       TRUE,  'FREE',         TRUE),
  ('customers',         'Clientes',                  'CRM básico: historial de compras y datos de contacto',         'core',       TRUE,  'FREE',         TRUE),
  ('reports',           'Reportes',                  'Reportes de ventas, caja e inventario',                        'core',       TRUE,  'FREE',         TRUE),
  ('expenses',          'Gastos Operativos',         'Registro y categorización de gastos del negocio',              'core',       TRUE,  'FREE',         TRUE),
  ('suppliers',         'Proveedores',               'Gestión de proveedores y contactos comerciales',               'core',       TRUE,  'FREE',         TRUE),
  ('cash_register',     'Caja y Arqueo',             'Apertura, cierre y cuadre de caja por turno',                  'core',       TRUE,  'FREE',         TRUE),

  -- ── RESTAURANT / F&B ──────────────────────────────────────
  ('kitchen_display',   'Pantalla de Cocina (KDS)',  'Órdenes en tiempo real para cocina y barra',                   'restaurant', TRUE,  'BASIC',        TRUE),
  ('tables',            'Gestión de Mesas',          'Mapa de mesas, asignación y estado de ocupación',              'restaurant', TRUE,  'BASIC',        TRUE),
  ('reservations',      'Reservas',                  'Agenda de reservas con confirmación y recordatorios',          'restaurant', FALSE, 'PROFESSIONAL', TRUE),
  ('bar_tabs',          'Comandas de Bar',           'Tabs abiertos por mesa o cliente, cierre y división',          'restaurant', TRUE,  'BASIC',        TRUE),
  ('delivery',          'Delivery',                  'Pedidos a domicilio y seguimiento de repartidores',            'restaurant', FALSE, 'PROFESSIONAL', TRUE),
  ('menu_digital',      'Menú Digital QR',           'Menú interactivo vía QR para que el cliente ordene',           'restaurant', FALSE, 'PROFESSIONAL', TRUE),
  ('tips',              'Propinas',                  'Gestión y distribución de propinas por mesa/empleado',         'restaurant', TRUE,  'BASIC',        TRUE),
  ('split_bill',        'División de Cuenta',        'Divide la cuenta entre comensales de forma flexible',          'restaurant', TRUE,  'BASIC',        TRUE),

  -- ── RETAIL ────────────────────────────────────────────────
  ('promotions',        'Promociones y Descuentos',  'Descuentos, combos, 2x1 y precios por volumen',                'retail',     TRUE,  'BASIC',        TRUE),
  ('loyalty',           'Fidelización',              'Puntos, recompensas y tarjetas de cliente frecuente',          'retail',     FALSE, 'PROFESSIONAL', TRUE),
  ('label_printer',     'Impresora de Etiquetas',    'Generación e impresión de etiquetas de precio y código',       'retail',     TRUE,  'FREE',         TRUE),
  ('purchase_orders',   'Órdenes de Compra',         'Creación y seguimiento de órdenes a proveedores',              'retail',     TRUE,  'BASIC',        TRUE),
  ('price_lists',       'Listas de Precios',         'Precios diferenciados por cliente, canal o volumen',           'retail',     TRUE,  'BASIC',        TRUE),
  ('gift_cards',        'Tarjetas de Regalo',        'Emisión y redención de gift cards y bonos',                    'retail',     FALSE, 'PROFESSIONAL', TRUE),
  ('layaway',           'Apartados',                 'Ventas a crédito con abonos parciales y seguimiento',          'retail',     TRUE,  'BASIC',        TRUE),

  -- ── PHARMACY ──────────────────────────────────────────────
  ('prescriptions',     'Recetas Médicas',           'Registro y validación de recetas para dispensación',           'pharmacy',   TRUE,  'BASIC',        TRUE),
  ('expiry_control',    'Control de Vencimientos',   'Alertas de productos próximos a vencer',                       'pharmacy',   TRUE,  'FREE',         TRUE),
  ('batch_tracking',    'Trazabilidad por Lotes',    'Seguimiento de lotes desde proveedor hasta venta',             'pharmacy',   TRUE,  'BASIC',        TRUE),
  ('drug_catalog',      'Catálogo de Medicamentos',  'Catálogo con principios activos, presentaciones y registros',  'pharmacy',   TRUE,  'BASIC',        TRUE),

  -- ── HARDWARE / FERRETERÍA ─────────────────────────────────
  ('quotes',            'Cotizaciones',              'Genera y envía cotizaciones que se convierten en ventas',       'hardware',   TRUE,  'BASIC',        TRUE),
  ('work_orders',       'Órdenes de Trabajo',        'Gestión de trabajos, servicios técnicos y reparaciones',       'hardware',   TRUE,  'BASIC',        TRUE),
  ('assemblies',        'Ensambles y Kits',          'Arma productos desde componentes; descuenta partes del stock', 'hardware',   TRUE,  'BASIC',        TRUE),
  ('unit_conversion',   'Conversión de Unidades',    'Vende por metro, vara, bulto, caja o fracción',                'hardware',   TRUE,  'FREE',         TRUE),
  ('serial_tracking',   'Seguimiento por Serial',    'Registra y rastrea productos por número de serie',             'hardware',   TRUE,  'BASIC',        TRUE),

  -- ── FINANCE ───────────────────────────────────────────────
  ('accounting',        'Contabilidad',              'Libro diario, plan de cuentas y balances',                     'finance',    FALSE, 'PROFESSIONAL', TRUE),
  ('accounts_receivable','Cuentas por Cobrar',       'Cartera de clientes, vencimientos y cobros',                   'finance',    TRUE,  'BASIC',        TRUE),
  ('accounts_payable',  'Cuentas por Pagar',         'Deudas a proveedores, fechas límite y pagos',                  'finance',    TRUE,  'BASIC',        TRUE),
  ('tax_reports',       'Informes Tributarios',      'Reportes para DIAN, IVA y factura electrónica',                'finance',    FALSE, 'PROFESSIONAL', TRUE),
  ('payroll',           'Nómina',                    'Liquidación de salarios, prestaciones y pagos a empleados',    'finance',    FALSE, 'PROFESSIONAL', TRUE),

  -- ── HR ────────────────────────────────────────────────────
  ('employees',         'Empleados',                 'Gestión de empleados: roles, permisos y datos laborales',      'hr',         TRUE,  'FREE',         TRUE),
  ('attendance',        'Asistencia y Turnos',       'Control de entrada/salida y programación de turnos',           'hr',         TRUE,  'BASIC',        TRUE),
  ('commissions',       'Comisiones',                'Cálculo de comisiones por venta para empleados',               'hr',         TRUE,  'BASIC',        TRUE),

  -- ── ADVANCED ──────────────────────────────────────────────
  ('multi_branch',      'Multi-Sucursal',            'Gestión centralizada de múltiples sucursales',                 'advanced',   FALSE, 'PROFESSIONAL', TRUE),
  ('warehouse_transfer','Transferencia de Bodegas',  'Movimientos de stock entre sucursales y bodegas',              'advanced',   FALSE, 'PROFESSIONAL', TRUE),
  ('ecommerce',         'Tienda en Línea',           'Catálogo web conectado al inventario con carrito de compras',  'advanced',   FALSE, 'ENTERPRISE',   TRUE),
  ('webhooks',          'Webhooks / API',            'Integración con sistemas externos vía webhooks y REST API',    'advanced',   FALSE, 'ENTERPRISE',   TRUE),
  ('audit_log',         'Auditoría',                 'Log de todas las acciones críticas del sistema por usuario',   'advanced',   FALSE, 'PROFESSIONAL', TRUE)

ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_free     = EXCLUDED.is_free,
  min_plan    = EXCLUDED.min_plan,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();


-- ══════════════════════════════════════════════════════════════
-- 3) seed_tenant_modules COMPLETO
-- ══════════════════════════════════════════════════════════════
--
-- Módulos por tipo de negocio:
--
-- STORE        → core + caja + retail completo + hr + cartera
-- RESTAURANT   → core + caja + f&b completo + hr + nómina
-- BAR          → core + caja + bar + propinas + hr
-- RESTOBAR     → core + caja + f&b + bar + hr + nómina
-- BAKERY       → core + caja + cocina + delivery + retail básico + hr
-- ICE_CREAM_SHOP→core + caja + retail básico + hr
-- PHARMACY     → core + caja + farmacia completo + hr + cartera + tributario
-- MINIMARKET   → core + caja + retail + vencimientos + lotes + hr + cartera
-- HARDWARE     → core + caja + ferretería completo + retail + hr + cartera
-- CAFE         → core + caja + cocina + mesas + delivery + fidelización + hr
-- SERVICES     → core + caja + cotizaciones + órdenes + hr + cartera + nómina
-- WHOLESALE    → core + caja + compras + precios + cotizaciones + lotes + hr + cartera + tributario
-- CUSTOM       → solo core

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
  v_slugs  TEXT[];
  v_slug   TEXT;
  v_mod_id UUID;
BEGIN
  -- Core universal para todos
  v_slugs := ARRAY[
    'pos','inventory','customers','reports',
    'expenses','suppliers','cash_register'
  ];

  -- Módulos adicionales por tipo
  v_slugs := v_slugs || CASE upper(p_business_type)

    WHEN 'STORE' THEN ARRAY[
      'promotions','loyalty','label_printer','purchase_orders',
      'price_lists','gift_cards','layaway',
      'employees','commissions','attendance',
      'accounts_receivable','accounts_payable'
    ]

    WHEN 'RESTAURANT' THEN ARRAY[
      'kitchen_display','tables','reservations',
      'delivery','menu_digital','tips','split_bill',
      'promotions','loyalty',
      'employees','commissions','attendance','payroll',
      'accounts_payable'
    ]

    WHEN 'BAR' THEN ARRAY[
      'kitchen_display','tables','bar_tabs',
      'tips','split_bill','promotions','loyalty',
      'employees','commissions','attendance'
    ]

    WHEN 'RESTOBAR' THEN ARRAY[
      'kitchen_display','tables','bar_tabs','reservations',
      'delivery','menu_digital','tips','split_bill',
      'promotions','loyalty',
      'employees','commissions','attendance','payroll',
      'accounts_payable'
    ]

    WHEN 'BAKERY' THEN ARRAY[
      'kitchen_display','delivery','menu_digital',
      'promotions','loyalty','label_printer','purchase_orders',
      'employees','commissions','attendance'
    ]

    WHEN 'ICE_CREAM_SHOP' THEN ARRAY[
      'promotions','loyalty','label_printer',
      'employees','commissions','attendance'
    ]

    WHEN 'PHARMACY' THEN ARRAY[
      'prescriptions','expiry_control','batch_tracking','drug_catalog',
      'label_printer','purchase_orders','price_lists',
      'employees','attendance',
      'accounts_receivable','accounts_payable','tax_reports'
    ]

    WHEN 'MINIMARKET' THEN ARRAY[
      'promotions','loyalty','label_printer','purchase_orders',
      'price_lists','gift_cards',
      'expiry_control','batch_tracking',
      'employees','commissions','attendance',
      'accounts_payable'
    ]

    WHEN 'HARDWARE' THEN ARRAY[
      'quotes','work_orders','assemblies',
      'unit_conversion','serial_tracking',
      'label_printer','purchase_orders','price_lists',
      'promotions','layaway',
      'employees','commissions','attendance',
      'accounts_receivable','accounts_payable'
    ]

    WHEN 'CAFE' THEN ARRAY[
      'kitchen_display','tables','delivery','menu_digital',
      'promotions','loyalty','tips',
      'employees','commissions','attendance'
    ]

    WHEN 'SERVICES' THEN ARRAY[
      'quotes','work_orders',
      'employees','commissions','attendance','payroll',
      'accounts_receivable','accounts_payable'
    ]

    WHEN 'WHOLESALE' THEN ARRAY[
      'purchase_orders','price_lists','quotes',
      'label_printer','batch_tracking','serial_tracking',
      'employees','attendance',
      'accounts_receivable','accounts_payable','tax_reports'
    ]

    ELSE ARRAY[]::TEXT[]  -- CUSTOM: solo core
  END;

  FOREACH v_slug IN ARRAY v_slugs
  LOOP
    SELECT id INTO v_mod_id
      FROM public.marketplace_modules
     WHERE slug = v_slug AND is_active = TRUE;

    IF v_mod_id IS NOT NULL THEN
      INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled, config)
      VALUES (p_tenant_id, v_mod_id, TRUE, '{}'::jsonb)
      ON CONFLICT (tenant_id, module_id)
      DO UPDATE SET is_enabled = TRUE, updated_at = NOW();
    END IF;
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 4) seed_tenant_roles — agrega nuevos business types
-- ══════════════════════════════════════════════════════════════
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
                          "products.view","products.create","products.edit"],
    "TECHNICIAN":        ["work_orders.view","work_orders.update","inventory.view","products.view"],
    "SALESPERSON":       ["sales.create","sales.view","customers.view","customers.create",
                          "products.view","discounts.apply","quotes.create","quotes.view"],
    "DELIVERY":          ["sales.view","customers.view"]
  }'::jsonb;

BEGIN
  v_active_roles := CASE upper(p_business_type)
    WHEN 'RESTAURANT'    THEN ARRAY['OWNER','ADMIN','CASHIER','WAITER','CHEF','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'BAR'           THEN ARRAY['OWNER','ADMIN','CASHIER','WAITER','BARTENDER','ACCOUNTANT']
    WHEN 'RESTOBAR'      THEN ARRAY['OWNER','ADMIN','CASHIER','WAITER','CHEF','BARTENDER','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'BAKERY'        THEN ARRAY['OWNER','ADMIN','CASHIER','CHEF','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'ICE_CREAM_SHOP'THEN ARRAY['OWNER','ADMIN','CASHIER','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'PHARMACY'      THEN ARRAY['OWNER','ADMIN','CASHIER','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'MINIMARKET'    THEN ARRAY['OWNER','ADMIN','CASHIER','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'STORE'         THEN ARRAY['OWNER','ADMIN','CASHIER','SALESPERSON','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'HARDWARE'      THEN ARRAY['OWNER','ADMIN','CASHIER','SALESPERSON','TECHNICIAN','ACCOUNTANT','INVENTORY_MANAGER']
    WHEN 'CAFE'          THEN ARRAY['OWNER','ADMIN','CASHIER','WAITER','CHEF','ACCOUNTANT']
    WHEN 'SERVICES'      THEN ARRAY['OWNER','ADMIN','CASHIER','TECHNICIAN','SALESPERSON','ACCOUNTANT']
    WHEN 'WHOLESALE'     THEN ARRAY['OWNER','ADMIN','CASHIER','SALESPERSON','ACCOUNTANT','INVENTORY_MANAGER','DELIVERY']
    ELSE                      ARRAY['OWNER','ADMIN','CASHIER','WAITER','CHEF','BARTENDER',
                                    'ACCOUNTANT','INVENTORY_MANAGER','TECHNICIAN','SALESPERSON','DELIVERY']
  END;

  FOR r IN
    SELECT key AS role_name, value AS perms
      FROM jsonb_each(role_map)
     WHERE key = ANY(v_active_roles)
  LOOP
    INSERT INTO public.roles (tenant_id, name, description, is_system)
    VALUES (p_tenant_id, r.role_name, 'Rol de sistema', TRUE)
    ON CONFLICT (tenant_id, name) DO UPDATE SET is_system = TRUE
    RETURNING id INTO v_role_id;

    IF v_role_id IS NULL THEN
      SELECT id INTO v_role_id FROM public.roles
       WHERE tenant_id = p_tenant_id AND name = r.role_name;
    END IF;

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


SELECT 'Migración 013 (catálogo completo de módulos) aplicada ✅' AS resultado;
