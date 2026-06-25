-- ============================================================
-- REG-X — Reparar perfil SUPER_ADMIN de briax.col@gmail.com
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- 1) DIAGNÓSTICO: ver el usuario y su perfil actual
SELECT
  u.id            AS user_id,
  u.email,
  p.full_name,
  p.platform_role
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE u.email = 'briax.col@gmail.com';

-- 2) CORRECCIÓN: crear/forzar el perfil como SUPER_ADMIN
INSERT INTO public.user_profiles (id, full_name, platform_role, locale)
SELECT id, 'Daniel', 'SUPER_ADMIN', 'es-CO'
FROM auth.users
WHERE email = 'briax.col@gmail.com'
ON CONFLICT (id) DO UPDATE
  SET platform_role = 'SUPER_ADMIN',
      full_name     = COALESCE(public.user_profiles.full_name, 'Daniel');

-- 3) VERIFICACIÓN: debe mostrar platform_role = SUPER_ADMIN
SELECT u.email, p.full_name, p.platform_role
FROM auth.users u
JOIN public.user_profiles p ON p.id = u.id
WHERE u.email = 'briax.col@gmail.com';
