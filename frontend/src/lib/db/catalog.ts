/**
 * REG-X — Capa de datos Supabase · dominio: catálogos maestros
 * Catálogos de la PLATAFORMA (Tienda de barrio, Restaurante…) que se
 * aplican a un tenant para poblarle los productos de entrada.
 * Ver database/migrations/063_catalog_templates.sql
 */
import { supabase } from '../supabase'

export interface CatalogTemplateRow {
  id: string
  name: string
  slug: string
  description: string | null
  business_type: string | null
  is_active: boolean
  created_at: string
  /** Conteo de productos (viene del select con count) */
  item_count?: number
}

export interface CatalogItemRow {
  id: string
  template_id: string
  name: string
  category: string | null
  image_url: string | null
  barcode: string | null
  brand?: string | null
  manufacturer?: string | null
  sort_order: number
}

// ── Plantillas ─────────────────────────────────────────────────
export async function getCatalogTemplates(): Promise<CatalogTemplateRow[]> {
  const { data, error } = await supabase
    .from('catalog_templates')
    .select('id, name, slug, description, business_type, is_active, created_at, catalog_template_items(count)')
    .order('name')
  if (error) throw error
  return (data ?? []).map((t: any) => ({
    ...t,
    item_count: t.catalog_template_items?.[0]?.count ?? 0,
  })) as CatalogTemplateRow[]
}

export async function createCatalogTemplate(input: {
  name: string
  description?: string
  business_type?: string
}): Promise<CatalogTemplateRow> {
  const slug = input.name.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const { data, error } = await supabase
    .from('catalog_templates')
    .insert({
      name: input.name.trim(),
      slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
      description: input.description?.trim() || null,
      business_type: input.business_type || null,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data as unknown as CatalogTemplateRow
}

export async function updateCatalogTemplate(
  id: string,
  patch: { name?: string; description?: string | null; business_type?: string | null; is_active?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('catalog_templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCatalogTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('catalog_templates').delete().eq('id', id)
  if (error) throw error
}

// ── Ítems del catálogo ─────────────────────────────────────────
export async function getCatalogItems(templateId: string): Promise<CatalogItemRow[]> {
  const { data, error } = await supabase
    .from('catalog_template_items')
    .select('id, template_id, name, category, image_url, barcode, brand, manufacturer, sort_order')
    .eq('template_id', templateId)
    .order('sort_order')
    .order('name')
    .limit(2000)
  if (error) throw error
  return (data ?? []) as CatalogItemRow[]
}

export async function addCatalogItem(input: {
  template_id: string
  name: string
  category?: string
  image_url?: string | null
  barcode?: string | null
  brand?: string | null
  manufacturer?: string | null
  sort_order?: number
}): Promise<CatalogItemRow> {
  const { data, error } = await supabase
    .from('catalog_template_items')
    .insert({
      template_id: input.template_id,
      name: input.name.trim(),
      category: input.category?.trim() || null,
      image_url: input.image_url ?? null,
      barcode: input.barcode?.trim() || null,
      brand: input.brand ?? null,
      manufacturer: input.manufacturer ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return data as unknown as CatalogItemRow
}

export async function updateCatalogItem(
  id: string,
  patch: { name?: string; category?: string | null; image_url?: string | null; barcode?: string | null },
): Promise<void> {
  const { error } = await supabase.from('catalog_template_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteCatalogItem(id: string): Promise<void> {
  const { error } = await supabase.from('catalog_template_items').delete().eq('id', id)
  if (error) throw error
}

/** Carga masiva de ítems (pegar una lista de nombres). Omite los repetidos. */
export async function bulkAddCatalogItems(
  templateId: string,
  rows: { name: string; category?: string }[],
): Promise<number> {
  const clean = rows
    .map(r => ({ name: r.name.trim(), category: r.category?.trim() || null }))
    .filter(r => r.name.length > 0)
  if (clean.length === 0) return 0

  // Filtrar contra lo que ya existe en la plantilla (el índice único es sobre
  // lower(name), así que la comparación se hace en minúsculas).
  const { data: existing, error: exErr } = await supabase
    .from('catalog_template_items')
    .select('name, sort_order')
    .eq('template_id', templateId)
    .limit(5000)
  if (exErr) throw exErr

  const taken = new Set((existing ?? []).map((e: any) => String(e.name).trim().toLowerCase()))
  const startOrder = Math.max(0, ...(existing ?? []).map((e: any) => Number(e.sort_order) || 0)) + 1

  const seen = new Set<string>()
  const toInsert = clean.filter(r => {
    const key = r.name.toLowerCase()
    if (taken.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (toInsert.length === 0) return 0

  const { data, error } = await supabase
    .from('catalog_template_items')
    .insert(toInsert.map((r, i) => ({ template_id: templateId, ...r, sort_order: startOrder + i })))
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

// ── Imágenes ───────────────────────────────────────────────────
/** Sube la imagen de un producto del catálogo (bucket público compartido). */
export async function uploadCatalogImage(file: File): Promise<string | null> {
  try {
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from('catalog-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) return null
    const { data } = supabase.storage.from('catalog-assets').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}

// ── Descubrir productos de los clientes (migración 064) ────────
export interface DiscoveredProduct {
  name: string
  category: string | null
  /** Código de barras (EAN/UPC): identificador universal del producto */
  barcode: string | null
  /** Marca detectada automáticamente (Coca-Cola, Postobón…) */
  brand: string | null
  /** Empresa fabricante */
  manufacturer: string | null
  tenant_count: number
  /** Cuántas filas de producto se consolidaron en esta tarjeta */
  variants?: number
  image_url: string | null
  in_catalog: boolean
}

/**
 * Productos de TODOS los tenants agrupados por nombre, con el número de
 * negocios en que aparece cada uno. Sirve para alimentar los catálogos
 * maestros con lo que los clientes ya cargaron. Solo SUPER_ADMIN.
 */
export async function discoverTenantProducts(params?: {
  search?: string
  onlyWithImage?: boolean
  hideInCatalog?: boolean
  onlyWithBarcode?: boolean
  /** Ver solo los productos de una empresa concreta */
  tenantId?: string | null
  /** Filtrar por marca o fabricante (Coca-Cola, Postobón…) */
  brand?: string | null
  limit?: number
}): Promise<DiscoveredProduct[]> {
  const base = {
    p_search:            params?.search?.trim() || null,
    p_only_with_image:   params?.onlyWithImage ?? true,
    p_hide_in_catalog:   params?.hideInCatalog ?? true,
    p_only_with_barcode: params?.onlyWithBarcode ?? false,
    p_limit:             params?.limit ?? 200,
  }

  // Se intenta con la firma más nueva; si la migración correspondiente aún
  // no está aplicada, se reintenta con las firmas anteriores para que la
  // pantalla siga funcionando (sin filtro de marca / de empresa).
  const variants = [
    { ...base, p_tenant_id: params?.tenantId || null, p_brand: params?.brand || null }, // 068
    { ...base, p_tenant_id: params?.tenantId || null },                                  // 067
    base,                                                                                // 066
  ]

  let data: unknown = null
  let error: { message?: string; code?: string } | null = null
  for (const args of variants) {
    const res = await (supabase.rpc as any)('discover_tenant_products', args)
    if (!res.error) { data = res.data; error = null; break }
    error = res.error
    // PGRST202 = función no encontrada con esa firma → probar la anterior
    const notFound = res.error?.code === 'PGRST202' ||
      /could not find the function|does not exist/i.test(res.error?.message ?? '')
    if (!notFound) break
  }
  if (error) throw error

  // Red de seguridad: si por algún motivo llegaran filas repetidas (código o
  // nombre equivalentes), se consolidan aquí sumando los negocios.
  const out = new Map<string, DiscoveredProduct>()
  for (const row of (data ?? []) as DiscoveredProduct[]) {
    const key = (row.barcode?.replace(/\D/g, '') || '')
      || row.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
           .replace(/[^a-z0-9]+/g, ' ').trim()
    const prev = out.get(key)
    if (prev) {
      prev.tenant_count = Math.max(prev.tenant_count, row.tenant_count)
      prev.image_url  ||= row.image_url
      prev.barcode    ||= row.barcode
      prev.category   ||= row.category
    } else {
      out.set(key, { ...row })
    }
  }
  return [...out.values()]
}

// ── Marcas (migración 068) ─────────────────────────────────────
export interface BrandStat {
  brand: string
  manufacturer: string | null
  products: number
  tenants: number
}

/** Cuántos productos distintos hay de cada marca en toda la plataforma. */
export async function getBrandStats(): Promise<BrandStat[]> {
  const { data, error } = await (supabase.rpc as any)('platform_brand_stats')
  if (error) throw error
  return (data ?? []) as BrandStat[]
}

export interface UnclassifiedProduct {
  name: string
  category: string | null
  barcode: string | null
  /** Primeros 7 dígitos: el prefijo del fabricante en GS1 */
  barcode_prefix: string | null
  tenant_count: number
  image_url: string | null
}

/** Productos que ninguna regla reconoció = marcas por enseñarle al sistema. */
export async function getUnclassifiedProducts(limit = 100): Promise<UnclassifiedProduct[]> {
  const { data, error } = await (supabase.rpc as any)('unclassified_products', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as UnclassifiedProduct[]
}

/** Crea una regla de marca (por prefijo de código de barras o por palabra). */
export async function addBrandRule(input: {
  matchType: 'barcode_prefix' | 'keyword'
  matchValue: string
  brand: string
  manufacturer?: string
  priority?: number
}): Promise<void> {
  const { error } = await supabase.from('brand_rules').insert({
    match_type:   input.matchType,
    match_value:  input.matchValue.trim().toLowerCase(),
    brand:        input.brand.trim(),
    manufacturer: input.manufacturer?.trim() || null,
    priority:     input.priority ?? (input.matchType === 'barcode_prefix' ? 100 : 80),
  })
  if (error) throw error
}

export interface GenerateCatalogsResult {
  catalogs_created: number
  items_created: number
  skipped: number
}

/**
 * Genera catálogos maestros automáticamente a partir de los productos de
 * los clientes, agrupados por fabricante (Coca-Cola FEMSA, Postobón…).
 * Se puede repetir: no duplica, solo completa.
 */
export async function generateBrandCatalogs(params?: {
  minTenants?: number
  onlyWithImage?: boolean
  byManufacturer?: boolean
}): Promise<GenerateCatalogsResult> {
  const { data, error } = await (supabase.rpc as any)('generate_brand_catalogs', {
    p_min_tenants:     params?.minTenants ?? 1,
    p_only_with_image: params?.onlyWithImage ?? false,
    p_by_manufacturer: params?.byManufacturer ?? true,
  })
  if (error) throw error
  return data as GenerateCatalogsResult
}

/** Borra los catálogos generados automáticamente (slug 'auto-…'). */
export async function deleteAutoCatalogs(): Promise<number> {
  const { data, error } = await (supabase.rpc as any)('delete_auto_catalogs')
  if (error) throw error
  return Number(data ?? 0)
}

/** Reclasifica las marcas de un catálogo (o de todos si no se pasa id). */
export async function reclassifyCatalogBrands(templateId?: string): Promise<number> {
  const { data, error } = await (supabase.rpc as any)('reclassify_catalog_brands', {
    p_template_id: templateId ?? null,
  })
  if (error) throw error
  return Number(data ?? 0)
}

// ── Resumen de productos por empresa (migración 067) ───────────
export interface TenantProductStats {
  tenant_id: string
  tenant_name: string
  business_type: string | null
  total_products: number
  unique_products: number
  /** Filas repetidas dentro de la propia base del cliente */
  duplicates: number
  with_image: number
  with_barcode: number
}

/** Cuántos productos tiene cada empresa y qué tan limpio está su catálogo. */
export async function getTenantProductStats(): Promise<TenantProductStats[]> {
  const { data, error } = await (supabase.rpc as any)('platform_product_stats')
  if (error) throw error
  return (data ?? []) as TenantProductStats[]
}

/**
 * Copia una imagen de un tenant al bucket del catálogo maestro.
 * Así la imagen del catálogo no depende de que el cliente borre la suya.
 */
export async function copyImageToCatalog(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    const ext  = (blob.type.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg')
    const path = `items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from('catalog-assets')
      .upload(path, blob, { upsert: true, contentType: blob.type })
    if (error) return null
    const { data } = supabase.storage.from('catalog-assets').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}

// ── Aplicar catálogo a un tenant ───────────────────────────────
export interface ApplyCatalogResult {
  created: number
  skipped: number
  categories_created: number
}

/**
 * Copia los productos del catálogo al tenant: crea las categorías que
 * falten e inserta solo los productos que el tenant aún no tenga.
 * No modifica productos existentes ni precios.
 */
export async function applyCatalogTemplate(
  tenantId: string,
  templateId: string,
): Promise<ApplyCatalogResult> {
  const { data, error } = await (supabase.rpc as any)('apply_catalog_template', {
    p_tenant_id:   tenantId,
    p_template_id: templateId,
  })
  if (error) throw error
  return data as ApplyCatalogResult
}
