-- ============================================================
-- REG-X — Migration 005: Plataforma / Super Admin
-- ------------------------------------------------------------
-- Da al SUPER_ADMIN la capacidad de:
--   • Crear / editar / activar-desactivar tenants
--   • Gestionar el plan y la suscripción de cada tenant
--   • Crear el usuario OWNER de cada tenant (que luego invita al resto)
--   • Sembrar los roles de negocio del sistema con sus permisos
--
-- Ejecutar en el SQL Editor de Supabase.
-- Reemplaza/extiende a setup-superadmin-rls.sql (idempotente).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- crypt() / gen_salt() para el password del owner

-- ════════════════════════════════════════════════════════════
-- 1) HELPER: ¿el usuario actual es SUPER_ADMIN?
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND platform_role = 'SUPER_ADMIN'
  );
$$;

-- ════════════════════════════════════════════════════════════
-- 2) POLÍTICAS RLS PARA SUPER_ADMIN
--    (se suman a las políticas multi-tenant existentes)
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants', 'branches', 'subscriptions',
    'user_profiles', 'user_tenant_roles',
    'roles', 'role_permissions', 'warehouses'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- Lectura total
    EXECUTE format('DROP POLICY IF EXISTS "super_admin_read_%1$s" ON public.%1$s;', t);
    EXECUTE format(
      'CREATE POLICY "super_admin_read_%1$s" ON public.%1$s
         FOR SELECT USING (public.is_super_admin());', t);

    -- Escritura total (insert / update / delete)
    EXECUTE format('DROP POLICY IF EXISTS "super_admin_write_%1$s" ON public.%1$s;', t);
    EXECUTE format(
      'CREATE POLICY "super_admin_write_%1$s" ON public.%1$s
         FOR ALL USING (public.is_super_admin())
         WITH CHECK (public.is_super_admin());', t);
  END LOOP;
END;
$$;

-- permissions es un catálogo global de solo lectura para todos los autenticados
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions_read_all" ON public.permissions;
CREATE POLICY "permissions_read_all" ON public.permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- 3) SEMBRAR ROLES DE NEGOCIO (sistema) + PERMISOS POR TENANT
--    Crea filas en roles/role_permissions para un tenant nuevo.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.seed_tenant_roles(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r            RECORD;
  v_role_id    UUID;
  -- Mapa rol -> permisos. '*' = todos los permisos.
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
    "BARTENDER":         ["sales.create","kitchen.view","kitchen.update"],
    "ACCOUNTANT":        ["reports.view","reports.export","inventory.view","cash.view","sales.view"],
    "INVENTORY_MANAGER": ["inventory.view","inventory.update","inventory.transfer",
                          "products.view","products.create","products.edit"]
  }'::jsonb;
BEGIN
  FOR r IN SELECT key AS role_name, value AS perms FROM jsonb_each(role_map)
  LOOP
    -- upsert del rol de sistema para el tenant
    INSERT INTO public.roles (tenant_id, name, description, is_system)
    VALUES (p_tenant_id, r.role_name, 'Rol de sistema', TRUE)
    ON CONFLICT (tenant_id, name) DO UPDATE SET is_system = TRUE
    RETURNING id INTO v_role_id;

    IF v_role_id IS NULL THEN
      SELECT id INTO v_role_id FROM public.roles
       WHERE tenant_id = p_tenant_id AND name = r.role_name;
    END IF;

    -- limpiar permisos previos del rol
    DELETE FROM public.role_permissions WHERE role_id = v_role_id;

    IF r.perms ? '*' THEN
      -- todos los permisos
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, p.id FROM public.permissions p
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, p.id
        FROM public.permissions p
       WHERE p.permission_key IN (
         SELECT jsonb_array_elements_text(r.perms)
       )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 4) CREAR TENANT + OWNER (operación atómica)
--    Solo ejecutable por un SUPER_ADMIN autenticado.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
  p_name           TEXT,
  p_slug           TEXT,
  p_business_type  TEXT,
  p_plan           TEXT,
  p_country        TEXT,
  p_currency       TEXT,
  p_owner_email    TEXT,
  p_owner_name     TEXT,
  p_owner_password TEXT,
  p_timezone       TEXT DEFAULT 'America/Bogota',
  p_locale         TEXT DEFAULT 'es-CO'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_tenant   UUID := uuid_generate_v4();
  v_branch   UUID := uuid_generate_v4();
  v_owner    UUID;
  v_now      TIMESTAMPTZ := now();
BEGIN
  -- ── Seguridad: solo SUPER_ADMIN ─────────────────────────
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede crear tenants';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'El slug "%" ya existe', p_slug;
  END IF;

  -- ── 1. Tenant ───────────────────────────────────────────
  INSERT INTO public.tenants (
    id, name, slug, business_type, plan, country, currency,
    timezone, locale, is_active, created_by
  ) VALUES (
    v_tenant, p_name, p_slug, p_business_type::business_type, p_plan::subscription_plan,
    p_country, p_currency, p_timezone, p_locale, TRUE, v_caller
  );

  -- ── 2. Sucursal principal ───────────────────────────────
  INSERT INTO public.branches (
    id, tenant_id, name, code, is_main, is_active, currency, timezone, created_by
  ) VALUES (
    v_branch, v_tenant, 'Sucursal Principal', 'MAIN', TRUE, TRUE, p_currency, p_timezone, v_caller
  );

  -- ── 3. Bodega por defecto ───────────────────────────────
  INSERT INTO public.warehouses (tenant_id, branch_id, name, code, is_default, created_by)
  VALUES (v_tenant, v_branch, 'Bodega Principal', 'MAIN', TRUE, v_caller);

  -- ── 4. Suscripción (trial 30 días) ──────────────────────
  INSERT INTO public.subscriptions (
    tenant_id, plan, status, billing_cycle, price, currency,
    trial_ends_at, current_period_start, current_period_end, created_by
  ) VALUES (
    v_tenant, p_plan::subscription_plan, 'TRIAL', 'MONTHLY', 0, p_currency,
    v_now + INTERVAL '30 days', v_now, v_now + INTERVAL '30 days', v_caller
  );

  -- ── 5. Roles de negocio + permisos ──────────────────────
  PERFORM public.seed_tenant_roles(v_tenant);

  -- ── 6. Usuario OWNER ────────────────────────────────────
  -- Reutiliza el usuario si el email ya existe en Supabase Auth.
  SELECT id INTO v_owner FROM auth.users WHERE email = lower(p_owner_email);

  IF v_owner IS NULL THEN
    v_owner := uuid_generate_v4();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
      lower(p_owner_email), extensions.crypt(p_owner_password, extensions.gen_salt('bf')),
      v_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_owner_name),
      v_now, v_now, '', '', '', ''
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_owner::text, v_owner,
      jsonb_build_object('sub', v_owner::text, 'email', lower(p_owner_email)),
      'email', v_now, v_now, v_now
    );
  END IF;

  -- ── 7. Perfil + rol OWNER en el tenant ──────────────────
  INSERT INTO public.user_profiles (id, full_name, locale)
  VALUES (v_owner, p_owner_name, p_locale)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.user_tenant_roles (user_id, tenant_id, branch_id, role, is_active, invited_by)
  VALUES (v_owner, v_tenant, v_branch, 'OWNER', TRUE, v_caller)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'OWNER', is_active = TRUE;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant,
    'branch_id', v_branch,
    'owner_id',  v_owner,
    'owner_email', lower(p_owner_email)
  );
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 5) CAMBIAR PLAN DE UN TENANT (tenant + suscripción sincronizados)
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_tenant_plan(
  p_tenant_id UUID,
  p_plan      TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede cambiar planes';
  END IF;

  UPDATE public.tenants
     SET plan = p_plan::subscription_plan, updated_at = now()
   WHERE id = p_tenant_id;

  -- sincroniza la suscripción más reciente (o la crea si no existe)
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE tenant_id = p_tenant_id) THEN
    UPDATE public.subscriptions
       SET plan = p_plan::subscription_plan, updated_at = now()
     WHERE tenant_id = p_tenant_id;
  ELSE
    INSERT INTO public.subscriptions (
      tenant_id, plan, status, billing_cycle, price, currency,
      current_period_start, current_period_end
    ) VALUES (
      p_tenant_id, p_plan::subscription_plan, 'ACTIVE', 'MONTHLY', 0, 'USD',
      now(), now() + INTERVAL '30 days'
    );
  END IF;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 6) ACTIVAR / DESACTIVAR TENANT
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_tenant_active(
  p_tenant_id UUID,
  p_active    BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede activar/desactivar tenants';
  END IF;

  UPDATE public.tenants
     SET is_active = p_active, updated_at = now()
   WHERE id = p_tenant_id;

  UPDATE public.subscriptions
     SET status = CASE WHEN p_active THEN 'ACTIVE' ELSE 'CANCELLED' END,
         cancelled_at = CASE WHEN p_active THEN NULL ELSE now() END,
         updated_at = now()
   WHERE tenant_id = p_tenant_id;
END;
$$;

-- ── Permisos de ejecución (usuarios autenticados; el guard interno valida super admin) ──
GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(
  TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_plan(UUID,TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_active(UUID,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_tenant_roles(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin()             TO authenticated;

SELECT 'Migración 005 (plataforma / super admin) aplicada ✅' AS resultado;
