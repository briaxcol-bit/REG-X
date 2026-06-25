-- ============================================================
-- REG-X — Usuario de prueba completo
-- ============================================================
-- Credenciales:
--   Email:      admin@regx.test
--   Contraseña: Admin123!
--
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

DO $$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_branch_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN

  -- ── 1. Crear usuario en auth.users ────────────────────────
  -- Si ya existe, obtener su id
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'admin@regx.test';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@regx.test',
      crypt('Admin123!', gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin Demo","role":"OWNER"}',
      NOW(),
      NOW(),
      '', '', '', ''
    );

    -- Identidad de email requerida por Supabase
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@regx.test'),
      'email',
      'admin@regx.test',
      NOW(), NOW(), NOW()
    );
  END IF;

  -- ── 2. Tenant demo ────────────────────────────────────────
  INSERT INTO tenants (
    id, name, slug, business_type, plan,
    country, currency, timezone, locale,
    tax_id, primary_color, is_active, created_by
  ) VALUES (
    v_tenant_id,
    'Tienda Demo REG-X',
    'demo-regx',
    'STORE',
    'PROFESSIONAL',
    'CO', 'COP', 'America/Bogota', 'es-CO',
    '900123456-1',
    '#F20D18',
    TRUE,
    v_user_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── 3. Sucursal principal ─────────────────────────────────
  INSERT INTO branches (
    id, tenant_id, name, code,
    phone, email,
    is_main, is_active, created_by,
    address
  ) VALUES (
    v_branch_id,
    v_tenant_id,
    'Sucursal Principal',
    'SUC-001',
    '+57 300 000 0000',
    'admin@regx.test',
    TRUE, TRUE,
    v_user_id,
    '{"street":"Calle 1 # 1-01","city":"Bogotá","country":"CO"}'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── 4. Perfil de usuario ──────────────────────────────────
  INSERT INTO user_profiles (
    id, full_name, platform_role, locale
  ) VALUES (
    v_user_id,
    'Admin Demo',
    NULL,          -- No es super admin de plataforma
    'es-CO'
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name;

  -- ── 5. Rol OWNER en el tenant ─────────────────────────────
  INSERT INTO user_tenant_roles (
    user_id, tenant_id, branch_id, role, is_active, joined_at
  ) VALUES (
    v_user_id,
    v_tenant_id,
    v_branch_id,
    'OWNER',
    TRUE,
    NOW()
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET role = 'OWNER', is_active = TRUE;

  -- ── 6. Suscripción activa ─────────────────────────────────
  INSERT INTO subscriptions (
    tenant_id, plan, status,
    current_period_start, current_period_end,
    max_users, max_branches, max_products
  ) VALUES (
    v_tenant_id,
    'PROFESSIONAL',
    'ACTIVE',
    NOW(),
    NOW() + INTERVAL '1 year',
    20, 5, 5000
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Usuario creado: admin@regx.test / Admin123!';
  RAISE NOTICE '   user_id   = %', v_user_id;
  RAISE NOTICE '   tenant_id = %', v_tenant_id;
  RAISE NOTICE '   branch_id = %', v_branch_id;

END $$;
