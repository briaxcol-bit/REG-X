-- REG-X: Usuario de prueba
-- Email: admin@regx.test
-- Password: Admin123!

DO $body$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_branch_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN

  -- 1. Buscar si el usuario ya existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@regx.test';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@regx.test',
      crypt('Admin123!', gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin Demo"}',
      NOW(), NOW(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@regx.test'),
      'email',
      'admin@regx.test',
      NOW(), NOW(), NOW()
    );
  END IF;

  -- 2. Tenant
  INSERT INTO tenants (
    id, name, slug, business_type, plan,
    country, currency, timezone, locale,
    tax_id, primary_color, is_active, created_by
  ) VALUES (
    v_tenant_id, 'Tienda Demo REG-X', 'demo-regx',
    'STORE', 'PROFESSIONAL',
    'CO', 'COP', 'America/Bogota', 'es-CO',
    '900123456-1', '#F20D18', TRUE, v_user_id
  ) ON CONFLICT (id) DO NOTHING;

  -- 3. Sucursal
  INSERT INTO branches (
    id, tenant_id, name, code, phone, email,
    is_main, is_active, created_by, address
  ) VALUES (
    v_branch_id, v_tenant_id,
    'Sucursal Principal', 'SUC-001',
    '+57 300 000 0000', 'admin@regx.test',
    TRUE, TRUE, v_user_id,
    '{"street":"Calle 1 # 1-01","city":"Bogota","country":"CO"}'
  ) ON CONFLICT (id) DO NOTHING;

  -- 4. Perfil
  INSERT INTO user_profiles (id, full_name, locale)
  VALUES (v_user_id, 'Admin Demo', 'es-CO')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- 5. Rol OWNER
  INSERT INTO user_tenant_roles (user_id, tenant_id, branch_id, role, is_active, joined_at)
  VALUES (v_user_id, v_tenant_id, v_branch_id, 'OWNER', TRUE, NOW())
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'OWNER', is_active = TRUE;

  -- 6. Suscripcion
  INSERT INTO subscriptions (
    tenant_id, plan, status, billing_cycle,
    price, currency,
    current_period_start, current_period_end
  ) VALUES (
    v_tenant_id, 'PROFESSIONAL', 'ACTIVE', 'MONTHLY',
    0, 'COP',
    NOW(), NOW() + INTERVAL '1 year'
  ) ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Listo: admin@regx.test | Admin123! | user_id=%', v_user_id;

END $body$;
