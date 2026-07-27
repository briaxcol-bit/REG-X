-- ============================================================
-- REG-X — Migration 064: Descubrir productos de los clientes
-- ------------------------------------------------------------
-- Los tenants cargan sus propios productos. Muchos son los mismos
-- entre negocios ("Coca-Cola 400ml" está en toda tienda). Esta
-- función deja ver ese universo AGRUPADO para alimentar los
-- catálogos maestros (migración 063) con lo que ya está probado.
--
-- Devuelve, por nombre de producto:
--   - en cuántos negocios distintos aparece (los repetidos valen más)
--   - la categoría más usada para ese producto
--   - una imagen de muestra (la primera que exista)
--   - si ya está en algún catálogo maestro
--
-- SOLO SUPER_ADMIN: es la única forma de leer productos de todos
-- los tenants (las políticas RLS de `products` siguen intactas).
-- Idempotente. Ejecutar después de la 063.
-- ============================================================

CREATE OR REPLACE FUNCTION public.discover_tenant_products(
  p_search          TEXT    DEFAULT NULL,
  p_only_with_image BOOLEAN DEFAULT TRUE,
  p_hide_in_catalog BOOLEAN DEFAULT TRUE,
  p_limit           INT     DEFAULT 200
)
RETURNS TABLE (
  name         TEXT,
  category     TEXT,
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
      btrim(p.name)              AS pname,
      lower(btrim(p.name))       AS pkey,
      NULLIF(btrim(c.name), '')  AS pcategory,
      NULLIF(btrim(p.image_url), '') AS pimage
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NULL
      AND btrim(COALESCE(p.name, '')) <> ''
  ),
  agg AS (
    SELECT
      pkey,
      (array_agg(pname ORDER BY pname))[1]                         AS pname,
      mode() WITHIN GROUP (ORDER BY pcategory)                     AS pcategory,
      count(DISTINCT tenant_id)                                    AS n_tenants,
      (array_agg(pimage) FILTER (WHERE pimage IS NOT NULL))[1]     AS pimage
    FROM prods
    GROUP BY pkey
  )
  SELECT
    a.pname,
    a.pcategory,
    a.n_tenants,
    a.pimage,
    EXISTS (
      SELECT 1 FROM public.catalog_template_items i
       WHERE lower(btrim(i.name)) = a.pkey
    ) AS in_cat
  FROM agg a
  WHERE (p_search IS NULL OR btrim(p_search) = ''
         OR a.pkey LIKE '%' || lower(btrim(p_search)) || '%')
    AND (NOT p_only_with_image OR a.pimage IS NOT NULL)
    AND (NOT p_hide_in_catalog OR NOT EXISTS (
          SELECT 1 FROM public.catalog_template_items i
           WHERE lower(btrim(i.name)) = a.pkey))
  ORDER BY a.n_tenants DESC, a.pname
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, INT) TO authenticated;
