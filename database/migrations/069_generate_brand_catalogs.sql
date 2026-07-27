-- ============================================================
-- REG-X — Migration 069: generar catálogos automáticamente
-- ------------------------------------------------------------
-- Toma TODOS los productos de los clientes, ya clasificados por el
-- motor de marcas (068), y arma un catálogo maestro por FABRICANTE:
-- "Coca-Cola FEMSA", "Postobón", "Bavaria", "Grupo Nutresa"…
--
-- Así, cuando llegue un cliente nuevo, le cargas el catálogo del
-- proveedor que maneja y queda listo con nombre, categoría, código
-- de barras e imagen.
--
-- Reglas:
--   · Solo entran productos con marca detectada.
--   · Un producto por código de barras (o por nombre si no tiene).
--   · No duplica: si el producto ya está en ese catálogo, lo omite.
--   · Se puede re-ejecutar para ir completando catálogos.
--
-- Las imágenes se referencian desde el bucket del cliente. Si quieres
-- que queden en el bucket de la plataforma (recomendado a la larga),
-- usa el botón "Con foto" en Descubrir, que sí las copia.
--
-- Idempotente. Ejecutar después de la 068.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0) Prefijos GS1 adicionales observados en la base
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.brand_rules (match_type, match_value, brand, manufacturer, priority) VALUES
  ('barcode_prefix', '7702004', 'Bavaria', 'Bavaria (AB InBev)', 100)
ON CONFLICT (match_type, match_value) DO NOTHING;

-- Normalizar el fabricante de las marcas de Bavaria ya sembradas
UPDATE public.brand_rules
   SET manufacturer = 'Bavaria (AB InBev)'
 WHERE manufacturer = 'Bavaria';

CREATE OR REPLACE FUNCTION public.generate_brand_catalogs(
  /** Mínimo de negocios en que debe aparecer el producto para incluirlo */
  p_min_tenants     INT     DEFAULT 1,
  /** Incluir solo productos que tengan imagen */
  p_only_with_image BOOLEAN DEFAULT FALSE,
  /** Agrupar por fabricante (TRUE) o por marca individual (FALSE) */
  p_by_manufacturer BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row            RECORD;
  v_template_id    UUID;
  v_group          TEXT;
  v_slug           TEXT;
  v_created_items  INT := 0;
  v_created_cats   INT := 0;
  v_skipped        INT := 0;
BEGIN
  IF NOT (SELECT public.is_super_admin()) THEN
    RAISE EXCEPTION 'Solo el administrador de la plataforma puede generar catálogos'
      USING ERRCODE = '42501';
  END IF;

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
        count(DISTINCT t_id)                      AS g_tenants,
        (array_agg(p_image) FILTER (WHERE p_image IS NOT NULL))[1]     AS g_image
      FROM keyed
      GROUP BY g_key
    )
    SELECT a.*, gb.brand AS g_brand, gb.manufacturer AS g_manufacturer
      FROM agg a
      LEFT JOIN LATERAL public.guess_brand(a.g_name, a.g_barcode) gb ON TRUE
     WHERE gb.brand IS NOT NULL
       AND a.g_tenants >= GREATEST(1, p_min_tenants)
       AND (NOT p_only_with_image OR a.g_image IS NOT NULL)
     ORDER BY gb.manufacturer NULLS LAST, gb.brand, a.g_name
  LOOP
    -- Nombre del catálogo: fabricante (o la marca si no hay fabricante)
    v_group := CASE
      WHEN p_by_manufacturer THEN COALESCE(v_row.g_manufacturer, v_row.g_brand)
      ELSE v_row.g_brand
    END;

    v_slug := 'auto-' || regexp_replace(
      lower(translate(v_group,
            'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
            'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
      '[^a-z0-9]+', '-', 'g');
    v_slug := btrim(v_slug, '-');

    -- Catálogo del proveedor (se crea la primera vez)
    SELECT id INTO v_template_id
      FROM public.catalog_templates WHERE slug = v_slug;

    IF v_template_id IS NULL THEN
      INSERT INTO public.catalog_templates (name, slug, description, business_type)
      VALUES (
        v_group, v_slug,
        'Generado automáticamente desde los productos de los clientes.',
        NULL
      )
      RETURNING id INTO v_template_id;
      v_created_cats := v_created_cats + 1;
    END IF;

    -- ¿Ya está el producto en ese catálogo?
    IF EXISTS (
      SELECT 1 FROM public.catalog_template_items i
       WHERE i.template_id = v_template_id
         AND (public.normalize_name(i.name::TEXT) = public.normalize_name(v_row.g_name::TEXT)
              OR (v_row.g_barcode IS NOT NULL
                  AND public.normalize_barcode(i.barcode::TEXT) = v_row.g_barcode))
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.catalog_template_items
      (template_id, name, category, barcode, image_url, brand, manufacturer, sort_order)
    VALUES (
      v_template_id, v_row.g_name, v_row.g_category, v_row.g_barcode,
      v_row.g_image, v_row.g_brand, v_row.g_manufacturer, 0
    );
    v_created_items := v_created_items + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'catalogs_created', v_created_cats,
    'items_created',    v_created_items,
    'skipped',          v_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_brand_catalogs(INT, BOOLEAN, BOOLEAN) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Utilidad: borrar catálogos generados automáticamente
-- (los de slug 'auto-…'), por si quieres regenerarlos desde cero.
-- Los catálogos hechos a mano NO se tocan.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_auto_catalogs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT (SELECT public.is_super_admin()) THEN
    RAISE EXCEPTION 'Solo el administrador de la plataforma puede borrar catálogos'
      USING ERRCODE = '42501';
  END IF;

  WITH del AS (
    DELETE FROM public.catalog_templates
     WHERE slug LIKE 'auto-%'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM del;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_auto_catalogs() TO authenticated;
