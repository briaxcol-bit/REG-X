-- ─────────────────────────────────────────────────────────────
-- 016 · POS Terminals (puntos de venta adicionales)
-- Permite al dueño/admin habilitar terminales secundarias con
-- cajero asignado, modo (facturar vs solo comandas) y categorías
-- permitidas.
-- ─────────────────────────────────────────────────────────────

-- ── Tabla ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_terminals (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id            UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,                          -- ej. "Caja 2", "Bar"
  cashier_id           UUID        REFERENCES auth.users(id),         -- empleado asignado
  mode                 TEXT        NOT NULL DEFAULT 'FULL'
                       CHECK (mode IN ('FULL', 'COMMANDS_ONLY')),    -- FULL=factura, COMMANDS_ONLY=comanda
  allowed_category_ids UUID[]      DEFAULT NULL,                     -- NULL = todas las categorías
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  notes                TEXT,
  created_by           UUID        REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pos_terminals_tenant   ON public.pos_terminals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_terminals_branch   ON public.pos_terminals(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_terminals_cashier  ON public.pos_terminals(cashier_id);

-- Updated_at automático
CREATE OR REPLACE FUNCTION public.set_pos_terminals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_pos_terminals_updated_at ON public.pos_terminals;
CREATE TRIGGER trg_pos_terminals_updated_at
  BEFORE UPDATE ON public.pos_terminals
  FOR EACH ROW EXECUTE FUNCTION public.set_pos_terminals_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.pos_terminals ENABLE ROW LEVEL SECURITY;

-- SELECT: miembros del tenant ven sus terminales
CREATE POLICY "pos_terminals_select"
  ON public.pos_terminals FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

-- INSERT: solo OWNER / ADMIN
CREATE POLICY "pos_terminals_insert"
  ON public.pos_terminals FOR INSERT
  WITH CHECK (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
  );

-- UPDATE: solo OWNER / ADMIN
CREATE POLICY "pos_terminals_update"
  ON public.pos_terminals FOR UPDATE
  USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
  );

-- DELETE: solo OWNER / ADMIN
CREATE POLICY "pos_terminals_delete"
  ON public.pos_terminals FOR DELETE
  USING (
    user_belongs_to_tenant(tenant_id) AND
    user_role_in_tenant(tenant_id) IN ('OWNER', 'ADMIN')
  );

-- ── RPC: terminal del cajero actual ───────────────────────────
-- Devuelve la configuración activa del usuario autenticado en la sucursal.
CREATE OR REPLACE FUNCTION public.get_my_pos_terminal(
  p_tenant_id UUID,
  p_branch_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT to_jsonb(t) INTO v_result
  FROM pos_terminals t
  WHERE t.tenant_id = p_tenant_id
    AND t.branch_id = p_branch_id
    AND t.cashier_id = auth.uid()
    AND t.is_active = true
  LIMIT 1;

  RETURN v_result;   -- NULL si no hay terminal asignada (acceso completo)
END;
$$;
