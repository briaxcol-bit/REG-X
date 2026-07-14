-- ============================================================
-- REG-X — Migration 040: create_sale_transaction v4
-- ------------------------------------------------------------
-- Agrega el parámetro opcional  p_skip_stock_check BOOLEAN
-- (default FALSE).  Cuando es TRUE la función sigue descontando
-- el inventario y registrando el stock_movement, pero NO lanza
-- excepción si el resultado es negativo.
-- Caso de uso: checkout de mesas de restaurante — la comida ya
-- fue preparada, no tiene sentido bloquear el cobro por stock.
-- ============================================================

CREATE OR REPLACE FUNCTION create_sale_transaction(
  p_sale              JSONB,
  p_items             JSONB,
  p_payments          JSONB,
  p_skip_stock_check  BOOLEAN DEFAULT FALSE
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
  v_customer UUID := NULLIF(p_sale->>'customer_id','')::UUID;
  v_order   TEXT := COALESCE(NULLIF(p_sale->>'order_number',''),
                             'ORD-' || to_char(now(),'YYMMDDHH24MISS'));
  v_sale_id UUID;
  v_wh      UUID;
  v_item    JSONB;
  v_pay     JSONB;
  v_qty     NUMERIC;
  v_new     NUMERIC;
  -- side-effects
  v_method       TEXT;
  v_amount       NUMERIC;
  v_credit_total NUMERIC := 0;
  v_gc           RECORD;
  v_cfg          RECORD;
  v_points       INTEGER;
BEGIN
  -- 1) SEGURIDAD: el usuario autenticado debe pertenecer al tenant
  IF v_tenant IS NULL OR NOT user_belongs_to_tenant(v_tenant) THEN
    RAISE EXCEPTION 'No autorizado para el tenant %', v_tenant
      USING ERRCODE = '42501';
  END IF;

  -- 2) Insertar la venta
  v_sale_id := gen_random_uuid();
  INSERT INTO sales (
    id, tenant_id, branch_id, cash_register_id, customer_id, order_number,
    subtotal, tax_total, discount_total, total, currency, status, notes,
    completed_at, created_by, completed_by
  ) VALUES (
    v_sale_id, v_tenant, v_branch,
    NULLIF(p_sale->>'cash_register_id','')::UUID,
    v_customer,
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

  -- 3) Almacén por defecto del branch
  SELECT id INTO v_wh
    FROM warehouses
   WHERE branch_id = v_branch AND tenant_id = v_tenant AND is_active = TRUE
   ORDER BY is_default DESC
   LIMIT 1;

  -- 4) Ítems + descuento de stock
  --    Si p_skip_stock_check = FALSE (default): bloquea si stock queda negativo.
  --    Si p_skip_stock_check = TRUE (órdenes de restaurante): permite negativo,
  --    registra el movimiento y emite un WARNING en el log de Postgres.
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

    IF v_wh IS NOT NULL AND v_status <> 'CANCELLED' THEN
      UPDATE inventory
         SET quantity = quantity - v_qty,
             updated_at = now()
       WHERE tenant_id = v_tenant
         AND warehouse_id = v_wh
         AND product_id = (v_item->>'product_id')::UUID
         AND variant_id IS NOT DISTINCT FROM NULLIF(v_item->>'variant_id','')::UUID
      RETURNING quantity INTO v_new;

      IF FOUND THEN
        IF v_new < 0 THEN
          IF p_skip_stock_check THEN
            -- Orden de restaurante: registrar advertencia pero continuar
            RAISE WARNING 'Stock negativo para "%" tras venta de mesa (qty: %, resultado: %)',
              (v_item->>'name'), v_qty, v_new;
          ELSE
            RAISE EXCEPTION 'Stock insuficiente para "%": faltan % unidades',
              (v_item->>'name'), (-v_new)
              USING ERRCODE = '23514';
          END IF;
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

  -- 5) Pagos + side-effects por método
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
    v_method := v_pay->>'method';
    v_amount := (v_pay->>'amount')::NUMERIC;

    -- 5a) FIADO: exige cliente y acumula para la cuenta por cobrar
    IF v_method = 'CREDIT' THEN
      IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Una venta a crédito (fiado) requiere un cliente asignado'
          USING ERRCODE = '23514';
      END IF;
      v_credit_total := v_credit_total + v_amount;
    END IF;

    -- 5b) GIFT CARD: validar por código (reference), descontar saldo
    IF v_method = 'GIFT_CARD' THEN
      SELECT * INTO v_gc
        FROM gift_cards
       WHERE tenant_id = v_tenant
         AND code = NULLIF(v_pay->>'reference','')
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Gift card no encontrada (código en reference)'
          USING ERRCODE = '23514';
      END IF;
      IF v_gc.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Gift card % no está activa (estado %)', v_gc.code, v_gc.status
          USING ERRCODE = '23514';
      END IF;
      IF v_gc.expires_at IS NOT NULL AND v_gc.expires_at < CURRENT_DATE THEN
        RAISE EXCEPTION 'Gift card % está vencida', v_gc.code USING ERRCODE = '23514';
      END IF;
      IF v_gc.balance < v_amount THEN
        RAISE EXCEPTION 'Saldo insuficiente en gift card %: disponible %', v_gc.code, v_gc.balance
          USING ERRCODE = '23514';
      END IF;

      UPDATE gift_cards
         SET balance    = balance - v_amount,
             status     = CASE WHEN balance - v_amount <= 0 THEN 'REDEEMED' ELSE status END,
             updated_at = now()
       WHERE id = v_gc.id;

      INSERT INTO gift_card_transactions (tenant_id, gift_card_id, type, amount, note, created_by)
      VALUES (v_tenant, v_gc.id, 'REDEEM', v_amount, 'Venta ' || v_order, v_creator);
    END IF;

    INSERT INTO sale_payments (id, sale_id, method, amount, reference)
    VALUES (
      gen_random_uuid(),
      v_sale_id,
      v_method::payment_method,
      v_amount,
      NULLIF(v_pay->>'reference','')
    );
  END LOOP;

  -- 6) Cuenta por cobrar automática por la parte fiada
  IF v_credit_total > 0 THEN
    INSERT INTO receivables (
      tenant_id, customer_id, reference, description, amount, currency,
      due_date, status, created_by
    ) VALUES (
      v_tenant, v_customer, v_order,
      'Venta a crédito ' || v_order,
      v_credit_total,
      COALESCE(NULLIF(p_sale->>'currency',''), 'COP'),
      CURRENT_DATE + 30,
      'OPEN', v_creator
    );
  END IF;

  -- 7) Loyalty automático (nunca rompe la venta)
  IF v_status = 'COMPLETED' AND v_customer IS NOT NULL
     AND tenant_module_active(v_tenant, 'loyalty') THEN
    BEGIN
      SELECT * INTO v_cfg FROM loyalty_config
       WHERE tenant_id = v_tenant AND is_active = TRUE;
      IF FOUND AND v_cfg.currency_per_point > 0 THEN
        v_points := FLOOR(COALESCE((p_sale->>'total')::NUMERIC,0) / v_cfg.currency_per_point);
        IF v_points > 0 THEN
          INSERT INTO loyalty_transactions (tenant_id, customer_id, points, kind, note, created_by)
          VALUES (v_tenant, v_customer, v_points, 'EARN', 'Venta ' || v_order, v_creator);
          UPDATE customers
             SET loyalty_points = COALESCE(loyalty_points,0) + v_points,
                 updated_at = now()
           WHERE id = v_customer AND tenant_id = v_tenant;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'loyalty side-effect falló para venta %: %', v_order, SQLERRM;
    END;
  END IF;

  RETURN v_sale_id;
END;
$$;

-- Permisos para la firma nueva (4 parámetros) y la firma anterior (3 parámetros)
-- La firma antigua (3 params) sigue funcionando porque el nuevo parámetro tiene DEFAULT.
GRANT EXECUTE ON FUNCTION create_sale_transaction(JSONB, JSONB, JSONB, BOOLEAN) TO authenticated;
