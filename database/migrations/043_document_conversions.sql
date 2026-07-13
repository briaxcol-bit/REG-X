-- ============================================================
-- REG-X — Migration 043: Los documentos cierran su ciclo
-- ------------------------------------------------------------
-- 1. convert_quote_to_sale(tenant, quote)  : cotización ACEPTADA → venta
--    PENDING en el POS (se cobra allí). Marca la quote CONVERTED.
-- 2. complete_layaway(tenant, layaway)     : apartado totalmente abonado →
--    venta COMPLETED real (descuenta stock). Marca el layaway COMPLETED.
-- 3. invoice_work_order(tenant, wo)        : orden de trabajo terminada →
--    venta PENDING para cobrar. Marca la orden DELIVERED.
-- 4. Outbox de webhooks: venta completada y PO recibida encolan entrega
--    en webhook_deliveries (las URLs por fin reciben eventos).
-- Ítems sin producto (p.ej. mano de obra) usan el producto de servicio
-- genérico SVC-GEN (sin inventario), creado on-demand por tenant.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ── Producto de servicio genérico (para ítems sin product_id) ──
CREATE OR REPLACE FUNCTION get_or_create_service_product(p_tenant UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM products
   WHERE tenant_id = p_tenant AND sku = 'SVC-GEN' AND deleted_at IS NULL;
  IF v_id IS NULL THEN
    INSERT INTO products (tenant_id, sku, name, description, price, track_inventory, status)
    VALUES (p_tenant, 'SVC-GEN', 'Servicio / Mano de obra',
            'Producto genérico para ítems de servicio (creado automáticamente)',
            0, FALSE, 'ACTIVE')
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- ── Helper interno: arma el JSON de ítems de venta ────────────
CREATE OR REPLACE FUNCTION _items_to_sale_json(
  p_tenant UUID,
  p_rows   JSONB  -- [{product_id, description, quantity, unit_price, total}]
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_out  JSONB := '[]'::JSONB;
  v_r    JSONB;
  v_pid  UUID;
  v_sku  TEXT;
BEGIN
  FOR v_r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_pid := NULLIF(v_r->>'product_id','')::UUID;
    IF v_pid IS NULL THEN
      v_pid := get_or_create_service_product(p_tenant);
    END IF;
    SELECT sku INTO v_sku FROM products WHERE id = v_pid AND tenant_id = p_tenant;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'product_id',      v_pid,
      'sku',             COALESCE(v_sku, 'SVC-GEN'),
      'name',            v_r->>'description',
      'quantity',        COALESCE((v_r->>'quantity')::NUMERIC, 1),
      'unit_price',      COALESCE((v_r->>'unit_price')::NUMERIC, 0),
      'discount',        0, 'discount_amount', 0, 'tax', 0, 'tax_amount', 0,
      'total',           COALESCE((v_r->>'total')::NUMERIC, 0)
    ));
  END LOOP;
  RETURN v_out;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 1) COTIZACIÓN → VENTA (PENDING, se cobra en el POS)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION convert_quote_to_sale(p_tenant UUID, p_quote_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q     RECORD;
  v_items JSONB;
  v_sale  UUID;
BEGIN
  IF p_tenant IS NULL OR NOT user_belongs_to_tenant(p_tenant) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_q FROM quotes
   WHERE id = p_quote_id AND tenant_id = p_tenant AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_q.status = 'CONVERTED' THEN RAISE EXCEPTION 'La cotización % ya fue convertida', v_q.code; END IF;
  IF v_q.status NOT IN ('SENT','ACCEPTED','DRAFT') THEN
    RAISE EXCEPTION 'La cotización % no se puede convertir (estado %)', v_q.code, v_q.status;
  END IF;

  SELECT _items_to_sale_json(p_tenant, COALESCE(jsonb_agg(jsonb_build_object(
           'product_id', qi.product_id, 'description', qi.description,
           'quantity', qi.quantity, 'unit_price', qi.unit_price, 'total', qi.total
         )), '[]'::JSONB))
    INTO v_items
    FROM quote_items qi WHERE qi.quote_id = p_quote_id;

  v_sale := create_sale_transaction(
    jsonb_build_object(
      'tenant_id', p_tenant, 'branch_id', v_q.branch_id,
      'customer_id', v_q.customer_id,
      'order_number', 'ORD-' || v_q.code,
      'subtotal', v_q.total, 'tax_total', 0, 'discount_total', 0,
      'total', v_q.total, 'currency', v_q.currency,
      'status', 'PENDING',
      'notes', 'Origen: cotización ' || v_q.code,
      'created_by', auth.uid()
    ),
    v_items,
    '[]'::JSONB
  );

  UPDATE quotes SET status = 'CONVERTED', updated_at = now() WHERE id = p_quote_id;
  RETURN v_sale;
END;
$$;
GRANT EXECUTE ON FUNCTION convert_quote_to_sale(UUID, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 2) APARTADO PAGADO → VENTA COMPLETED
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION complete_layaway(p_tenant UUID, p_layaway_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_l     RECORD;
  v_items JSONB;
  v_sale  UUID;
BEGIN
  IF p_tenant IS NULL OR NOT user_belongs_to_tenant(p_tenant) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_l FROM layaways
   WHERE id = p_layaway_id AND tenant_id = p_tenant AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Apartado no encontrado'; END IF;
  IF v_l.status <> 'OPEN' THEN RAISE EXCEPTION 'El apartado % no está abierto', v_l.code; END IF;
  IF v_l.paid < v_l.total THEN
    RAISE EXCEPTION 'El apartado % aún debe %', v_l.code, (v_l.total - v_l.paid);
  END IF;

  SELECT _items_to_sale_json(p_tenant, COALESCE(jsonb_agg(jsonb_build_object(
           'product_id', li.product_id, 'description', li.description,
           'quantity', li.quantity, 'unit_price', li.unit_price, 'total', li.total
         )), '[]'::JSONB))
    INTO v_items
    FROM layaway_items li WHERE li.layaway_id = p_layaway_id;

  v_sale := create_sale_transaction(
    jsonb_build_object(
      'tenant_id', p_tenant, 'branch_id', v_l.branch_id,
      'customer_id', v_l.customer_id,
      'order_number', 'ORD-' || v_l.code,
      'subtotal', v_l.total, 'tax_total', 0, 'discount_total', 0,
      'total', v_l.total, 'currency', v_l.currency,
      'status', 'COMPLETED',
      'notes', 'Origen: apartado ' || v_l.code,
      'created_by', auth.uid()
    ),
    v_items,
    jsonb_build_array(jsonb_build_object(
      'method', 'CASH', 'amount', v_l.total, 'reference', 'LAYAWAY ' || v_l.code
    ))
  );

  UPDATE layaways SET status = 'COMPLETED', updated_at = now() WHERE id = p_layaway_id;
  RETURN v_sale;
END;
$$;
GRANT EXECUTE ON FUNCTION complete_layaway(UUID, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3) ORDEN DE TRABAJO → VENTA (PENDING) + DELIVERED
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION invoice_work_order(p_tenant UUID, p_wo_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_w     RECORD;
  v_items JSONB;
  v_sale  UUID;
BEGIN
  IF p_tenant IS NULL OR NOT user_belongs_to_tenant(p_tenant) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_w FROM work_orders
   WHERE id = p_wo_id AND tenant_id = p_tenant AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden de trabajo no encontrada'; END IF;
  IF v_w.status NOT IN ('DONE','IN_PROGRESS') THEN
    RAISE EXCEPTION 'La orden % no se puede facturar (estado %)', v_w.code, v_w.status;
  END IF;

  SELECT _items_to_sale_json(p_tenant, COALESCE(jsonb_agg(jsonb_build_object(
           'product_id', wi.product_id, 'description', wi.description,
           'quantity', wi.quantity, 'unit_price', wi.unit_price, 'total', wi.total
         )), '[]'::JSONB))
    INTO v_items
    FROM work_order_items wi WHERE wi.work_order_id = p_wo_id;

  v_sale := create_sale_transaction(
    jsonb_build_object(
      'tenant_id', p_tenant, 'branch_id', v_w.branch_id,
      'customer_id', v_w.customer_id,
      'order_number', 'ORD-' || v_w.code,
      'subtotal', v_w.total, 'tax_total', 0, 'discount_total', 0,
      'total', v_w.total, 'currency', v_w.currency,
      'status', 'PENDING',
      'notes', 'Origen: orden de trabajo ' || v_w.code || ' — ' || v_w.title,
      'created_by', auth.uid()
    ),
    v_items,
    '[]'::JSONB
  );

  UPDATE work_orders SET status = 'DELIVERED', updated_at = now() WHERE id = p_wo_id;
  RETURN v_sale;
END;
$$;
GRANT EXECUTE ON FUNCTION invoice_work_order(UUID, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 4) OUTBOX DE WEBHOOKS
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE OR REPLACE FUNCTION enqueue_webhook_event(
  p_tenant  UUID,
  p_event   TEXT,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ep RECORD;
BEGIN
  IF NOT tenant_module_active(p_tenant, 'webhooks') THEN RETURN; END IF;
  FOR v_ep IN
    SELECT id FROM webhook_endpoints
     WHERE tenant_id = p_tenant AND active = TRUE
       AND (events = '{}' OR p_event = ANY(events))
  LOOP
    -- Sin duplicados por (endpoint, evento, objeto)
    IF NOT EXISTS (
      SELECT 1 FROM webhook_deliveries
       WHERE endpoint_id = v_ep.id AND event = p_event
         AND payload->>'id' = p_payload->>'id'
    ) THEN
      INSERT INTO webhook_deliveries (endpoint_id, event, status, payload)
      VALUES (v_ep.id, p_event, 'PENDING', p_payload);
    END IF;
  END LOOP;
END;
$$;

-- Venta completada → sale.completed (diferido a COMMIT)
CREATE OR REPLACE FUNCTION trg_webhook_sale()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status <> 'COMPLETED' THEN RETURN NULL; END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'COMPLETED' THEN RETURN NULL; END IF;
    PERFORM enqueue_webhook_event(NEW.tenant_id, 'sale.completed', jsonb_build_object(
      'id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total,
      'currency', NEW.currency, 'customer_id', NEW.customer_id,
      'completed_at', NEW.completed_at
    ));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'webhook sale falló: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_sale_ins ON sales;
CREATE CONSTRAINT TRIGGER trg_webhook_sale_ins
  AFTER INSERT ON sales DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_webhook_sale();

DROP TRIGGER IF EXISTS trg_webhook_sale_upd ON sales;
CREATE CONSTRAINT TRIGGER trg_webhook_sale_upd
  AFTER UPDATE ON sales DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_webhook_sale();

-- PO recibida → purchase_order.received
CREATE OR REPLACE FUNCTION trg_webhook_po()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'RECEIVED' AND OLD.status <> 'RECEIVED' THEN
      PERFORM enqueue_webhook_event(NEW.tenant_id, 'purchase_order.received', jsonb_build_object(
        'id', NEW.id, 'code', NEW.code, 'total', NEW.total, 'supplier_id', NEW.supplier_id
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'webhook po falló: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_po ON purchase_orders;
CREATE TRIGGER trg_webhook_po
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION trg_webhook_po();
