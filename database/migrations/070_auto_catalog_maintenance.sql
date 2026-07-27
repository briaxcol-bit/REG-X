-- ============================================================
-- REG-X — Migration 070: mantenimiento automático de catálogos
-- ------------------------------------------------------------
-- 1. Los catálogos por proveedor se actualizan SOLOS cada noche
--    (pg_cron): si un cliente cargó productos nuevos hoy, mañana ya
--    están en el catálogo del fabricante que corresponda.
--
-- 2. `unclassified_products()`: lista los productos que NINGUNA regla
--    reconoció, ordenados por qué tan repetidos están. Es la lista de
--    "marcas que me faltan por enseñarle al sistema".
--
-- Idempotente. Ejecutar después de la 069.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) Versión interna de la generación (sin chequeo de sesión)
--    El cron corre como proceso del servidor: no hay usuario
--    autenticado, así que is_super_admin() no aplica ahí.
--    La función pública (069) sigue exigiendo SUPER_ADMIN.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_brand_catalogs_internal()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row           RECORD;
  v_template_id   UUID;
  v_group         TEXT;
  v_slug          TEXT;
  v_created_items INT := 0;
  v_created_cats  INT := 0;
BEGIN
  FOR v_row IN
    WITH prods AS (
      SELECT
        p.tenant_id                               AS t_id,
        btrim(p.name)                             AS p_name,
        public.normalize_name(p.name::TEXT)       AS p_namekey,
        public.normalize_barcode(p.barcode::TEXT) AS p_barcode,
        NULLIF(btrim(c.name), '')                 AS p_category,
        NULLIF(btrim(p.image_url), '')            AS p_image
      FROM public.products p
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE p.deleted_at IS NULL
        AND public.normalize_name(p.name::TEXT) IS NOT NULL
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
        (array_agg(p_image)   FILTER (WHERE p_image   IS NOT NULL))[1] AS g_image
      FROM keyed
      GROUP BY g_key
    )
    SELECT a.*, gb.brand AS g_brand, gb.manufacturer AS g_manufacturer
      FROM agg a
      LEFT JOIN LATERAL public.guess_brand(a.g_name, a.g_barcode) gb ON TRUE
     WHERE gb.brand IS NOT NULL
  LOOP
    v_group := COALESCE(v_row.g_manufacturer, v_row.g_brand);

    v_slug := btrim(regexp_replace(
      lower(translate(v_group,
            'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
            'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
      '[^a-z0-9]+', '-', 'g'), '-');
    v_slug := 'auto-' || v_slug;

    SELECT id INTO v_template_id
      FROM public.catalog_templates WHERE slug = v_slug;

    IF v_template_id IS NULL THEN
      INSERT INTO public.catalog_templates (name, slug, description)
      VALUES (v_group, v_slug,
              'Generado automáticamente desde los productos de los clientes.')
      RETURNING id INTO v_template_id;
      v_created_cats := v_created_cats + 1;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.catalog_template_items i
       WHERE i.template_id = v_template_id
         AND (public.normalize_name(i.name::TEXT) = public.normalize_name(v_row.g_name::TEXT)
              OR (v_row.g_barcode IS NOT NULL
                  AND public.normalize_barcode(i.barcode::TEXT) = v_row.g_barcode))
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.catalog_template_items
      (template_id, name, category, barcode, image_url, brand, manufacturer, sort_order)
    VALUES (v_template_id, v_row.g_name, v_row.g_category, v_row.g_barcode,
            v_row.g_image, v_row.g_brand, v_row.g_manufacturer, 0);
    v_created_items := v_created_items + 1;
  END LOOP;

  RETURN jsonb_build_object('catalogs_created', v_created_cats,
                            'items_created',    v_created_items);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2) Programación nocturna (pg_cron)
--    Si la extensión no está disponible, la migración NO falla:
--    simplemente queda sin programar y se puede correr a mano.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Quitar la programación anterior si existe (idempotencia)
  PERFORM cron.unschedule(jobid)
     FROM cron.job WHERE jobname = 'regx_generate_brand_catalogs';

  -- Todos los días a las 3:00 AM (hora del servidor, UTC)
  PERFORM cron.schedule(
    'regx_generate_brand_catalogs',
    '0 3 * * *',
    $cmd$ SELECT public.generate_brand_catalogs_internal(); $cmd$
  );

  RAISE NOTICE 'Catálogos programados: se actualizan solos cada noche a las 3:00 AM';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron no disponible (%). Los catálogos se generan con el botón del panel.', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3) Productos que ninguna regla reconoció
--    = las marcas que faltan por agregar a brand_rules.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unclassified_products(p_limit INT DEFAULT 100)
RETURNS TABLE (
  name          TEXT,
  category      TEXT,
  barcode       TEXT,
  barcode_prefix TEXT,
  tenant_count  BIGINT,
  image_url     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT public.is_super_admin()) THEN
    RAISE EXCEPTION 'Solo el administrador de la plataforma puede ver esto'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH prods AS (
    SELECT
      p.tenant_id                               AS t_id,
      btrim(p.name)                             AS p_name,
      public.normalize_name(p.name::TEXT)       AS p_namekey,
      public.normalize_barcode(p.barcode::TEXT) AS p_barcode,
      NULLIF(btrim(c.name), '')                 AS p_category,
      NULLIF(btrim(p.image_url), '')            AS p_image
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NULL
      AND public.normalize_name(p.name::TEXT) IS NOT NULL
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
      (array_agg(p_image) FILTER (WHERE p_image IS NOT NULL))[1]     AS g_image
    FROM keyed
    GROUP BY g_key
  )
  SELECT
    a.g_name,
    a.g_category,
    a.g_barcode,
    -- Prefijo de fabricante: útil para crear la regla de un golpe
    CASE WHEN a.g_barcode IS NOT NULL AND length(a.g_barcode) >= 7
         THEN left(a.g_barcode, 7) END,
    a.g_tenants,
    a.g_image
  FROM agg a
  LEFT JOIN LATERAL public.guess_brand(a.g_name, a.g_barcode) gb ON TRUE
  WHERE gb.brand IS NULL
  ORDER BY a.g_tenants DESC, a.g_name
  LIMIT GREATEST(1, LEAST(p_limit, 500));
END;
$$;

GRANT EXECUTE ON FUNCTION public.unclassified_products(INT) TO authenticated;
