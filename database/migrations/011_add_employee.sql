-- ── 011: RPC para agregar empleados al tenant ────────────────────────────────
-- Crea el usuario en auth si no existe y lo asigna al tenant con el rol dado.
-- SECURITY DEFINER: se ejecuta con privilegios del owner (puede insertar en auth.*)

CREATE OR REPLACE FUNCTION add_employee_to_tenant(
  p_email      TEXT,
  p_full_name  TEXT,
  p_password   TEXT,
  p_role       TEXT,
  p_tenant_id  UUID,
  p_branch_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Validar que el rol no sea OWNER ni ADMIN
  IF p_role IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'No se puede asignar el rol % mediante esta función.', p_role;
  END IF;

  -- 2. Verificar si el usuario ya existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email));

  -- 3. Si no existe, crearlo
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
      lower(trim(p_email)),
      crypt(p_password, gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name),
      NOW(), NOW(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
      'email',
      lower(trim(p_email)),
      NOW(), NOW(), NOW()
    );
  END IF;

  -- 4. Crear perfil si no existe
  INSERT INTO user_profiles (id, full_name)
  VALUES (v_user_id, p_full_name)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- 5. Asignar rol en el tenant
  INSERT INTO user_tenant_roles (user_id, tenant_id, branch_id, role, is_active)
  VALUES (v_user_id, p_tenant_id, p_branch_id, p_role::business_role, true)
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET role = p_role::business_role, is_active = true, branch_id = p_branch_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION add_employee_to_tenant TO authenticated;

-- ── RPC: obtener emails de empleados del tenant (auth.users no es accesible via RLS) ──
CREATE OR REPLACE FUNCTION get_employee_emails(
  p_tenant_id UUID
)
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Verificar que el caller pertenece al tenant con rol OWNER o ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM user_tenant_roles
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
      AND role IN ('OWNER', 'ADMIN') AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Sin permisos para ver empleados.';
  END IF;

  RETURN QUERY
  SELECT utr.user_id, au.email::TEXT
  FROM user_tenant_roles utr
  JOIN auth.users au ON au.id = utr.user_id
  WHERE utr.tenant_id = p_tenant_id
    AND utr.role NOT IN ('OWNER', 'ADMIN');
END;
$$;

GRANT EXECUTE ON FUNCTION get_employee_emails(UUID) TO authenticated;

-- ── RPC: actualizar perfil de empleado (admin puede editar sus empleados) ──
CREATE OR REPLACE FUNCTION update_employee_profile(
  p_user_id    UUID,
  p_full_name  TEXT,
  p_tenant_id  UUID,
  p_email      TEXT    DEFAULT NULL,
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
  -- Verificar que el caller pertenece al mismo tenant con rol OWNER o ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM user_tenant_roles
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
      AND role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Sin permisos para editar empleados.';
  END IF;

  -- Verificar que el empleado pertenece al tenant
  IF NOT EXISTS (
    SELECT 1 FROM user_tenant_roles
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Empleado no encontrado en este negocio.';
  END IF;

  -- Actualizar nombre en user_profiles
  UPDATE user_profiles SET full_name = p_full_name WHERE id = p_user_id;
  -- También actualizar raw_user_meta_data en auth.users
  UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'), '{full_name}', to_jsonb(p_full_name))
  WHERE id = p_user_id;

  -- Actualizar correo si se indicó (y es distinto al actual)
  IF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    -- Verificar que el nuevo email no está en uso por otro usuario
    IF EXISTS (
      SELECT 1 FROM auth.users
      WHERE email = lower(trim(p_email)) AND id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'El correo % ya está en uso por otro usuario.', p_email;
    END IF;

    UPDATE auth.users
      SET email = lower(trim(p_email)),
          email_confirmed_at = NOW()
    WHERE id = p_user_id;

    -- Actualizar también auth.identities (provider_id = email)
    UPDATE auth.identities
      SET provider_id    = lower(trim(p_email)),
          identity_data  = jsonb_set(
            COALESCE(identity_data, '{}'),
            '{email}',
            to_jsonb(lower(trim(p_email)))
          ),
          updated_at     = NOW()
    WHERE user_id = p_user_id AND provider = 'email';
  END IF;

  -- Cambiar rol si se indicó
  IF p_role IS NOT NULL AND p_role NOT IN ('OWNER', 'ADMIN') THEN
    UPDATE user_tenant_roles
      SET role = p_role::business_role
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
  END IF;

  -- Cambiar contraseña solo si se indicó explícitamente
  IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
    UPDATE auth.users
      SET encrypted_password = crypt(p_password, gen_salt('bf', 10))
    WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_employee_profile(UUID, TEXT, UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- ── RPC: eliminar empleado del tenant ────────────────────────
CREATE OR REPLACE FUNCTION delete_employee_from_tenant(
  p_user_id   UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Solo OWNER o ADMIN del mismo tenant pueden eliminar
  IF NOT EXISTS (
    SELECT 1 FROM user_tenant_roles
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
      AND role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Sin permisos para eliminar empleados.';
  END IF;

  -- No permitir eliminar a sí mismo
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta.';
  END IF;

  -- No permitir eliminar OWNER o ADMIN
  IF EXISTS (
    SELECT 1 FROM user_tenant_roles
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
      AND role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar a un administrador o dueño.';
  END IF;

  -- Eliminar la asignación del tenant (el usuario en auth.users se conserva)
  DELETE FROM user_tenant_roles
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_employee_from_tenant TO authenticated;
