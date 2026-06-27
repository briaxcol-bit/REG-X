-- ── 012: Agregar cédula a user_profiles y actualizar RPCs de empleados ────────
-- phone ya existe en user_profiles; solo agregamos cedula.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS cedula VARCHAR(50);

-- Eliminar todas las versiones existentes para evitar conflicto de firmas
DROP FUNCTION IF EXISTS add_employee_to_tenant(TEXT,TEXT,TEXT,TEXT,UUID,UUID);
DROP FUNCTION IF EXISTS add_employee_to_tenant(TEXT,TEXT,TEXT,TEXT,UUID,UUID,TEXT,TEXT);
DROP FUNCTION IF EXISTS update_employee_profile(UUID,TEXT,UUID,TEXT,TEXT,UUID);
DROP FUNCTION IF EXISTS update_employee_profile(UUID,TEXT,UUID,TEXT,TEXT,UUID,TEXT);
DROP FUNCTION IF EXISTS update_employee_profile(UUID,TEXT,UUID,TEXT,TEXT,TEXT,UUID,TEXT);
DROP FUNCTION IF EXISTS update_employee_profile(UUID,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT);

-- ── RPC add_employee_to_tenant (versión final con phone y cedula) ──────────────
CREATE OR REPLACE FUNCTION add_employee_to_tenant(
  p_email      TEXT,
  p_full_name  TEXT,
  p_password   TEXT,
  p_role       TEXT,
  p_tenant_id  UUID,
  p_branch_id  UUID   DEFAULT NULL,
  p_phone      TEXT   DEFAULT NULL,
  p_cedula     TEXT   DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_role IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'No se puede asignar el rol % mediante esta función.', p_role;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email));

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
      v_user_id, 'authenticated', 'authenticated',
      lower(trim(p_email)),
      crypt(p_password, gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name),
      NOW(), NOW(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
      'email', lower(trim(p_email)),
      NOW(), NOW(), NOW()
    );
  END IF;

  -- Perfil con phone y cedula
  INSERT INTO user_profiles (id, full_name, phone, cedula)
  VALUES (v_user_id, p_full_name, p_phone, p_cedula)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone     = COALESCE(EXCLUDED.phone,   user_profiles.phone),
        cedula    = COALESCE(EXCLUDED.cedula,  user_profiles.cedula);

  INSERT INTO user_tenant_roles (user_id, tenant_id, branch_id, role, is_active)
  VALUES (v_user_id, p_tenant_id, p_branch_id, p_role::business_role, true)
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET role = p_role::business_role, is_active = true, branch_id = p_branch_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION add_employee_to_tenant(TEXT,TEXT,TEXT,TEXT,UUID,UUID,TEXT,TEXT) TO authenticated;

-- ── RPC update_employee_profile (versión final con phone y cedula) ────────────
CREATE OR REPLACE FUNCTION update_employee_profile(
  p_user_id    UUID,
  p_full_name  TEXT,
  p_tenant_id  UUID,
  p_email      TEXT    DEFAULT NULL,
  p_phone      TEXT    DEFAULT NULL,
  p_cedula     TEXT    DEFAULT NULL,
  p_role       TEXT    DEFAULT NULL,
  p_branch_id  UUID    DEFAULT NULL,
  p_password   TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_tenant_roles
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
      AND role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Sin permisos para editar empleados.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_tenant_roles
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Empleado no encontrado en este negocio.';
  END IF;

  -- Nombre, teléfono y cédula en user_profiles
  UPDATE user_profiles
    SET full_name = p_full_name,
        phone     = p_phone,
        cedula    = p_cedula
  WHERE id = p_user_id;

  UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'), '{full_name}', to_jsonb(p_full_name))
  WHERE id = p_user_id;

  -- Correo
  IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM auth.users
      WHERE email = lower(trim(p_email)) AND id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'El correo % ya está en uso por otro usuario.', p_email;
    END IF;

    UPDATE auth.users
      SET email = lower(trim(p_email)), email_confirmed_at = NOW()
    WHERE id = p_user_id;

    UPDATE auth.identities
      SET provider_id   = lower(trim(p_email)),
          identity_data = jsonb_set(COALESCE(identity_data, '{}'), '{email}', to_jsonb(lower(trim(p_email)))),
          updated_at    = NOW()
    WHERE user_id = p_user_id AND provider = 'email';
  END IF;

  -- Rol
  IF p_role IS NOT NULL AND p_role NOT IN ('OWNER', 'ADMIN') THEN
    UPDATE user_tenant_roles
      SET role = p_role::business_role
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
  END IF;

  -- Contraseña (solo si se indicó explícitamente)
  IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
    UPDATE auth.users
      SET encrypted_password = crypt(p_password, gen_salt('bf', 10))
    WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_employee_profile(UUID,TEXT,UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT) TO authenticated;
