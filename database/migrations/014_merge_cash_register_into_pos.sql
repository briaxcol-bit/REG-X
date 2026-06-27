-- ============================================================
-- Migration 014: Fusionar cash_register dentro del módulo pos
-- El arqueo de caja es funcionalidad core del POS, no un módulo
-- separado. Se elimina de marketplace_modules (CASCADE borra
-- tenant_modules) y se actualiza la descripción del POS.
-- ============================================================

-- 1. Actualizar descripción del POS para que quede claro que incluye caja
UPDATE public.marketplace_modules
SET
  name        = 'Punto de Venta',
  description = 'Ventas, cobros, recibos, arqueo y cierre de caja por turno'
WHERE slug = 'pos';

-- 2. Eliminar cash_register (tenant_modules se limpia por FK CASCADE)
DELETE FROM public.marketplace_modules
WHERE slug = 'cash_register';

-- 3. Actualizar seed_tenant_modules: quitar cash_register de todos los tipos
CREATE OR REPLACE FUNCTION public.seed_tenant_modules(
  p_tenant_id   UUID,
  p_business_type TEXT DEFAULT 'CUSTOM'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slugs TEXT[];
  v_core  TEXT[] := ARRAY[
    'pos','inventory','customers','reports','expenses','suppliers'
  ];
BEGIN
  CASE p_business_type
    WHEN 'STORE' THEN
      v_slugs := v_core || ARRAY[
        'promotions','loyalty','label_printer','purchase_orders',
        'price_lists','gift_cards','layaway',
        'employees','commissions','attendance',
        'accounts_receivable','accounts_payable'
      ];
    WHEN 'HARDWARE' THEN
      v_slugs := v_core || ARRAY[
        'quotes','work_orders','assemblies','unit_conversion','serial_tracking',
        'label_printer','purchase_orders','price_lists','promotions','layaway',
        'employees','commissions','attendance',
        'accounts_receivable','accounts_payable'
      ];
    WHEN 'MINIMARKET' THEN
      v_slugs := v_core || ARRAY[
        'promotions','loyalty','label_printer','purchase_orders','price_lists','gift_cards',
        'expiry_control','batch_tracking',
        'employees','commissions','attendance','accounts_payable'
      ];
    WHEN 'WHOLESALE' THEN
      v_slugs := v_core || ARRAY[
        'purchase_orders','price_lists','quotes','label_printer',
        'batch_tracking','serial_tracking',
        'employees','attendance',
        'accounts_receivable','accounts_payable','tax_reports'
      ];
    WHEN 'PHARMACY' THEN
      v_slugs := v_core || ARRAY[
        'prescriptions','expiry_control','batch_tracking','drug_catalog',
        'label_printer','purchase_orders','price_lists',
        'employees','attendance',
        'accounts_receivable','accounts_payable','tax_reports'
      ];
    WHEN 'RESTAURANT' THEN
      v_slugs := v_core || ARRAY[
        'kitchen_display','tables','reservations','delivery',
        'menu_digital','tips','split_bill',
        'promotions','loyalty',
        'employees','commissions','attendance','payroll','accounts_payable'
      ];
    WHEN 'CAFE' THEN
      v_slugs := v_core || ARRAY[
        'kitchen_display','tables','delivery','menu_digital','tips',
        'promotions','loyalty',
        'employees','commissions','attendance'
      ];
    WHEN 'BAR' THEN
      v_slugs := v_core || ARRAY[
        'kitchen_display','tables','bar_tabs','tips','split_bill',
        'promotions','loyalty',
        'employees','commissions','attendance'
      ];
    WHEN 'RESTOBAR' THEN
      v_slugs := v_core || ARRAY[
        'kitchen_display','tables','bar_tabs','reservations','delivery',
        'menu_digital','tips','split_bill',
        'promotions','loyalty',
        'employees','commissions','attendance','payroll','accounts_payable'
      ];
    WHEN 'BAKERY' THEN
      v_slugs := v_core || ARRAY[
        'kitchen_display','delivery','menu_digital',
        'promotions','loyalty','label_printer','purchase_orders',
        'employees','commissions','attendance'
      ];
    WHEN 'ICE_CREAM_SHOP' THEN
      v_slugs := v_core || ARRAY[
        'promotions','loyalty','label_printer',
        'employees','commissions','attendance'
      ];
    WHEN 'SERVICES' THEN
      v_slugs := v_core || ARRAY[
        'quotes','work_orders',
        'employees','commissions','attendance','payroll',
        'accounts_receivable','accounts_payable'
      ];
    ELSE -- CUSTOM y cualquier otro
      v_slugs := v_core;
  END CASE;

  INSERT INTO public.tenant_modules (tenant_id, module_id, is_enabled)
  SELECT
    p_tenant_id,
    mm.id,
    TRUE
  FROM public.marketplace_modules mm
  WHERE mm.slug = ANY(v_slugs)
  ON CONFLICT (tenant_id, module_id) DO NOTHING;
END;
$$;
