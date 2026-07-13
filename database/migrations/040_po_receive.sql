-- ============================================================
-- REG-X — Migration 040: Recibir una orden de compra ALIMENTA el sistema
-- ------------------------------------------------------------
-- RPC receive_purchase_order(tenant, po_id):
--   • Entrada de stock por cada ítem con producto (+ stock_movements PURCHASE)
--   • Crea la cuenta por pagar al proveedor (si módulo accounts_payable activo)
--   • Crea lote en product_batches (si módulo batch_tracking activo)
--   • Marca la PO como RECEIVED
-- Todo en UNA transacción. El frontend deja de hacer un simple UPDATE de texto.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION receive_purchase_order(
  p_tenant UUID,
  p_po_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po     RECORD;
  v_item   RECORD;
  v_wh     UUID;
  v_wh_br  UUID;
  v_uid    UUID := auth.uid();
BEGIN
  IF p_tenant IS NULL OR NOT user_belongs_to_tenant(p_tenant) THEN
    RAISE EXCEPTION 'No autorizado para el tenant %', p_tenant USING ERRCODE = '42501';
  END IF;
  IF user_role_in_tenant(p_tenant) NOT IN ('OWNER','ADMIN','MANAGER','ACCOUNTANT') THEN
    RAISE EXCEPTION 'Rol sin permiso para recibir compras' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_po
    FROM purchase_orders
   WHERE id = p_po_id AND tenant_id = p_tenant AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de compra no encontrada';
  END IF;
  IF v_po.status = 'RECEIVED' THEN
    RAISE EXCEPTION 'La orden % ya fue recibida', v_po.code;
  END IF;
  IF v_po.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'La orden % está cancelada', v_po.code;
  END IF;

  -- Almacén destino: default del branch de la PO, o cualquiera del tenant
  SELECT id, branch_id INTO v_wh, v_wh_br
    FROM warehouses
   WHERE tenant_id = p_tenant
     AND is_active = TRUE
     AND (v_po.branch_id IS NULL OR branch_id = v_po.branch_id)
   ORDER BY is_default DESC
   LIMIT 1;

  -- 1) Entrada de stock por ítem
  FOR v_item IN
    SELECT * FROM purchase_order_items
     WHERE purchase_order_id = p_po_id AND tenant_id = p_tenant
       AND product_id IS NOT NULL AND quantity > 0
  LOOP
    IF v_wh IS NOT NULL THEN
      UPDATE inventory
         SET quantity = quantity + v_item.quantity,
             updated_at = now()
       WHERE tenant_id = p_tenant
         AND warehouse_id = v_wh
         AND product_id = v_item.product_id
         AND variant_id IS NULL;

      IF NOT FOUND THEN
        INSERT INTO inventory (tenant_id, branch_id, warehouse_id, product_id, variant_id, quantity)
        VALUES (p_tenant, v_wh_br, v_wh, v_item.product_id, NULL, v_item.quantity);
      END IF;

      INSERT INTO stock_movements (
        tenant_id, branch_id, warehouse_id, product_id, variant_id,
        type, quantity, unit_cost, reference_type, reference_id, notes, created_by
      ) VALUES (
        p_tenant, v_wh_br, v_wh, v_item.product_id, NULL,
        'PURCHASE', v_item.quantity, v_item.unit_cost,
        'PURCHASE_ORDER', p_po_id, 'Compra ' || v_po.code, v_uid
      );

      -- Actualizar costo del producto con el último costo de compra
      UPDATE products
         SET cost_price = v_item.unit_cost, updated_at = now()
       WHERE id = v_item.product_id AND tenant_id = p_tenant
         AND v_item.unit_cost > 0;
    END IF;

    -- 2) Lote automático (si el módulo está activo)
    IF tenant_module_active(p_tenant, 'batch_tracking') THEN
      INSERT INTO product_batches (
        tenant_id, product_id, supplier_id, batch_number,
        quantity, cost, received_at, notes, created_by
      ) VALUES (
        p_tenant, v_item.product_id, v_po.supplier_id,
        v_po.code || '-' || LEFT(v_item.id::TEXT, 8),
        v_item.quantity, v_item.unit_cost, CURRENT_DATE,
        'Recepción automática de ' || v_po.code, v_uid
      );
    END IF;
  END LOOP;

  -- 3) Cuenta por pagar automática al proveedor
  IF v_po.total > 0 AND tenant_module_active(p_tenant, 'accounts_payable') THEN
    INSERT INTO payables (
      tenant_id, supplier_id, reference, description, amount, currency,
      due_date, status, created_by
    ) VALUES (
      p_tenant, v_po.supplier_id, v_po.code,
      'Compra ' || v_po.code,
      v_po.total, v_po.currency,
      COALESCE(v_po.expected_date, CURRENT_DATE + 30),
      'OPEN', v_uid
    );
  END IF;

  -- 4) Marcar como recibida
  UPDATE purchase_orders
     SET status = 'RECEIVED', updated_at = now()
   WHERE id = p_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION receive_purchase_order(UUID, UUID) TO authenticated;
