-- ============================================================
-- REG-X — Migration 009: Tenant Customization & Assets
-- ------------------------------------------------------------
-- 1. Crea el bucket 'tenant-assets' en Supabase Storage
-- 2. Configura las políticas RLS para subir/ver logos
-- 3. Actualiza 'create_tenant_with_owner' para recibir
--    logo_url y primary_color, y remover el cast a enum.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) BUCKET DE STORAGE
-- ══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-assets',
  'tenant-assets',
  TRUE,
  2097152, -- 2MB max
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- ══════════════════════════════════════════════════════════════
-- 2) POLÍTICAS RLS DEL BUCKET
-- ══════════════════════════════════════════════════════════════
-- Cualquier persona puede ver las imágenes (es un bucket público)
DROP POLICY IF EXISTS "Public View Tenant Assets" ON storage.objects;
CREATE POLICY "Public View Tenant Assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'tenant-assets' );

-- Solo los SUPER_ADMIN pueden subir archivos libremente por ahora
DROP POLICY IF EXISTS "Super Admin Insert Tenant Assets" ON storage.objects;
CREATE POLICY "Super Admin Insert Tenant Assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-assets' 
  AND public.is_super_admin()
);

DROP POLICY IF EXISTS "Super Admin Update Tenant Assets" ON storage.objects;
CREATE POLICY "Super Admin Update Tenant Assets"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'tenant-assets' AND public.is_super_admin() )
WITH CHECK ( bucket_id = 'tenant-assets' AND public.is_super_admin() );

DROP POLICY IF EXISTS "Super Admin Delete Tenant Assets" ON storage.objects;
CREATE POLICY "Super Admin Delete Tenant Assets"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'tenant-assets' AND public.is_super_admin() );

-- ══════════════════════════════════════════════════════════════
-- 3) ACTUALIZAR FUNCION CREATE TENANT
-- ══════════════════════════════════════════════════════════════
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
  p_locale         TEXT DEFAULT 'es-CO',
  p_logo_url       TEXT DEFAULT NULL,
  p_primary_color  TEXT DEFAULT '#F20D18'
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
    timezone, locale, is_active, created_by, logo_url, primary_color
  ) VALUES (
    v_tenant, p_name, p_slug, p_business_type::business_type, p_plan,
    p_country, p_currency, p_timezone, p_locale, TRUE, v_caller, p_logo_url, p_primary_color
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
    v_tenant, p_plan, 'TRIAL', 'MONTHLY', 0, p_currency,
    v_now + INTERVAL '30 days', v_now, v_now + INTERVAL '30 days', v_caller
  );

  -- ── 5. Roles de negocio + permisos ──────────────────────
  PERFORM public.seed_tenant_roles(v_tenant);

  -- ── 6. Usuario OWNER ────────────────────────────────────
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

SELECT 'Migración 009 (Tenant Assets) aplicada ✅' AS resultado;
