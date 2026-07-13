-- ============================================================
-- REG-X — Migration 041: Contabilidad que se alimenta sola
-- ------------------------------------------------------------
-- 1. seed_default_accounts(tenant): plan de cuentas mínimo.
-- 2. post_journal(...): asienta partida doble validada, SOLO si el
--    tenant tiene el módulo 'accounting' activo. Idempotente por
--    referencia (no duplica asientos).
-- 3. Triggers automáticos (nunca rompen la operación origen):
--    • Venta COMPLETED      -> Caja/Bancos/CxC/GiftCard vs Ventas + IVA
--    • Gasto                -> Gastos (o Nómina) vs Caja/Bancos
--    • Abono de CxC         -> Caja/Bancos vs CxC
--    • Pago de CxP          -> CxP vs Caja/Bancos
--    • CxP nueva            -> Inventario (compras) o Gastos vs CxP
--    • Cierre de caja       -> Diferencias de caja (descuadre)
--    • Gift card emitida    -> Caja vs Pasivo gift cards
--    • Nómina pagada        -> crea el GASTO (categoría Nómina); el
--      trigger de gastos hace el asiento. Nómina aparece en expenses.
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) PLAN DE CUENTAS SEMILLA
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION seed_default_accounts(p_tenant UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO accounts (tenant_id, code, name, type) VALUES
    (p_tenant, '1100', 'Caja',                    'ASSET'),
    (p_tenant, '1110', 'Bancos',                  'ASSET'),
    (p_tenant, '1300', 'Cuentas por Cobrar',      'ASSET'),
    (p_tenant, '1400', 'Inventario',              'ASSET'),
    (p_tenant, '2100', 'Cuentas por Pagar',       'LIABILITY'),
    (p_tenant, '2400', 'Impuestos por Pagar',     'LIABILITY'),
    (p_tenant, '2500', 'Gift Cards por Redimir',  'LIABILITY'),
    (p_tenant, '3100', 'Capital',                 'EQUITY'),
    (p_tenant, '4100', 'Ventas',                  'INCOME'),
    (p_tenant, '4200', 'Otros Ingresos',          'INCOME'),
    (p_tenant, '5100', 'Gastos Operativos',       'EXPENSE'),
    (p_tenant, '5200', 'Nómina',                  'EXPENSE'),
    (p_tenant, '5300', 'Diferencias de Caja',     'EXPENSE')
  ON CONFLICT (tenant_id, code) DO NOTHING;
$$;
GRANT EXECUTE ON FUNCTION seed_default_accounts(UUID) TO authenticated;

-- Cuenta por código (siembra el plan si falta)
CREATE OR REPLACE FUNCTION journal_account(p_tenant UUID, p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM accounts WHERE tenant_id = p_tenant AND code = p_code;
  IF v_id IS NULL THEN
    PERFORM seed_default_accounts(p_tenant);
    SELECT id INTO v_id FROM accounts WHERE tenant_id = p_tenant AND code = p_code;
  END IF;
  RETURN v_id;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 2) POST_JOURNAL — partida doble validada e idempotente
--    p_lines: [{"code":"1100","debit":100,"credit":0}, ...]
--    (Sin GRANT a authenticated: solo la invocan los triggers.)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION post_journal(
  p_tenant      UUID,
  p_date        DATE,
  p_reference   TEXT,
  p_description TEXT,
  p_lines       JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry   UUID;
  v_line    JSONB;
  v_debits  NUMERIC := 0;
  v_credits NUMERIC := 0;
  v_acct    UUID;
BEGIN
  -- Solo si el módulo de contabilidad está activo
  IF NOT tenant_module_active(p_tenant, 'accounting') THEN
    RETURN NULL;
  END IF;

  -- Idempotencia por referencia
  IF p_reference IS NOT NULL AND EXISTS (
    SELECT 1 FROM journal_entries WHERE tenant_id = p_tenant AND reference = p_reference
  ) THEN
    RETURN NULL;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_debits  := v_debits  + COALESCE((v_line->>'debit')::NUMERIC, 0);
    v_credits := v_credits + COALESCE((v_line->>'credit')::NUMERIC, 0);
  END LOOP;

  IF ROUND(v_debits, 2) <> ROUND(v_credits, 2) OR v_debits = 0 THEN
    RAISE EXCEPTION 'Asiento desbalanceado: débitos % vs créditos %', v_debits, v_credits;
  END IF;

  INSERT INTO journal_entries (tenant_id, entry_date, reference, description, created_by)
  VALUES (p_tenant, COALESCE(p_date, CURRENT_DATE), p_reference, p_description, auth.uid())
  RETURNING id INTO v_entry;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF COALESCE((v_line->>'debit')::NUMERIC,0) = 0 AND COALESCE((v_line->>'credit')::NUMERIC,0) = 0 THEN
      CONTINUE;
    END IF;
    v_acct := journal_account(p_tenant, v_line->>'code');
    IF v_acct IS NULL THEN
      RAISE EXCEPTION 'Cuenta % no existe para el tenant', v_line->>'code';
    END IF;
    INSERT INTO journal_lines (tenant_id, journal_entry_id, account_id, debit, credit)
    VALUES (
      p_tenant, v_entry, v_acct,
      COALESCE((v_line->>'debit')::NUMERIC, 0),
      COALESCE((v_line->>'credit')::NUMERIC, 0)
    );
  END LOOP;

  RETURN v_entry;
END;
$$;

-- Helper: cuenta contable según método de pago
CREATE OR REPLACE FUNCTION payment_account_code(p_method TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE UPPER(COALESCE(p_method,'CASH'))
    WHEN 'CASH'      THEN '1100'
    WHEN 'CARD'      THEN '1110'
    WHEN 'TRANSFER'  THEN '1110'
    WHEN 'QR'        THEN '1110'
    WHEN 'CREDIT'    THEN '1300'
    WHEN 'GIFT_CARD' THEN '2500'
    ELSE '1100'
  END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 3) TRIGGERS
-- ══════════════════════════════════════════════════════════════

-- ── 3a) VENTA COMPLETED → asiento (diferido a COMMIT para ver pagos) ──
CREATE OR REPLACE FUNCTION trg_journal_sale()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lines   JSONB := '[]'::JSONB;
  v_pay     RECORD;
  v_paid    NUMERIC := 0;
  v_revenue NUMERIC;
BEGIN
  IF NEW.status <> 'COMPLETED' THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'COMPLETED' THEN RETURN NULL; END IF;

  BEGIN
    -- Débitos: un renglón por método de pago
    FOR v_pay IN
      SELECT payment_account_code(method::TEXT) AS code, SUM(amount) AS amt
        FROM sale_payments WHERE sale_id = NEW.id GROUP BY 1
    LOOP
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('code', v_pay.code, 'debit', v_pay.amt, 'credit', 0));
      v_paid  := v_paid + v_pay.amt;
    END LOOP;

    -- Venta sin pagos registrados: se asume caja
    IF v_paid = 0 AND NEW.total > 0 THEN
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('code','1100','debit',NEW.total,'credit',0));
      v_paid  := NEW.total;
    END IF;

    -- Créditos: Ventas + IVA (ajuste a caja si los pagos no cuadran con el total)
    v_revenue := v_paid - COALESCE(NEW.tax_total, 0);
    IF v_revenue < 0 THEN v_revenue := v_paid; END IF;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('code','4100','debit',0,'credit', v_revenue)
    );
    IF COALESCE(NEW.tax_total,0) > 0 AND v_paid >= NEW.tax_total THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('code','2400','debit',0,'credit', NEW.tax_total)
      );
    END IF;

    PERFORM post_journal(
      NEW.tenant_id,
      COALESCE(NEW.completed_at, now())::DATE,
      'SALE ' || NEW.order_number,
      'Venta ' || NEW.order_number,
      v_lines
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asiento de venta % falló: %', NEW.order_number, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_sale_ins ON sales;
CREATE CONSTRAINT TRIGGER trg_journal_sale_ins
  AFTER INSERT ON sales
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_journal_sale();

DROP TRIGGER IF EXISTS trg_journal_sale_upd ON sales;
CREATE CONSTRAINT TRIGGER trg_journal_sale_upd
  AFTER UPDATE ON sales
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_journal_sale();

-- ── 3b) GASTO → asiento ───────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_journal_expense()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exp_code TEXT;
  v_pay_code TEXT;
BEGIN
  BEGIN
    IF NEW.amount <= 0 THEN RETURN NULL; END IF;
    v_exp_code := CASE WHEN LOWER(NEW.category) IN ('nómina','nomina','payroll') THEN '5200' ELSE '5100' END;
    v_pay_code := payment_account_code(NEW.payment_method);
    IF v_pay_code IN ('1300','2500') THEN v_pay_code := '1100'; END IF;

    PERFORM post_journal(
      NEW.tenant_id, NEW.expense_date,
      'EXP ' || NEW.id,
      'Gasto: ' || COALESCE(NEW.description, NEW.category),
      jsonb_build_array(
        jsonb_build_object('code', v_exp_code, 'debit', NEW.amount, 'credit', 0),
        jsonb_build_object('code', v_pay_code, 'debit', 0, 'credit', NEW.amount)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asiento de gasto falló: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_expense ON expenses;
CREATE TRIGGER trg_journal_expense
  AFTER INSERT ON expenses
  FOR EACH ROW EXECUTE FUNCTION trg_journal_expense();

-- ── 3c) ABONO DE CxC → asiento ────────────────────────────────
CREATE OR REPLACE FUNCTION trg_journal_recv_payment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT;
BEGIN
  BEGIN
    IF NEW.amount <= 0 THEN RETURN NULL; END IF;
    v_code := payment_account_code(NEW.method);
    IF v_code IN ('1300','2500') THEN v_code := '1100'; END IF;
    PERFORM post_journal(
      NEW.tenant_id, NEW.paid_at::DATE,
      'RCVP ' || NEW.id,
      'Abono cuenta por cobrar',
      jsonb_build_array(
        jsonb_build_object('code', v_code, 'debit', NEW.amount, 'credit', 0),
        jsonb_build_object('code', '1300', 'debit', 0, 'credit', NEW.amount)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asiento de abono CxC falló: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_recv_payment ON receivable_payments;
CREATE TRIGGER trg_journal_recv_payment
  AFTER INSERT ON receivable_payments
  FOR EACH ROW EXECUTE FUNCTION trg_journal_recv_payment();

-- ── 3d) CxP NUEVA y PAGO DE CxP → asientos ────────────────────
CREATE OR REPLACE FUNCTION trg_journal_payable()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_debit_code TEXT;
BEGIN
  BEGIN
    IF NEW.amount <= 0 THEN RETURN NULL; END IF;
    -- Compras de mercancía van a Inventario; el resto a Gastos
    v_debit_code := CASE WHEN NEW.description ILIKE 'compra %' THEN '1400' ELSE '5100' END;
    PERFORM post_journal(
      NEW.tenant_id, NEW.created_at::DATE,
      'PAYB ' || NEW.id,
      COALESCE(NEW.description, 'Cuenta por pagar'),
      jsonb_build_array(
        jsonb_build_object('code', v_debit_code, 'debit', NEW.amount, 'credit', 0),
        jsonb_build_object('code', '2100', 'debit', 0, 'credit', NEW.amount)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asiento de CxP falló: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_payable ON payables;
CREATE TRIGGER trg_journal_payable
  AFTER INSERT ON payables
  FOR EACH ROW EXECUTE FUNCTION trg_journal_payable();

CREATE OR REPLACE FUNCTION trg_journal_pay_payment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT;
BEGIN
  BEGIN
    IF NEW.amount <= 0 THEN RETURN NULL; END IF;
    v_code := payment_account_code(NEW.method);
    IF v_code IN ('1300','2500') THEN v_code := '1100'; END IF;
    PERFORM post_journal(
      NEW.tenant_id, NEW.paid_at::DATE,
      'PAYP ' || NEW.id,
      'Pago a proveedor',
      jsonb_build_array(
        jsonb_build_object('code', '2100', 'debit', NEW.amount, 'credit', 0),
        jsonb_build_object('code', v_code, 'debit', 0, 'credit', NEW.amount)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asiento de pago CxP falló: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_pay_payment ON payable_payments;
CREATE TRIGGER trg_journal_pay_payment
  AFTER INSERT ON payable_payments
  FOR EACH ROW EXECUTE FUNCTION trg_journal_pay_payment();

-- ── 3e) CIERRE DE CAJA → descuadre a resultados ───────────────
CREATE OR REPLACE FUNCTION trg_journal_register_close()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status::TEXT <> 'CLOSED' OR OLD.status::TEXT = 'CLOSED' THEN RETURN NULL; END IF;
    IF COALESCE(NEW.cash_difference, 0) = 0 THEN RETURN NULL; END IF;

    IF NEW.cash_difference < 0 THEN
      -- Faltante: gasto por diferencia
      PERFORM post_journal(
        NEW.tenant_id, now()::DATE,
        'REGCLOSE ' || NEW.id,
        'Descuadre de caja (faltante): ' || NEW.name,
        jsonb_build_array(
          jsonb_build_object('code','5300','debit', ABS(NEW.cash_difference), 'credit', 0),
          jsonb_build_object('code','1100','debit', 0, 'credit', ABS(NEW.cash_difference))
        )
      );
    ELSE
      -- Sobrante: otros ingresos
      PERFORM post_journal(
        NEW.tenant_id, now()::DATE,
        'REGCLOSE ' || NEW.id,
        'Descuadre de caja (sobrante): ' || NEW.name,
        jsonb_build_array(
          jsonb_build_object('code','1100','debit', NEW.cash_difference, 'credit', 0),
          jsonb_build_object('code','4200','debit', 0, 'credit', NEW.cash_difference)
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asiento de cierre de caja falló: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_register_close ON cash_registers;
CREATE TRIGGER trg_journal_register_close
  AFTER UPDATE ON cash_registers
  FOR EACH ROW EXECUTE FUNCTION trg_journal_register_close();

-- ── 3f) GIFT CARD EMITIDA → pasivo ────────────────────────────
CREATE OR REPLACE FUNCTION trg_journal_gift_card()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.type <> 'ISSUE' OR NEW.amount <= 0 THEN RETURN NULL; END IF;
    PERFORM post_journal(
      NEW.tenant_id, NEW.created_at::DATE,
      'GCISS ' || NEW.id,
      'Emisión de gift card',
      jsonb_build_array(
        jsonb_build_object('code','1100','debit', NEW.amount, 'credit', 0),
        jsonb_build_object('code','2500','debit', 0, 'credit', NEW.amount)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asiento de gift card falló: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_gift_card ON gift_card_transactions;
CREATE TRIGGER trg_journal_gift_card
  AFTER INSERT ON gift_card_transactions
  FOR EACH ROW EXECUTE FUNCTION trg_journal_gift_card();

-- ── 3g) NÓMINA PAGADA → gasto automático (y de ahí, el asiento) ──
CREATE OR REPLACE FUNCTION trg_payroll_paid_expense()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status <> 'PAID' OR OLD.status = 'PAID' THEN RETURN NULL; END IF;
    IF NEW.net_pay <= 0 THEN RETURN NULL; END IF;

    INSERT INTO expenses (
      tenant_id, category, description, amount, currency,
      expense_date, payment_method, reference, created_by
    ) VALUES (
      NEW.tenant_id, 'Nómina',
      'Nómina ' || NEW.period_label || ' — ' || NEW.employee_name,
      NEW.net_pay, 'COP',
      COALESCE(NEW.paid_at, now())::DATE, 'TRANSFER',
      'PAYROLL ' || NEW.id, auth.uid()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'gasto automático de nómina falló: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_paid_expense ON payroll_entries;
CREATE TRIGGER trg_payroll_paid_expense
  AFTER UPDATE ON payroll_entries
  FOR EACH ROW EXECUTE FUNCTION trg_payroll_paid_expense();
