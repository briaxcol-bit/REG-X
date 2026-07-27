-- ============================================================
-- REG-X — Migration 066: agrupación robusta en el descubrimiento
-- ------------------------------------------------------------
-- Síntoma: el mismo producto ("Gol", código 7702007089721) aparecía
-- decenas de veces, cada uno como "1 negocio", en vez de una sola
-- tarjeta consolidada.
--
-- Causa: la clave de agrupación usaba el código/nombre tal cual. Basta
-- un espacio interno, un guion, una tilde o un carácter invisible para
-- que Postgres los considere distintos.
--
-- Fix: normalizar agresivamente antes de agrupar
--   · código de barras → solo dígitos ('770 2007-089721' → '7702007089721')
--   · nombre → minúsculas, sin tildes, sin signos, espacios colapsados
--
-- Además devuelve `variants`: cuántas filas de producto se consolidaron
-- (útil para detectar catálogos sucios en un cliente).
--
-- Idempotente. Ejecutar después de la 065.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) Helpers de normalización (reutilizables)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_barcode(p_text TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p_text, ''), '[^0-9]', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.normalize_name(p_text TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          lower(translate(COALESCE(p_text, ''),
                          'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                          'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
          '[^a-z0-9]+', ' ', 'g'),        -- signos → espacio
        '\s+', ' ', 'g')                   -- espacios colapsados
    ), '')
$$;

-- ─────────────────────────────────────────────────────────────
-- 2) discover_tenant_products v3
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, INT);
DROP FUNCTION IF EXISTS public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT);

CREATE OR REPLACE FUNCTION public.discover_tenant_products(
  p_search            TEXT    DEFAULT NULL,
  p_only_with_image   BOOLEAN DEFAULT TRUE,
  p_hide_in_catalog   BOOLEAN DEFAULT TRUE,
  p_only_with_barcode BOOLEAN DEFAULT FALSE,
  p_limit             INT     DEFAULT 200
)
RETURNS TABLE (
  name         TEXT,
  category     TEXT,
  barcode      TEXT,
  tenant_count BIGINT,
  variants     BIGINT,
  image_url    TEXT,
  in_catalog   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT public.is_super_admin()) THEN
    RAISE EXCEPTION 'Solo el administrador de la plataforma puede explorar productos'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH prods AS (
    SELECT
      p.tenant_id                                  AS t_id,
      btrim(p.name)                                AS p_name,
      public.normalize_name(p.name::TEXT)                AS p_namekey,
      public.normalize_barcode(p.barcode::TEXT)          AS p_barcode,
      NULLIF(btrim(c.name), '')                    AS p_category,
      NULLIF(btrim(p.image_url), '')               AS p_image
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NULL
      AND public.normalize_name(p.name::TEXT) IS NOT NULL
  ),
  keyed AS (
    -- El código de barras manda; si no hay, el nombre normalizado
    SELECT k.*, COALESCE(k.p_barcode, k.p_namekey) AS g_key FROM prods k
  ),
  agg AS (
    SELECT
      g_key,
      mode() WITHIN GROUP (ORDER BY p_name)     AS g_name,
      mode() WITHIN GROUP (ORDER BY p_category) AS g_category,
      (array_agg(p_barcode) FILTER (WHERE p_barcode IS NOT NULL))[1] AS g_barcode,
      count(DISTINCT t_id)                      AS g_tenants,
      count(*)                                  AS g_variants,
      (array_agg(p_image) FILTER (WHERE p_image IS NOT NULL))[1]     AS g_image
    FROM keyed
    GROUP BY g_key
  ),
  flagged AS (
    SELECT a.*,
      EXISTS (
        SELECT 1 FROM public.catalog_template_items i
         WHERE public.normalize_name(i.name::TEXT) = public.normalize_name(a.g_name::TEXT)
            OR (a.g_barcode IS NOT NULL
                AND public.normalize_barcode(i.barcode::TEXT) = a.g_barcode)
      ) AS g_in_catalog
    FROM agg a
  )
  SELECT
    f.g_name, f.g_category, f.g_barcode,
    f.g_tenants, f.g_variants, f.g_image, f.g_in_catalog
  FROM flagged f
  WHERE (p_search IS NULL OR btrim(p_search) = ''
         OR f.g_name ILIKE '%' || btrim(p_search) || '%'
         OR f.g_barcode LIKE '%' || public.normalize_barcode(p_search::TEXT) || '%')
    AND (NOT p_only_with_image   OR f.g_image   IS NOT NULL)
    AND (NOT p_only_with_barcode OR f.g_barcode IS NOT NULL)
    AND (NOT p_hide_in_catalog   OR NOT f.g_in_catalog)
  ORDER BY f.g_tenants DESC, f.g_variants DESC, f.g_name
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_barcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_name(TEXT)    TO authenticated;
