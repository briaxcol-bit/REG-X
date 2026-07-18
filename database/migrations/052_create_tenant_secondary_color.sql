-- ══════════════════════════════════════════════════════════════
-- Migración 052 — create_tenant_with_owner + p_secondary_color
--
-- El frontend (CreateTenantModal) envía p_secondary_color, pero la
-- función (última versión en 011) no tiene ese parámetro → PostgREST
-- responde "Could not find the function ... in the schema cache".
-- La columna tenants.secondary_color existe desde la migración 010.
--
-- Se dropea la firma vieja (CREATE OR REPLACE con firma distinta
-- crearía un overload y la ambigüedad rompería el RPC).
-- ══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_tenant_with_owner(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
  p_name            TEXT,
  p_slug            TEXT,
  p_business_type   TEXT,
  p_plan            TEXT,
  p_country         TEXT,
  p_currency        TEXT,
  p_owner_email     TEXT,
  p_owner_name      TEXT,
  p_owner_password  TEXT,
  p_timezone        TEXT DEFAULT 'America/Bogota',
  p_locale          TEXT DEFAULT 'es-CO',
  p_logo_url        TEXT DEFAULT NULL,
  p_primary_color   TEXT DEFAULT '#F20D18',
  p_secondary_color TEXT DEFAULT '#111827'
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
    timezone, locale, is_active, created_by, logo_url,
    primary_color, secondary_color
  ) VALUES (
    v_tenant, p_name, p_slug, p_business_type::business_type, p_plan::subscription_plan,
    p_country, p_currency, p_timezone, p_locale, TRUE, v_caller, p_logo_url,
    p_primary_color, p_secondary_color
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

  -- ── 5. Roles de negocio filtrados por business_type ─────
  PERFORM public.seed_tenant_roles(v_tenant, p_business_type);

  -- ── 6. Módulos activados por business_type ──────────────
  PERFORM public.seed_tenant_modules(v_tenant, p_business_type);

  -- ── 7. Usuario OWNER ────────────────────────────────────
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

  -- ── 8. Perfil + rol OWNER en el tenant ──────────────────
  INSERT INTO public.user_profiles (id, full_name, locale)
  VALUES (v_owner, p_owner_name, p_locale)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.user_tenant_roles (user_id, tenant_id, branch_id, role, is_active, invited_by)
  VALUES (v_owner, v_tenant, v_branch, 'OWNER', TRUE, v_caller)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'OWNER', is_active = TRUE;

  RETURN jsonb_build_object(
    'tenant_id',   v_tenant,
    'branch_id',   v_branch,
    'owner_id',    v_owner,
    'owner_email', lower(p_owner_email)
  );
END;
$$;

-- Refrescar el cache de PostgREST para que el RPC quede disponible ya
NOTIFY pgrst, 'reload schema';

SELECT 'Migración 052 (create_tenant_with_owner + secondary_color) aplicada ✅' AS resultado;
