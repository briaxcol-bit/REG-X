-- ============================================================
-- REG-X — Migration 062: números de orden consecutivos por tenant
-- ------------------------------------------------------------
-- Antes: el número lo generaba el navegador con la hora en base 36
-- ("ORD-MS2JM3RE"). Ilegible para el cliente y sin orden aparente.
--
-- Ahora: el SERVIDOR asigna un consecutivo por tenant (1, 2, 3, …).
-- Es atómico (dos cajas cobrando a la vez nunca repiten número) y
-- arranca desde el mayor número que ya exista en el tenant.
--
-- Idempotencia offline: hasta hoy dependía de que el cliente enviara
-- un order_number fijo en cada reintento. Como ahora el número lo pone
-- el servidor, se agrega la columna `client_ref`: un identificador
-- local de la venta encolada, único por tenant. Si un reintento llega
-- dos veces, el segundo falla con 23505 y el POS lo trata como "ya
-- sincronizada" — exactamente el mismo comportamiento de antes.
--
-- Idempotente. Ejecutar después de la 061.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) Contador por tenant
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_counters (
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL,              -- 'order_number'
  last_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, scope)
);

ALTER TABLE public.tenant_counters ENABLE ROW LEVEL SECURITY;

-- Solo se toca desde funciones SECURITY DEFINER; lectura para el tenant.
DROP POLICY IF EXISTS "tenant_counters_select" ON public.tenant_counters;
CREATE POLICY "tenant_counters_select" ON public.tenant_counters
  FOR SELECT USING (
    (SELECT is_super_admin())
    OR tenant_id IN (SELECT unnest(get_user_tenant_ids()))
  );

-- Semilla: arrancar del mayor consecutivo numérico ya existente por tenant
-- (los números viejos tipo "ORD-XXXX" se ignoran: no son numéricos).
INSERT INTO public.tenant_counters (tenant_id, scope, last_value)
SELECT s.tenant_id, 'order_number',
       COALESCE(MAX((regexp_replace(s.order_number, '\D', '', 'g'))::BIGINT)
                FILTER (WHERE s.order_number ~ '^[0-9]+$'), 0)
  FROM public.sales s
 GROUP BY s.tenant_id
ON CONFLICT (tenant_id, scope) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2) next_order_number: consecutivo atómico
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_order_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  INSERT INTO public.tenant_counters (tenant_id, scope, last_value)
  VALUES (p_tenant_id, 'order_number', 1)
  ON CONFLICT (tenant_id, scope)
  DO UPDATE SET last_value = public.tenant_counters.last_value + 1,
                updated_at = now()
  RETURNING last_value INTO v_next;

  RETURN v_next::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_order_number(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) client_ref: idempotencia de la cola offline
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS client_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_tenant_client_ref
  ON public.sales (tenant_id, client_ref)
  WHERE client_ref IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 4) create_sale_transaction v6
--    = v5 (migración 061, validación de totales) + numeración
--      consecutiva del servidor + client_ref.
--    Si p_sale.order_number viene con valor, se respeta (compatibilidad).
-- ─────────────────────────────────────────────────────────────
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
  v_client_ref TEXT := NULLIF(p_sale->>'client_ref','');
  v_order   TEXT;
  v_sale_id UUID;
  v_wh      UUID;
  v_item    JSONB;
  v_pay     JSONB;
  v_qty     NUMERIC;
  v_new     NUMERIC;
  -- validación de totales
  v_hdr_subtotal  NUMERIC := COALESCE((p_sale->>'subtotal')::NUMERIC, 0);
  v_hdr_tax       NUMERIC := COALESCE((p_sale->>'tax_total')::NUMERIC, 0);
  v_hdr_discount  NUMERIC := COALESCE((p_sale->>'discount_total')::NUMERIC, 0);
  v_hdr_total     NUMERIC := COALESCE((p_sale->>'total')::NUMERIC, 0);
  v_calc_subtotal NUMERIC;
  v_calc_tax      NUMERIC;
  v_calc_discount NUMERIC;
  v_calc_total    NUMERIC;
  v_pay_sum       NUMERIC;
  v_items_ok      BOOLEAN;
  c_tol           CONSTANT NUMERIC := 0.5;
  -- side-effects
  v_method       TEXT;
  v_amount       NUMERIC;
  v_credit_total NUMERIC := 0;
  v_gc           RECORD;
  v_cfg          RECORD;
  v_points       INTEGER;
BEGIN
  -- 1) SEGURIDAD
  IF v_tenant IS NULL OR NOT user_belongs_to_tenant(v_tenant) THEN
    RAISE EXCEPTION 'No autorizado para el tenant %', v_tenant
      USING ERRCODE = '42501';
  END IF;

  -- 1b) VALIDACIÓN DE TOTALES (v5)
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe tener al menos un ítem'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(SUM((i->>'quantity')::NUMERIC * (i->>'unit_price')::NUMERIC), 0),
    COALESCE(SUM(COALESCE((i->>'tax_amount')::NUMERIC, 0)), 0),
    COALESCE(SUM(COALESCE((i->>'discount_amount')::NUMERIC, 0)), 0),
    bool_and(
      (i->>'quantity')::NUMERIC > 0
      AND (i->>'unit_price')::NUMERIC >= 0
      AND COALESCE((i->>'tax_amount')::NUMERIC, 0)      >= 0
      AND COALESCE((i->>'discount_amount')::NUMERIC, 0) >= 0
    )
  INTO v_calc_subtotal, v_calc_tax, v_calc_discount, v_items_ok
  FROM jsonb_array_elements(p_items) AS i;

  IF NOT v_items_ok THEN
    RAISE EXCEPTION 'Ítems inválidos: cantidad debe ser > 0 y montos >= 0'
      USING ERRCODE = '23514';
  END IF;

  v_calc_total := GREATEST(0, v_calc_subtotal + v_calc_tax - v_calc_discount);

  IF abs(v_hdr_subtotal - v_calc_subtotal) > c_tol
     OR abs(v_hdr_tax      - v_calc_tax)      > c_tol
     OR abs(v_hdr_discount - v_calc_discount) > c_tol
     OR abs(v_hdr_total    - v_calc_total)    > c_tol THEN
    RAISE EXCEPTION
      'Totales inconsistentes: enviado (sub %, imp %, desc %, total %) vs calculado (sub %, imp %, desc %, total %)',
      v_hdr_subtotal, v_hdr_tax, v_hdr_discount, v_hdr_total,
      v_calc_subtotal, v_calc_tax, v_calc_discount, v_calc_total
      USING ERRCODE = '23514';
  END IF;

  IF v_status = 'COMPLETED'
     AND p_payments IS NOT NULL
     AND jsonb_typeof(p_payments) = 'array'
     AND jsonb_array_length(p_payments) > 0 THEN
    SELECT COALESCE(SUM((p->>'amount')::NUMERIC), 0)
      INTO v_pay_sum
      FROM jsonb_array_elements(p_payments) AS p;
    IF v_pay_sum < v_hdr_total - c_tol THEN
      RAISE EXCEPTION 'Pagos (%) no cubren el total de la venta (%)',
        v_pay_sum, v_hdr_total
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 1c) NÚMERO DE ORDEN: consecutivo del servidor salvo que venga uno explícito
  v_order := COALESCE(
    NULLIF(p_sale->>'order_number',''),
    public.next_order_number(v_tenant)
  );

  -- 2) Insertar la venta
  v_sale_id := gen_random_uuid();
  INSERT INTO sales (
    id, tenant_id, branch_id, cash_register_id, customer_id, order_number,
    client_ref, subtotal, tax_total, discount_total, total, currency, status,
    notes, completed_at, created_by, completed_by
  ) VALUES (
    v_sale_id, v_tenant, v_branch,
    NULLIF(p_sale->>'cash_register_id','')::UUID,
    v_customer,
    v_order,
    v_client_ref,
    v_hdr_subtotal,
    v_hdr_tax,
    v_hdr_discount,
    v_hdr_total,
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

    IF v_amount < 0 THEN
      RAISE EXCEPTION 'Monto de pago negativo no permitido'
        USING ERRCODE = '23514';
    END IF;

    IF v_method = 'CREDIT' THEN
      IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Una venta a crédito (fiado) requiere un cliente asignado'
          USING ERRCODE = '23514';
      END IF;
      v_credit_total := v_credit_total + v_amount;
    END IF;

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
        v_points := FLOOR(v_hdr_total / v_cfg.currency_per_point);
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

GRANT EXECUTE ON FUNCTION create_sale_transaction(JSONB, JSONB, JSONB, BOOLEAN) TO authenticated;
