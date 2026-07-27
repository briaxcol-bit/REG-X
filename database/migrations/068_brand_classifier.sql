-- ============================================================
-- REG-X — Migration 068: clasificador automático de MARCA/FABRICANTE
-- ------------------------------------------------------------
-- Objetivo: saber que "Coca-Cola 1.5", "Sprite" y "Agua Brisa" son de
-- Coca-Cola; que "Manzana Postobón", "Agua Cristal" y "Hit" son de
-- Postobón; etc. — sin clasificar producto por producto a mano.
--
-- Cómo lo resuelve:
--   1. PREFIJO GS1 (lo más confiable): en un código de barras colombiano
--      (770…) los primeros ~7 dígitos son el prefijo que GS1 le asignó a
--      la empresa. Todo producto que empiece con ese prefijo es de ella.
--   2. PALABRA CLAVE en el nombre: para productos sin código o con
--      código mal digitado.
--
-- Las reglas viven en una tabla EDITABLE: si una marca queda mal
-- clasificada, se corrige ahí y todo se reclasifica solo.
--
-- ⚠️ Los prefijos se derivaron de códigos reales observados en la base y
-- de conocimiento general del mercado colombiano: revísalos antes de
-- darlos por definitivos (Plataforma → Catálogos → Marcas).
--
-- Idempotente. Ejecutar después de la 067.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) Tabla de reglas
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  /** 'barcode_prefix' (más confiable) | 'keyword' */
  match_type   TEXT NOT NULL CHECK (match_type IN ('barcode_prefix','keyword')),
  /** '7702090' o 'coca cola' (siempre normalizado a minúsculas) */
  match_value  TEXT NOT NULL,
  brand        TEXT NOT NULL,
  manufacturer TEXT,
  /** Mayor prioridad gana cuando varias reglas coinciden */
  priority     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_brand_rules_lookup
  ON public.brand_rules (match_type, match_value);

ALTER TABLE public.brand_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_rules_read" ON public.brand_rules;
CREATE POLICY "brand_rules_read" ON public.brand_rules
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "brand_rules_write" ON public.brand_rules;
CREATE POLICY "brand_rules_write" ON public.brand_rules
  FOR ALL USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

-- ─────────────────────────────────────────────────────────────
-- 2) Función de clasificación
--    El prefijo GS1 manda; si no hay coincidencia, palabra clave.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guess_brand(p_name TEXT, p_barcode TEXT)
RETURNS TABLE (brand TEXT, manufacturer TEXT, matched_by TEXT)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH bc AS (
    SELECT public.normalize_barcode(p_barcode) AS code
  ),
  nm AS (
    SELECT ' ' || COALESCE(public.normalize_name(p_name), '') || ' ' AS txt
  ),
  matches AS (
    -- 1) por prefijo de código de barras (grupo 1 = máxima confianza)
    SELECT r.brand            AS m_brand,
           r.manufacturer     AS m_manufacturer,
           'barcode'::TEXT    AS m_by,
           1                  AS m_group,
           length(r.match_value) AS m_len,
           r.priority         AS m_priority
      FROM public.brand_rules r
      CROSS JOIN bc
     WHERE r.match_type = 'barcode_prefix'
       AND bc.code IS NOT NULL
       AND bc.code LIKE r.match_value || '%'
    UNION ALL
    -- 2) por palabra clave en el nombre (grupo 2)
    SELECT r.brand, r.manufacturer, 'nombre'::TEXT, 2,
           length(r.match_value), r.priority
      FROM public.brand_rules r
      CROSS JOIN nm
     WHERE r.match_type = 'keyword'
       AND nm.txt LIKE '%' || r.match_value || '%'
  )
  SELECT m_brand, m_manufacturer, m_by
    FROM matches
   ORDER BY m_group, m_priority DESC, m_len DESC
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.guess_brand(TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) Semilla de reglas — mercado colombiano
-- ─────────────────────────────────────────────────────────────

-- 3a) Prefijos GS1 observados en la base (los más confiables)
INSERT INTO public.brand_rules (match_type, match_value, brand, manufacturer, priority) VALUES
  ('barcode_prefix', '7702025', 'Coca-Cola',        'Coca-Cola FEMSA',        100),
  ('barcode_prefix', '7702535', 'Brisa',            'Coca-Cola FEMSA',        100),
  ('barcode_prefix', '7702090', 'Agua Cristal',     'Postobón',               100),
  ('barcode_prefix', '7702192', 'H2Oh!',            'Postobón',               100),
  ('barcode_prefix', '7702189', 'Margarita',        'PepsiCo (Frito-Lay)',    100),
  ('barcode_prefix', '7702024', 'Nestlé',           'Nestlé',                 100),
  ('barcode_prefix', '7702007', 'Nutresa',          'Grupo Nutresa',          100),
  ('barcode_prefix', '7707244', 'Cielo',            'Grupo AJE',              100)
ON CONFLICT (match_type, match_value) DO NOTHING;

-- 3b) Palabras clave por marca (normalizadas: minúsculas, sin tildes)
INSERT INTO public.brand_rules (match_type, match_value, brand, manufacturer, priority) VALUES
  -- ── Coca-Cola Company / FEMSA ──────────────────────────────
  ('keyword', 'coca cola',    'Coca-Cola',      'Coca-Cola FEMSA', 90),
  ('keyword', 'cocacola',     'Coca-Cola',      'Coca-Cola FEMSA', 90),
  ('keyword', 'sprite',       'Sprite',         'Coca-Cola FEMSA', 80),
  ('keyword', 'fanta',        'Fanta',          'Coca-Cola FEMSA', 80),
  ('keyword', 'brisa',        'Brisa',          'Coca-Cola FEMSA', 80),
  ('keyword', 'powerade',     'Powerade',       'Coca-Cola FEMSA', 80),
  ('keyword', 'del valle',    'Del Valle',      'Coca-Cola FEMSA', 80),
  ('keyword', 'manantial',    'Agua Manantial', 'Coca-Cola FEMSA', 80),
  ('keyword', 'schweppes',    'Schweppes',      'Coca-Cola FEMSA', 80),
  -- ── Postobón (Organización Ardila Lülle) ───────────────────
  ('keyword', 'postobon',     'Postobón',       'Postobón', 90),
  ('keyword', 'colombiana',   'Colombiana',     'Postobón', 80),
  ('keyword', 'quatro',       'Quatro',         'Postobón', 80),
  ('keyword', 'agua cristal', 'Agua Cristal',   'Postobón', 85),
  ('keyword', 'cristal',      'Agua Cristal',   'Postobón', 70),
  ('keyword', 'h2o',          'H2Oh!',          'Postobón', 75),
  ('keyword', 'hit',          'Hit',            'Postobón', 75),
  ('keyword', 'mr tea',       'Mr. Tea',        'Postobón', 80),
  ('keyword', 'bretana',      'Bretaña',        'Postobón', 80),
  ('keyword', 'hipinto',      'Hipinto',        'Postobón', 80),
  ('keyword', 'popular',      'Popular',        'Postobón', 60),
  ('keyword', 'squash',       'Squash',         'Postobón', 80),
  ('keyword', 'peak',         'Peak',           'Postobón', 70),
  ('keyword', 'pepsi',        'Pepsi',          'Postobón (PepsiCo)', 85),
  ('keyword', '7up',          '7UP',            'Postobón (PepsiCo)', 85),
  ('keyword', 'seven up',     '7UP',            'Postobón (PepsiCo)', 85),
  ('keyword', 'gatorade',     'Gatorade',       'Postobón (PepsiCo)', 85),
  -- ── Bavaria (AB InBev) ─────────────────────────────────────
  ('keyword', 'aguila',       'Águila',         'Bavaria', 80),
  ('keyword', 'poker',        'Poker',          'Bavaria', 80),
  ('keyword', 'club colombia','Club Colombia',  'Bavaria', 85),
  ('keyword', 'costena',      'Costeña',        'Bavaria', 80),
  ('keyword', 'pilsen',       'Pilsen',         'Bavaria', 80),
  ('keyword', 'redds',        'Redd''s',         'Bavaria', 80),
  ('keyword', 'pony malta',   'Pony Malta',     'Bavaria', 85),
  ('keyword', 'cola y pola',  'Cola y Pola',    'Bavaria', 85),
  -- ── Otras bebidas ──────────────────────────────────────────
  ('keyword', 'cielo',        'Cielo',          'Grupo AJE', 75),
  ('keyword', 'big cola',     'Big Cola',       'Grupo AJE', 85),
  ('keyword', 'volt',         'Volt',           'Grupo AJE', 75),
  ('keyword', 'electrolit',   'Electrolit',     'Pisa Farmacéutica', 85),
  ('keyword', 'red bull',     'Red Bull',       'Red Bull', 85),
  ('keyword', 'monster',      'Monster',        'Monster Beverage', 85),
  ('keyword', 'vive100',      'Vive 100',       'Quala', 85),
  ('keyword', 'vive 100',     'Vive 100',       'Quala', 85),
  ('keyword', 'speed max',    'Speed Max',      'Postobón', 85),
  ('keyword', 'amper',        'Amper',          'Amper', 75),
  ('keyword', 'hatsu',        'Hatsu',          'Postobón', 80),
  -- ── Snacks y galletas ──────────────────────────────────────
  ('keyword', 'margarita',    'Margarita',      'PepsiCo (Frito-Lay)', 80),
  ('keyword', 'detodito',     'De Todito',      'PepsiCo (Frito-Lay)', 85),
  ('keyword', 'de todito',    'De Todito',      'PepsiCo (Frito-Lay)', 85),
  ('keyword', 'doritos',      'Doritos',        'PepsiCo (Frito-Lay)', 85),
  ('keyword', 'chitos',       'Chitos',         'PepsiCo (Frito-Lay)', 85),
  ('keyword', 'cheetos',      'Cheetos',        'PepsiCo (Frito-Lay)', 85),
  ('keyword', 'natuchips',    'Natuchips',      'PepsiCo (Frito-Lay)', 85),
  ('keyword', 'yupi',         'Yupi',           'Yupi', 80),
  ('keyword', 'rizadas',      'Rizadas',        'Yupi', 80),
  ('keyword', 'tosti',        'Tosti',          'Yupi', 75),
  ('keyword', 'noel',         'Noel',           'Grupo Nutresa', 80),
  ('keyword', 'festival',     'Festival',       'Grupo Nutresa', 80),
  ('keyword', 'ducales',      'Ducales',        'Grupo Nutresa', 85),
  ('keyword', 'saltin',       'Saltín',         'Grupo Nutresa', 85),
  ('keyword', 'tosh',         'Tosh',           'Grupo Nutresa', 80),
  ('keyword', 'oreo',         'Oreo',           'Mondelez', 85),
  ('keyword', 'chocmelos',    'Chocmelos',      'Grupo Nutresa', 85),
  ('keyword', 'jet',          'Jet',            'Grupo Nutresa', 75),
  ('keyword', 'jumbo',        'Jumbo',          'Grupo Nutresa', 70),
  ('keyword', 'gol',          'Gol',            'Grupo Nutresa', 70),
  ('keyword', 'bon bon bum',  'Bon Bon Bum',    'Colombina', 85),
  ('keyword', 'bonbonbum',    'Bon Bon Bum',    'Colombina', 85),
  ('keyword', 'colombina',    'Colombina',      'Colombina', 85),
  ('keyword', 'trululu',      'Trululu',        'Colombina', 85),
  ('keyword', 'nucita',       'Nucita',         'Colombina', 85),
  ('keyword', 'halls',        'Halls',          'Mondelez', 85),
  ('keyword', 'chiclets',     'Chiclets',       'Mondelez', 85),
  ('keyword', 'trident',      'Trident',        'Mondelez', 85),
  -- ── Panadería ──────────────────────────────────────────────
  ('keyword', 'chocorramo',   'Chocorramo',     'Ramo', 90),
  ('keyword', 'ramo',         'Ramo',           'Ramo', 70),
  ('keyword', 'gala',         'Ponqué Gala',    'Ramo', 70),
  ('keyword', 'bimbo',        'Bimbo',          'Grupo Bimbo', 85),
  -- ── Lácteos ────────────────────────────────────────────────
  ('keyword', 'alpina',       'Alpina',         'Alpina', 85),
  ('keyword', 'alqueria',     'Alquería',       'Alquería', 85),
  ('keyword', 'colanta',      'Colanta',        'Colanta', 85),
  ('keyword', 'parmalat',     'Parmalat',       'Parmalat', 85),
  ('keyword', 'san fernando', 'San Fernando',   'Alquería', 80),
  -- ── Café y bebidas calientes ───────────────────────────────
  ('keyword', 'nescafe',      'Nescafé',        'Nestlé', 85),
  ('keyword', 'milo',         'Milo',           'Nestlé', 85),
  ('keyword', 'colcafe',      'Colcafé',        'Grupo Nutresa', 85),
  ('keyword', 'sello rojo',   'Sello Rojo',     'Grupo Nutresa', 85),
  ('keyword', 'aguila roja',  'Águila Roja',    'Águila Roja', 85),
  ('keyword', 'juan valdez',  'Juan Valdez',    'Procafecol', 85),
  ('keyword', 'corona',       'Chocolate Corona','Grupo Nutresa', 70),
  -- ── Cárnicos y despensa ────────────────────────────────────
  ('keyword', 'zenu',         'Zenú',           'Grupo Nutresa', 85),
  ('keyword', 'ranchera',     'Ranchera',       'Grupo Nutresa', 85),
  ('keyword', 'pietran',      'Pietrán',        'Grupo Nutresa', 85),
  ('keyword', 'fruco',        'Fruco',          'Unilever', 85),
  ('keyword', 'maggi',        'Maggi',          'Nestlé', 85),
  ('keyword', 'knorr',        'Knorr',          'Unilever', 85),
  ('keyword', 'doria',        'Doria',          'Grupo Nutresa', 85),
  ('keyword', 'diana',        'Diana',          'Diana Corporación', 80),
  ('keyword', 'roa',          'Roa',            'Arroz Roa', 75),
  ('keyword', 'florhuila',    'Flor Huila',     'Arroz Flor Huila', 85),
  ('keyword', 'flor huila',   'Flor Huila',     'Arroz Flor Huila', 85),
  ('keyword', 'gustapan',     'Gustapan',       'Grupo Nutresa', 85),
  ('keyword', 'van camps',    'Van Camp''s',     'Van Camps', 85),
  ('keyword', 'la constancia','La Constancia',  'La Constancia', 85),
  -- ── Aseo personal y hogar ──────────────────────────────────
  ('keyword', 'familia',      'Familia',        'Grupo Familia', 80),
  ('keyword', 'nosotras',     'Nosotras',       'Grupo Familia', 85),
  ('keyword', 'pequenin',     'Pequeñín',       'Grupo Familia', 85),
  ('keyword', 'scott',        'Scott',          'Kimberly-Clark', 85),
  ('keyword', 'kotex',        'Kotex',          'Kimberly-Clark', 85),
  ('keyword', 'huggies',      'Huggies',        'Kimberly-Clark', 85),
  ('keyword', 'winny',        'Winny',          'Tecnoquímicas', 85),
  ('keyword', 'pampers',      'Pampers',        'Procter & Gamble', 85),
  ('keyword', 'ariel',        'Ariel',          'Procter & Gamble', 85),
  ('keyword', 'ace',          'Ace',            'Procter & Gamble', 70),
  ('keyword', 'fab',          'Fab',            'Unilever', 70),
  ('keyword', 'colgate',      'Colgate',        'Colgate-Palmolive', 85),
  ('keyword', 'palmolive',    'Palmolive',      'Colgate-Palmolive', 85),
  ('keyword', 'protex',       'Protex',         'Colgate-Palmolive', 85),
  ('keyword', 'rexona',       'Rexona',         'Unilever', 85),
  ('keyword', 'axe',          'Axe',            'Unilever', 80),
  ('keyword', 'dove',         'Dove',           'Unilever', 85),
  ('keyword', 'sedal',        'Sedal',          'Unilever', 85),
  ('keyword', 'savital',      'Savital',        'Unilever', 85),
  ('keyword', 'head shoulders','Head & Shoulders','Procter & Gamble', 85),
  ('keyword', 'clorox',       'Clorox',         'Clorox', 85),
  ('keyword', 'axion',        'Axión',          'Colgate-Palmolive', 85),
  ('keyword', 'lavaloza',     'Lavaloza',       NULL, 40),
  -- ── Cigarrillos ────────────────────────────────────────────
  ('keyword', 'marlboro',     'Marlboro',       'Philip Morris', 85),
  ('keyword', 'lucky',        'Lucky Strike',   'BAT', 80),
  ('keyword', 'rothmans',     'Rothmans',       'BAT', 85),
  ('keyword', 'boston',       'Boston',         'BAT', 80)
ON CONFLICT (match_type, match_value) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4) Marca en el catálogo maestro
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.catalog_template_items
  ADD COLUMN IF NOT EXISTS brand        TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT;

CREATE INDEX IF NOT EXISTS idx_catalog_items_brand
  ON public.catalog_template_items (brand) WHERE brand IS NOT NULL;

/** Reclasifica los ítems de un catálogo (o de todos si se pasa NULL). */
CREATE OR REPLACE FUNCTION public.reclassify_catalog_brands(p_template_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF NOT (SELECT public.is_super_admin()) THEN
    RAISE EXCEPTION 'Solo el administrador de la plataforma puede reclasificar'
      USING ERRCODE = '42501';
  END IF;

  WITH upd AS (
    UPDATE public.catalog_template_items i
       SET brand        = g.brand,
           manufacturer = g.manufacturer
      FROM LATERAL public.guess_brand(i.name::TEXT, i.barcode::TEXT) g
     WHERE (p_template_id IS NULL OR i.template_id = p_template_id)
       AND g.brand IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reclassify_catalog_brands(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5) discover_tenant_products v5 — devuelve marca y filtra por marca
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, UUID, INT);

CREATE OR REPLACE FUNCTION public.discover_tenant_products(
  p_search            TEXT    DEFAULT NULL,
  p_only_with_image   BOOLEAN DEFAULT TRUE,
  p_hide_in_catalog   BOOLEAN DEFAULT TRUE,
  p_only_with_barcode BOOLEAN DEFAULT FALSE,
  p_tenant_id         UUID    DEFAULT NULL,
  p_brand             TEXT    DEFAULT NULL,
  p_limit             INT     DEFAULT 200
)
RETURNS TABLE (
  name         TEXT,
  category     TEXT,
  barcode      TEXT,
  brand        TEXT,
  manufacturer TEXT,
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
      public.normalize_name(p.name::TEXT)          AS p_namekey,
      public.normalize_barcode(p.barcode::TEXT)    AS p_barcode,
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
  branded AS (
    SELECT a.*, gb.brand AS g_brand, gb.manufacturer AS g_manufacturer
      FROM agg a
      LEFT JOIN LATERAL public.guess_brand(a.g_name, a.g_barcode) gb ON TRUE
  ),
  flagged AS (
    SELECT b.*,
      EXISTS (
        SELECT 1 FROM public.catalog_template_items i
         WHERE public.normalize_name(i.name::TEXT) = public.normalize_name(b.g_name::TEXT)
            OR (b.g_barcode IS NOT NULL
                AND public.normalize_barcode(i.barcode::TEXT) = b.g_barcode)
      ) AS g_in_catalog
    FROM branded b
  )
  SELECT
    f.g_name, f.g_category, f.g_barcode, f.g_brand, f.g_manufacturer,
    f.g_tenants, f.g_variants, f.g_image, f.g_in_catalog
  FROM flagged f
  WHERE (p_search IS NULL OR btrim(p_search) = ''
         OR f.g_name ILIKE '%' || btrim(p_search) || '%'
         OR f.g_barcode LIKE '%' || public.normalize_barcode(p_search::TEXT) || '%')
    AND (NOT p_only_with_image   OR f.g_image   IS NOT NULL)
    AND (NOT p_only_with_barcode OR f.g_barcode IS NOT NULL)
    AND (NOT p_hide_in_catalog   OR NOT f.g_in_catalog)
    AND (p_brand IS NULL OR btrim(p_brand) = ''
         OR f.g_brand = p_brand OR f.g_manufacturer = p_brand)
  ORDER BY f.g_brand NULLS LAST, f.g_tenants DESC, f.g_name
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_tenant_products(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, UUID, TEXT, INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6) Resumen: cuántos productos hay por marca / fabricante
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_brand_stats()
RETURNS TABLE (
  brand        TEXT,
  manufacturer TEXT,
  products     BIGINT,
  tenants      BIGINT
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
      btrim(p.name) AS p_name,
      p.barcode::TEXT AS p_barcode
    FROM public.products p
    WHERE p.deleted_at IS NULL
      AND public.normalize_name(p.name::TEXT) IS NOT NULL
  ),
  uniq AS (
    SELECT g_key,
           mode() WITHIN GROUP (ORDER BY p_name) AS u_name,
           (array_agg(p_barcode) FILTER (WHERE p_barcode IS NOT NULL))[1] AS u_barcode,
           count(DISTINCT t_id) AS u_tenants
      FROM prods GROUP BY g_key
  )
  SELECT gb.brand, gb.manufacturer, count(*)::BIGINT, sum(u.u_tenants)::BIGINT
    FROM uniq u
    LEFT JOIN LATERAL public.guess_brand(u.u_name, u.u_barcode) gb ON TRUE
   WHERE gb.brand IS NOT NULL
   GROUP BY gb.brand, gb.manufacturer
   ORDER BY count(*) DESC, gb.brand;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_brand_stats() TO authenticated;
