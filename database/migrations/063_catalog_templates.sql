-- ============================================================
-- REG-X — Migration 063: Catálogos maestros (onboarding rápido)
-- ------------------------------------------------------------
-- Problema: cada tenant nuevo arranca con la base de productos
-- vacía. Cargar 200 productos a mano hace que la instalación se
-- caiga antes de empezar.
--
-- Solución: catálogos maestros de la PLATAFORMA (Tienda de barrio,
-- Restaurante, etc.) con nombre, categoría e imagen. Desde el panel
-- se aplica un catálogo a cualquier tenant en un clic: crea las
-- categorías que falten e inserta los productos que no tenga.
--
-- Las imágenes viven UNA sola vez en el bucket 'catalog-assets' y
-- todos los tenants las referencian por URL (no se duplican).
--
-- Precios: quedan en 0 — cada negocio pone los suyos.
-- Idempotente. Ejecutar después de la 062.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) Tablas del catálogo maestro
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  /** Tipo de negocio sugerido: STORE, RESTAURANT, PHARMACY… (informativo) */
  business_type TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_template_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.catalog_templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT,
  image_url   TEXT,
  barcode     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_template
  ON public.catalog_template_items (template_id, sort_order);

-- Evita duplicar el mismo producto dentro de una plantilla
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_item_name
  ON public.catalog_template_items (template_id, lower(name));

-- ─────────────────────────────────────────────────────────────
-- 2) RLS: catálogo global de lectura; solo SUPER_ADMIN escribe
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.catalog_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_templates_read" ON public.catalog_templates;
CREATE POLICY "catalog_templates_read" ON public.catalog_templates
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "catalog_templates_write" ON public.catalog_templates;
CREATE POLICY "catalog_templates_write" ON public.catalog_templates
  FOR ALL USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "catalog_items_read" ON public.catalog_template_items;
CREATE POLICY "catalog_items_read" ON public.catalog_template_items
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "catalog_items_write" ON public.catalog_template_items;
CREATE POLICY "catalog_items_write" ON public.catalog_template_items
  FOR ALL USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

-- ─────────────────────────────────────────────────────────────
-- 3) Bucket público para las imágenes del catálogo
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-assets', 'catalog-assets', TRUE, 2097152,
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = TRUE,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp'];

DROP POLICY IF EXISTS "Public View Catalog Assets" ON storage.objects;
CREATE POLICY "Public View Catalog Assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'catalog-assets' );

DROP POLICY IF EXISTS "Super Admin Insert Catalog Assets" ON storage.objects;
CREATE POLICY "Super Admin Insert Catalog Assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'catalog-assets' AND (SELECT public.is_super_admin()) );

DROP POLICY IF EXISTS "Super Admin Update Catalog Assets" ON storage.objects;
CREATE POLICY "Super Admin Update Catalog Assets"
ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id = 'catalog-assets' AND (SELECT public.is_super_admin()) )
WITH CHECK ( bucket_id = 'catalog-assets' AND (SELECT public.is_super_admin()) );

DROP POLICY IF EXISTS "Super Admin Delete Catalog Assets" ON storage.objects;
CREATE POLICY "Super Admin Delete Catalog Assets"
ON storage.objects FOR DELETE TO authenticated
USING ( bucket_id = 'catalog-assets' AND (SELECT public.is_super_admin()) );

-- ─────────────────────────────────────────────────────────────
-- 4) RPC: aplicar un catálogo a un tenant
--    - Crea las categorías que falten (por nombre).
--    - Inserta solo los productos que el tenant NO tenga
--      (comparando por nombre, sin distinguir mayúsculas).
--    - NO toca precios ni productos existentes: es seguro
--      re-ejecutarlo para "completar" un catálogo.
--    Devuelve: { created, skipped, categories_created }
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_catalog_template(
  p_tenant_id   UUID,
  p_template_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        RECORD;
  v_cat_id      UUID;
  v_created     INT := 0;
  v_skipped     INT := 0;
  v_cats_new    INT := 0;
  v_stamp       TEXT := to_char(now(), 'YYMMDDHH24MISS');
  v_seq         INT := 0;
BEGIN
  -- Solo el super admin de la plataforma o el dueño/admin del tenant
  IF NOT ((SELECT public.is_super_admin())
          OR (user_belongs_to_tenant(p_tenant_id)
              AND user_role_in_tenant(p_tenant_id) IN ('OWNER','ADMIN'))) THEN
    RAISE EXCEPTION 'No autorizado para cargar catálogos en este negocio'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.catalog_templates WHERE id = p_template_id) THEN
    RAISE EXCEPTION 'El catálogo indicado no existe';
  END IF;

  FOR v_item IN
    SELECT * FROM public.catalog_template_items
     WHERE template_id = p_template_id
     ORDER BY sort_order, name
  LOOP
    -- ¿El tenant ya tiene un producto con ese nombre?
    IF EXISTS (
      SELECT 1 FROM public.products
       WHERE tenant_id = p_tenant_id
         AND lower(name) = lower(v_item.name)
         AND deleted_at IS NULL
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Categoría: reutilizar la existente o crearla
    v_cat_id := NULL;
    IF v_item.category IS NOT NULL AND btrim(v_item.category) <> '' THEN
      SELECT id INTO v_cat_id
        FROM public.categories
       WHERE tenant_id = p_tenant_id
         AND lower(name) = lower(btrim(v_item.category))
         AND deleted_at IS NULL
       LIMIT 1;

      IF v_cat_id IS NULL THEN
        INSERT INTO public.categories (tenant_id, name, is_active)
        VALUES (p_tenant_id, btrim(v_item.category), TRUE)
        RETURNING id INTO v_cat_id;
        v_cats_new := v_cats_new + 1;
      END IF;
    END IF;

    -- Producto: precio en 0 (cada negocio pone el suyo)
    v_seq := v_seq + 1;
    INSERT INTO public.products (
      tenant_id, name, sku, barcode, category_id,
      price, cost_price, image_url, status, min_stock
    ) VALUES (
      p_tenant_id,
      v_item.name,
      'CAT-' || v_stamp || '-' || v_seq,
      NULLIF(btrim(COALESCE(v_item.barcode, '')), ''),
      v_cat_id,
      0, NULL,
      v_item.image_url,
      'ACTIVE',
      0
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'categories_created', v_cats_new
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_catalog_template(UUID, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5) Semilla: catálogo base de tienda de barrio (Colombia)
--    Sin imágenes (se cargan desde el panel) y sin precios.
--    Los códigos de barras se dejan vacíos a propósito: varían por
--    presentación y el tendero los escanea al recibir mercancía.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.catalog_templates (name, slug, description, business_type)
VALUES (
  'Tienda de barrio', 'tienda-barrio',
  'Productos comunes de tienda: bebidas, snacks, aseo, granos y víveres.',
  'STORE'
)
ON CONFLICT (slug) DO NOTHING;

WITH t AS (SELECT id FROM public.catalog_templates WHERE slug = 'tienda-barrio'),
items(name, category, sort_order) AS (VALUES
  -- Gaseosas y bebidas
  ('Coca-Cola 400ml',            'Gaseosas', 1),
  ('Coca-Cola 1.5L',             'Gaseosas', 2),
  ('Coca-Cola Zero 400ml',       'Gaseosas', 3),
  ('Postobón Manzana 400ml',     'Gaseosas', 4),
  ('Postobón Uva 400ml',         'Gaseosas', 5),
  ('Colombiana 400ml',           'Gaseosas', 6),
  ('Pepsi 400ml',                'Gaseosas', 7),
  ('Sprite 400ml',               'Gaseosas', 8),
  ('Quatro 400ml',               'Gaseosas', 9),
  ('Agua sin gas 600ml',         'Bebidas', 10),
  ('Agua con gas 600ml',         'Bebidas', 11),
  ('Electrolit',                 'Bebidas', 12),
  ('Gatorade 500ml',             'Bebidas', 13),
  ('Hit Naranja 500ml',          'Bebidas', 14),
  ('Hit Mora 500ml',             'Bebidas', 15),
  ('Té Hatsu',                   'Bebidas', 16),
  ('Mr. Tea 400ml',              'Bebidas', 17),
  ('Jugo Del Valle 500ml',       'Bebidas', 18),
  ('Avena Alpina 250ml',         'Bebidas', 19),
  ('Yogurt Alpina 200g',         'Lácteos', 20),
  ('Leche entera 1L',            'Lácteos', 21),
  ('Leche deslactosada 1L',      'Lácteos', 22),
  ('Kumis 200ml',                'Lácteos', 23),
  ('Queso campesino 250g',       'Lácteos', 24),
  -- Snacks / mecato
  ('Papas Margarita Pollo',      'Snacks', 30),
  ('Papas Margarita Limón',      'Snacks', 31),
  ('Papas Margarita Natural',    'Snacks', 32),
  ('De Todito',                  'Snacks', 33),
  ('Doritos',                    'Snacks', 34),
  ('Chitos',                     'Snacks', 35),
  ('Platanitos',                 'Snacks', 36),
  ('Maní salado',                'Snacks', 37),
  ('Galletas Festival',          'Galletas', 38),
  ('Galletas Ducales',           'Galletas', 39),
  ('Galletas Saltín Noel',       'Galletas', 40),
  ('Galletas Oreo',              'Galletas', 41),
  ('Ponqué Gala',                'Panadería', 42),
  ('Chocorramo',                 'Panadería', 43),
  ('Pan tajado',                 'Panadería', 44),
  -- Dulces
  ('Jet chocolatina',            'Dulces', 50),
  ('Jumbo maní',                 'Dulces', 51),
  ('Bon Bon Bum',                'Dulces', 52),
  ('Trululu',                    'Dulces', 53),
  ('Chiclets',                   'Dulces', 54),
  ('Halls',                      'Dulces', 55),
  -- Cigarrillos y otros
  ('Cigarrillo unidad',          'Cigarrillos', 60),
  ('Cigarrillos cajetilla',      'Cigarrillos', 61),
  -- Víveres y abarrotes
  ('Arroz 500g',                 'Granos', 70),
  ('Arroz 1000g',                'Granos', 71),
  ('Lenteja 500g',               'Granos', 72),
  ('Fríjol 500g',                'Granos', 73),
  ('Pasta espagueti 250g',       'Granos', 74),
  ('Aceite 500ml',               'Abarrotes', 75),
  ('Panela',                     'Abarrotes', 76),
  ('Azúcar 500g',                'Abarrotes', 77),
  ('Sal 500g',                   'Abarrotes', 78),
  ('Café 250g',                  'Abarrotes', 79),
  ('Chocolate en pastilla',      'Abarrotes', 80),
  ('Atún lata',                  'Enlatados', 81),
  ('Sardina lata',               'Enlatados', 82),
  ('Salsa de tomate',            'Abarrotes', 83),
  ('Mayonesa',                   'Abarrotes', 84),
  ('Huevos unidad',              'Huevos', 85),
  ('Huevos panal x30',           'Huevos', 86),
  -- Aseo personal y hogar
  ('Jabón de baño',              'Aseo personal', 90),
  ('Crema dental',               'Aseo personal', 91),
  ('Papel higiénico x4',         'Aseo hogar', 92),
  ('Detergente 500g',            'Aseo hogar', 93),
  ('Jabón loza',                 'Aseo hogar', 94),
  ('Blanqueador 1L',             'Aseo hogar', 95),
  ('Toalla higiénica',           'Aseo personal', 96),
  ('Pañal unidad',               'Bebé', 97),
  ('Shampoo sachet',             'Aseo personal', 98),
  -- Varios
  ('Vela',                       'Varios', 100),
  ('Fósforos',                   'Varios', 101),
  ('Pilas AA',                   'Varios', 102),
  ('Bolsa de hielo',             'Varios', 103)
)
INSERT INTO public.catalog_template_items (template_id, name, category, sort_order)
SELECT t.id, i.name, i.category, i.sort_order
  FROM t CROSS JOIN items i
ON CONFLICT (template_id, lower(name)) DO NOTHING;

COMMENT ON TABLE public.catalog_templates IS
  'Catálogos maestros de la plataforma para poblar productos de tenants nuevos.';
