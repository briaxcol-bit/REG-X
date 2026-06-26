-- ============================================================
-- REG-X — Migration 010: Tenant Edit, Delete & Secondary Color
-- ------------------------------------------------------------
-- 1. Agrega columna secondary_color a la tabla tenants
-- 2. Crea función update_tenant_branding (SUPER_ADMIN)
-- 3. Crea función delete_tenant (SUPER_ADMIN)
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1) NUEVA COLUMNA secondary_color
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#111827';

-- ══════════════════════════════════════════════════════════════
-- 2) FUNCIÓN update_tenant_branding
--    Permite editar nombre, slug, tipo, colores y logo
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_tenant_branding(
  p_tenant_id       UUID,
  p_name            TEXT          DEFAULT NULL,
  p_slug            TEXT          DEFAULT NULL,
  p_business_type   TEXT          DEFAULT NULL,
  p_logo_url        TEXT          DEFAULT NULL,
  p_primary_color   TEXT          DEFAULT NULL,
  p_secondary_color TEXT          DEFAULT NULL,
  p_country         TEXT          DEFAULT NULL,
  p_currency        TEXT          DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede editar tenants';
  END IF;

  -- Validar slug único si se cambia
  IF p_slug IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenants
    WHERE slug = p_slug AND id <> p_tenant_id
  ) THEN
    RAISE EXCEPTION 'El slug "%" ya está en uso por otro tenant', p_slug;
  END IF;

  UPDATE public.tenants SET
    name            = COALESCE(p_name,            name),
    slug            = COALESCE(p_slug,            slug),
    business_type   = COALESCE(p_business_type::business_type, business_type),
    logo_url        = CASE WHEN p_logo_url = '__REMOVE__' THEN NULL ELSE COALESCE(p_logo_url, logo_url) END,
    primary_color   = COALESCE(p_primary_color,   primary_color),
    secondary_color = COALESCE(p_secondary_color, secondary_color),
    country         = COALESCE(p_country,         country),
    currency        = COALESCE(p_currency,        currency),
    updated_at      = now()
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant no encontrado: %', p_tenant_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'tenant_id', p_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_tenant_branding(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- 3) FUNCIÓN delete_tenant
--    Elimina un tenant y todo lo relacionado (CASCADE automático)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_tenant(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo un SUPER_ADMIN puede eliminar tenants';
  END IF;

  SELECT name INTO v_name FROM public.tenants WHERE id = p_tenant_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Tenant no encontrado: %', p_tenant_id;
  END IF;

  -- El CASCADE en FK elimina branches, warehouses, subscriptions,
  -- user_tenant_roles y demás registros relacionados automáticamente
  DELETE FROM public.tenants WHERE id = p_tenant_id;

  RETURN jsonb_build_object('success', true, 'deleted_name', v_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_tenant(UUID) TO authenticated;

SELECT 'Migración 010 (tenant edit/delete + secondary_color) aplicada ✅' AS resultado;
