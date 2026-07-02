-- ============================================================
-- REG-X — Migration 021: RPC create_sale_transaction endurecido
-- ============================================================
-- Reemplaza la versión de 004_functions_views.sql.
-- Objetivo: que el cobro sea ATÓMICO y seguro. El frontend pasa a llamar
-- este RPC en vez de hacer inserts sueltos no transaccionales.
--
-- Mejoras vs versión anterior:
--   1) Valida user_belongs_to_tenant(tenant_id) -> impide crear ventas en
--      otro tenant (la función es SECURITY DEFINER y saltaría RLS).
--   2) Descuento de stock atómico (quantity = quantity - x) con GUARDIA:
--      si el stock quedaría negativo, aborta toda la venta (no sobreventa).
--   3) Inserts con columnas explícitas (no jsonb_populate_record frágil).
--   4) Todo dentro de una sola transacción plpgsql: si algo falla, no queda
--      nada a medias.
--
-- Comportamiento preservado: el stock se descuenta al CREAR la venta (tanto
-- venta directa COMPLETED como comanda PENDING); completar una comanda no
-- vuelve a descontar. No hay doble descuento.
-- ============================================================

CREATE OR REPLACE FUNCTION create_sale_transaction(
  p_sale     JSONB,
  p_items    JSONB,
  p_payments JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant  UUID := (p_sale->>'tenant_id')::UUID;
  v_branch  UUID := (p_sale->>'branch_id')::UUID;
  v_status  TEXT := COALESCE(NULLIF(p_sale->>'status',''), 'COMPLETED');
  v_creator UUID := NULLIF(p_sale->>'created_by','')::UUID;
  v_order   TEXT := COALESCE(NULLIF(p_sale->>'order_number',''),
                             'ORD-' || to_char(now(),'YYMMDDHH24MISS'));
  v_sale_id UUID;
  v_wh      UUID;
  v_item    JSONB;
  v_pay     JSONB;
  v_qty     NUMERIC;
  v_new     NUMERIC;
BEGIN
  -- 1) SEGURIDAD: el usuario autenticado debe pertenecer al tenant
  IF v_tenant IS NULL OR NOT user_belongs_to_tenant(v_tenant) THEN
    RAISE EXCEPTION 'No autorizado para el tenant %', v_tenant
      USING ERRCODE = '42501';
  END IF;

  -- 2) Insertar la venta (id explícito para no depender del DEFAULT de la tabla)
  v_sale_id := gen_random_uuid();
  INSERT INTO sales (
    id, tenant_id, branch_id, cash_register_id, customer_id, order_number,
    subtotal, tax_total, discount_total, total, currency, status, notes,
    completed_at, created_by, completed_by
  ) VALUES (
    v_sale_id, v_tenant, v_branch,
    NULLIF(p_sale->>'cash_register_id','')::UUID,
    NULLIF(p_sale->>'customer_id','')::UUID,
    v_order,
    COALESCE((p_sale->>'subtotal')::NUMERIC, 0),
    COALESCE((p_sale->>'tax_total')::NUMERIC, 0),
    COALESCE((p_sale->>'discount_total')::NUMERIC, 0),
    COALESCE((p_sale->>'total')::NUMERIC, 0),
    COALESCE(NULLIF(p_sale->>'currency',''), 'COP'),
    v_status::sale_status,
    NULLIF(p_sale->>'notes',''),
    CASE WHEN v_status = 'COMPLETED' THEN now() ELSE NULL END,
    v_creator,
    CASE WHEN v_status = 'COMPLETED' THEN v_creator ELSE NULL END
  );

  -- 3) Almacén por defecto del branch (fallback: cualquiera del branch)
  SELECT id INTO v_wh
    FROM warehouses
   WHERE branch_id = v_branch AND tenant_id = v_tenant AND is_active = TRUE
   ORDER BY is_default DESC
   LIMIT 1;

  -- 4) Ítems + descuento de stock atómico con guardia de negativos
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO sale_items (
      id, sale_id, product_id, variant_id, sku, name, quantity, unit_price,
      discount, discount_amount, tax, tax_amount, total
    ) VALUES (
      gen_random_uuid(),
      v_sale_id,
      (v_item->>'product_id')::UUID,
      NULLIF(v_item->>'variant_id','')::UUID,
      v_item->>'sku',
      v_item->>'name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'discount')::NUMERIC, 0),
      COALESCE((v_item->>'discount_amount')::NUMERIC, 0),
      COALESCE((v_item->>'tax')::NUMERIC, 0),
      COALESCE((v_item->>'tax_amount')::NUMERIC, 0),
      (v_item->>'total')::NUMERIC
    );

    v_qty := (v_item->>'quantity')::NUMERIC;

    -- Solo descuenta si hay almacén y la venta no está cancelada
    IF v_wh IS NOT NULL AND v_status <> 'CANCELLED' THEN
      UPDATE inventory
         SET quantity = quantity - v_qty,
             updated_at = now()
       WHERE tenant_id = v_tenant
         AND warehouse_id = v_wh
         AND product_id = (v_item->>'product_id')::UUID
         AND variant_id IS NOT DISTINCT FROM NULLIF(v_item->>'variant_id','')::UUID
      RETURNING quantity INTO v_new;

      -- Si el producto lleva inventario (existe la fila), aplicar guardia + movimiento
      IF FOUND THEN
        IF v_new < 0 THEN
          RAISE EXCEPTION 'Stock insuficiente para "%": faltan % unidades',
            (v_item->>'name'), (-v_new)
            USING ERRCODE = '23514';
        END IF;

        INSERT INTO stock_movements (
          id, tenant_id, branch_id, warehouse_id, product_id, variant_id,
          type, quantity, unit_cost, reference_type, reference_id, notes, created_by
        ) VALUES (
          gen_random_uuid(),
          v_tenant, v_branch, v_wh,
          (v_item->>'product_id')::UUID,
          NULLIF(v_item->>'variant_id','')::UUID,
          'SALE',
          v_qty,
          (v_item->>'unit_price')::NUMERIC,
          'SALE',
          v_sale_id,
          'Venta ' || v_order,
          v_creator
        );
      END IF;
    END IF;
  END LOOP;

  -- 5) Pagos
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
    INSERT INTO sale_payments (id, sale_id, method, amount, reference)
    VALUES (
      gen_random_uuid(),
      v_sale_id,
      (v_pay->>'method')::payment_method,
      (v_pay->>'amount')::NUMERIC,
      NULLIF(v_pay->>'reference','')
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_sale_transaction(JSONB, JSONB, JSONB) TO authenticated;
