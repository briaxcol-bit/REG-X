-- ============================================================
-- REG-X — Migration 065: código de barras en el descubrimiento
-- ------------------------------------------------------------
-- El código de barras (EAN/UPC) es UNIVERSAL: identifica al producto
-- sin importar el negocio. Es mejor clave que el nombre, que cada
-- tenant escribe distinto ("Coca Cola 400", "coca-cola 400ml").
--
-- Cambios sobre la 064:
--   1. Agrupa por CÓDIGO DE BARRAS cuando existe; si no, por nombre.
--      Así dos escrituras distintas del mismo producto se unen.
--   2. Devuelve el código de barras para importarlo al catálogo.
--   3. Nuevo filtro p_only_with_barcode.
--   4. "Ya está en mi catálogo" se evalúa por código de barras
--      además de por nombre.
--
-- Idempotente. Ejecutar después de la 064.
-- ============================================================

-- El tipo de retorno cambia: hay que eliminar la versión anterior.
DROP FUNCTION IF EXISTS public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, INT);

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
      p.tenant_id,
      btrim(p.name)                  AS pname,
      lower(btrim(p.name))           AS pnamekey,
      NULLIF(btrim(p.barcode), '')   AS pbarcode,
      NULLIF(btrim(c.name), '')      AS pcategory,
      NULLIF(btrim(p.image_url), '') AS pimage
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NULL
      AND btrim(COALESCE(p.name, '')) <> ''
  ),
  keyed AS (
    -- Clave de agrupación: el código de barras manda; si no hay, el nombre
    SELECT k.*, COALESCE(k.pbarcode, k.pnamekey) AS gkey FROM prods k
  ),
  agg AS (
    SELECT
      gkey,
      mode() WITHIN GROUP (ORDER BY pname)     AS gname,
      mode() WITHIN GROUP (ORDER BY pcategory) AS gcategory,
      (array_agg(pbarcode) FILTER (WHERE pbarcode IS NOT NULL))[1] AS gbarcode,
      count(DISTINCT tenant_id)                AS n_tenants,
      (array_agg(pimage) FILTER (WHERE pimage IS NOT NULL))[1]     AS gimage
    FROM keyed
    GROUP BY gkey
  )
  SELECT
    a.gname,
    a.gcategory,
    a.gbarcode,
    a.n_tenants,
    a.gimage,
    EXISTS (
      SELECT 1 FROM public.catalog_template_items i
       WHERE lower(btrim(i.name)) = lower(a.gname)
          OR (a.gbarcode IS NOT NULL
              AND NULLIF(btrim(i.barcode), '') = a.gbarcode)
    ) AS in_cat
  FROM agg a
  WHERE (p_search IS NULL OR btrim(p_search) = ''
         OR lower(a.gname) LIKE '%' || lower(btrim(p_search)) || '%'
         OR a.gbarcode LIKE '%' || btrim(p_search) || '%')
    AND (NOT p_only_with_image   OR a.gimage   IS NOT NULL)
    AND (NOT p_only_with_barcode OR a.gbarcode IS NOT NULL)
    AND (NOT p_hide_in_catalog OR NOT EXISTS (
          SELECT 1 FROM public.catalog_template_items i
           WHERE lower(btrim(i.name)) = lower(a.gname)
              OR (a.gbarcode IS NOT NULL
                  AND NULLIF(btrim(i.barcode), '') = a.gbarcode)))
  ORDER BY a.n_tenants DESC, a.gname
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Índice para que la búsqueda por código de barras sea instantánea
-- al explorar todos los tenants.
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_catalog_items_barcode
  ON public.catalog_template_items (barcode)
  WHERE barcode IS NOT NULL;
