-- ============================================================
-- REG-X — Migration 067: ver productos POR EMPRESA
-- ------------------------------------------------------------
-- 1. platform_product_stats(): resumen por tenant — cuántos productos
--    tiene, cuántos están duplicados dentro de su propia base, cuántos
--    no tienen imagen y cuántos no tienen código de barras.
--    Sirve para ver de un vistazo qué cliente tiene el catálogo más
--    completo (el mejor para copiarle) y cuál lo tiene sucio.
--
-- 2. discover_tenant_products ahora acepta p_tenant_id: explorar los
--    productos de UNA empresa concreta en vez de todas juntas.
--
-- Solo SUPER_ADMIN. Idempotente.
-- AUTOSUFICIENTE: incluye los helpers de normalización de la 066,
-- así que puede ejecutarse aunque esa migración no se haya corrido.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0) Helpers de normalización (idénticos a los de la 066)
--    Se re-crean aquí para que esta migración no dependa del orden.
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
          '[^a-z0-9]+', ' ', 'g'),
        '\s+', ' ', 'g')
    ), '')
$$;

GRANT EXECUTE ON FUNCTION public.normalize_barcode(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_name(TEXT)    TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 1) Resumen por empresa
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_product_stats()
RETURNS TABLE (
  tenant_id       UUID,
  tenant_name     TEXT,
  business_type   TEXT,
  total_products  BIGINT,
  unique_products BIGINT,
  duplicates      BIGINT,
  with_image      BIGINT,
  with_barcode    BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT public.is_super_admin()) THEN
    RAISE EXCEPTION 'Solo el administrador de la plataforma puede ver este resumen'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH prods AS (
    SELECT
      p.tenant_id AS t_id,
      COALESCE(public.normalize_barcode(p.barcode::TEXT),
               public.normalize_name(p.name::TEXT)) AS g_key,
      NULLIF(btrim(p.image_url), '')          AS p_image,
      public.normalize_barcode(p.barcode::TEXT)     AS p_barcode
    FROM public.products p
    WHERE p.deleted_at IS NULL
      AND public.normalize_name(p.name::TEXT) IS NOT NULL
  ),
  per_tenant AS (
    SELECT
      t_id,
      count(*)                  AS n_total,
      count(DISTINCT g_key)     AS n_unique,
      count(*) FILTER (WHERE p_image   IS NOT NULL) AS n_image,
      count(*) FILTER (WHERE p_barcode IS NOT NULL) AS n_barcode
    FROM prods
    GROUP BY t_id
  )
  SELECT
    t.id,
    t.name::TEXT,
    t.business_type::TEXT,
    COALESCE(pt.n_total, 0),
    COALESCE(pt.n_unique, 0),
    COALESCE(pt.n_total, 0) - COALESCE(pt.n_unique, 0),
    COALESCE(pt.n_image, 0),
    COALESCE(pt.n_barcode, 0)
  FROM public.tenants t
  LEFT JOIN per_tenant pt ON pt.t_id = t.id
  WHERE t.deleted_at IS NULL
  ORDER BY COALESCE(pt.n_unique, 0) DESC, t.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_product_stats() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) discover_tenant_products v4 — filtro por empresa
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT);

CREATE OR REPLACE FUNCTION public.discover_tenant_products(
  p_search            TEXT    DEFAULT NULL,
  p_only_with_image   BOOLEAN DEFAULT TRUE,
  p_hide_in_catalog   BOOLEAN DEFAULT TRUE,
  p_only_with_barcode BOOLEAN DEFAULT FALSE,
  p_tenant_id         UUID    DEFAULT NULL,
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
      AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
  ),
  keyed AS (
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

GRANT EXECUTE ON FUNCTION public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, UUID, INT) TO authenticated;
