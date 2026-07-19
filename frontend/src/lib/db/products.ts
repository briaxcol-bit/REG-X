/**
 * REG-X — Capa de datos Supabase · dominio: products
 * Generado a partir del split de lib/db.ts (no cambiar la ruta de import:
 * todo se re-exporta desde '@lib/db').
 */
import { supabase } from '../supabase'

export interface ProductRow {
  id: string
  tenant_id: string
  name: string
  sku: string
  barcode?: string | null
  price: number
  cost_price: number | null
  tax: number
  image_url: string | null
  status: string
  track_inventory: boolean
  category_id: string | null
  min_stock?: number
  max_stock?: number | null
  categories?: { name: string; color: string; track_inventory?: boolean } | null
  inventory?: { quantity: number; warehouse_id: string }[]
}

export interface CategoryRow {
  id: string
  tenant_id: string
  name: string
  color: string
  icon: string | null
  is_active: boolean
  /** FALSE = sus productos se venden sin validar stock (p. ej. platos preparados) */
  track_inventory: boolean
}

// ── Create Product ─────────────────────────────────────────────
export interface CreateProductPayload {
  name: string
  sku: string
  barcode?: string
  category_id?: string
  price: number
  cost_price?: number
  imageFile?: File | null      // archivo real para subir a Storage
  image_url?: string           // URL ya resuelta (edición)
  min_stock?: number
  initialStock?: number
  branchId?: string
}

export async function uploadProductImage(tenantId: string, file: File): Promise<string | null> {
  try {
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${tenantId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('products')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) return null
    const { data } = supabase.storage.from('products').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('tenant_id', tenantId)
  if (error) throw error
}

export async function getProduct(
  tenantId: string,
  productId: string,
): Promise<ProductRow | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, tenant_id, name, sku, barcode, price, cost_price, tax, image_url,
      status, track_inventory, category_id, min_stock,
      categories(name, color),
      inventory(quantity, warehouse_id)
    `)
    .eq('tenant_id', tenantId)
    .eq('id', productId)
    .is('deleted_at', null)
    .single()
  if (error) return null
  return data as unknown as ProductRow
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  payload: CreateProductPayload,
) {
  // 1. Subir nueva imagen si se seleccionó una
  let imageUrl: string | null = payload.image_url ?? null
  if (payload.imageFile) {
    imageUrl = await uploadProductImage(tenantId, payload.imageFile)
  }

  // 2. Actualizar producto
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .update({
      name:        payload.name,
      sku:         payload.sku || undefined,
      barcode:     payload.barcode || null,
      category_id: payload.category_id || null,
      price:       payload.price,
      cost_price:  payload.cost_price || null,
      image_url:   imageUrl,
      min_stock:   payload.min_stock || 0,
    })
    .eq('id', productId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (prodErr) throw prodErr

  // 3. Upsert inventario si se indicó stock y sucursal
  if (payload.initialStock !== undefined && payload.branchId) {
    let { data: warehouse, error: whErr } = await supabase
      .from('warehouses')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('branch_id', payload.branchId)
      .limit(1)
      .single()

    // Auto-create warehouse if none exists
    if (!warehouse || whErr) {
      const { data: newWh, error: newWhErr } = await supabase
        .from('warehouses')
        .insert({
          tenant_id:  tenantId,
          branch_id:  payload.branchId,
          name:       'Bodega Principal',
          code:       'MAIN',
          is_default: true,
          is_active:  true,
        })
        .select('id')
        .single()

      if (newWhErr) {
        console.error('[updateProduct] Error creating warehouse:', newWhErr)
      } else {
        warehouse = newWh
      }
    }

    if (warehouse) {
      // Check if inventory row already exists
      const { data: existing } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('warehouse_id', warehouse.id)
        .eq('product_id', productId)
        .is('variant_id', null)
        .limit(1)
        .single()

      const prevQty = Number(existing?.quantity ?? 0)
      const newQty  = payload.initialStock!

      if (existing) {
        const { error: updErr } = await supabase
          .from('inventory')
          .update({ quantity: newQty })
          .eq('id', existing.id)
        if (updErr) console.error('[updateProduct] Error updating inventory:', updErr)
      } else {
        const { error: insErr } = await supabase
          .from('inventory')
          .insert({
            tenant_id:    tenantId,
            branch_id:    payload.branchId,
            warehouse_id: warehouse.id,
            product_id:   productId,
            quantity:     newQty,
          })
        if (insErr) console.error('[updateProduct] Error inserting inventory:', insErr)
      }

      // Registrar movimiento de stock si cambió
      const delta = newQty - prevQty
      if (delta !== 0) {
        const { error: mvErr } = await supabase.from('stock_movements').insert({
          tenant_id:      tenantId,
          branch_id:      payload.branchId,
          warehouse_id:   warehouse.id,
          product_id:     productId,
          type:           'ADJUSTMENT',
          quantity:       Math.abs(delta),
          unit_cost:      payload.cost_price ?? null,
          reference_type: 'MANUAL_ADJUSTMENT',
          notes:          delta > 0
            ? `Ajuste manual: +${delta} unidades`
            : `Ajuste manual: ${delta} unidades`,
        })
        if (mvErr) console.error('[updateProduct] Error inserting stock_movement:', mvErr)
      }
    }
  }

  return product
}

export async function createProduct(
  tenantId: string,
  userId: string,
  payload: CreateProductPayload,
) {
  // 1. Subir imagen si viene como File
  let imageUrl: string | null = payload.image_url ?? null
  if (payload.imageFile) {
    imageUrl = await uploadProductImage(tenantId, payload.imageFile)
  }

  // 2. Insert product
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .insert({
      tenant_id:   tenantId,
      name:        payload.name,
      sku:         payload.sku || `SKU-${Date.now()}`,
      barcode:     payload.barcode || null,
      category_id: payload.category_id || null,
      price:       payload.price,
      cost_price:  payload.cost_price || null,
      image_url:   imageUrl,
      min_stock:   payload.min_stock || 0,
      status:      'ACTIVE',
      created_by:  userId,
    })
    .select()
    .single()

  if (prodErr) throw prodErr

  // 3. If initial stock > 0 and branchId provided, find/create warehouse and insert inventory
  if (payload.initialStock && payload.initialStock > 0 && payload.branchId) {
    let { data: warehouse, error: whErr } = await supabase
      .from('warehouses')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('branch_id', payload.branchId)
      .limit(1)
      .single()

    // Auto-create warehouse if none exists
    if (!warehouse || whErr) {
      const { data: newWh, error: newWhErr } = await supabase
        .from('warehouses')
        .insert({
          tenant_id:  tenantId,
          branch_id:  payload.branchId,
          name:       'Bodega Principal',
          code:       'MAIN',
          is_default: true,
          is_active:  true,
        })
        .select('id')
        .single()

      if (newWhErr) {
        console.error('[createProduct] Error creating warehouse:', newWhErr)
      } else {
        warehouse = newWh
      }
    }

    if (warehouse) {
      const { error: invErr } = await supabase.from('inventory').insert({
        tenant_id:    tenantId,
        branch_id:    payload.branchId,
        warehouse_id: warehouse.id,
        product_id:   product.id,
        quantity:     payload.initialStock,
      })
      if (invErr) console.error('[createProduct] Error inserting inventory:', invErr)

      // 4. Registrar movimiento de stock inicial
      const { error: mvErr } = await supabase.from('stock_movements').insert({
        tenant_id:      tenantId,
        branch_id:      payload.branchId,
        warehouse_id:   warehouse.id,
        product_id:     product.id,
        type:           'IN',
        quantity:       payload.initialStock,
        unit_cost:      payload.cost_price ?? null,
        reference_type: 'INITIAL_STOCK',
        notes:          'Stock inicial al crear producto',
        created_by:     userId,
      })
      if (mvErr) console.error('[createProduct] Error inserting stock_movement:', mvErr)
    }
  }

  return product
}

// ── Products ───────────────────────────────────────────────────
/** Normaliza texto para búsqueda: minúsculas y sin tildes/diacríticos. */
function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export async function getProducts(
  tenantId: string,
  params?: { search?: string; categoryId?: string; status?: string },
): Promise<ProductRow[]> {
  let q = supabase
    .from('products')
    .select(`
      id, tenant_id, name, sku, barcode, price, cost_price, tax, image_url, status,
      track_inventory, category_id, min_stock, max_stock,
      categories(name, color, track_inventory),
      inventory(quantity)
    `)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name')

  if (params?.status) q = q.eq('status', params.status as any)
  else q = q.eq('status', 'ACTIVE')

  if (params?.categoryId) q = q.eq('category_id', params.categoryId)

  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as unknown as ProductRow[]

  // Búsqueda en cliente: insensible a mayúsculas y tildes, por palabras clave
  // ("coca 350" encuentra "Coca-Cola 350ml"; "cafe" encuentra "Café").
  const search = params?.search?.trim()
  if (!search) return rows

  const tokens = normalizeText(search).split(/\s+/).filter(Boolean)
  const haystack = (r: ProductRow) => {
    const cat = r.categories as any
    return normalizeText(`${r.name} ${r.sku} ${r.barcode ?? ''} ${cat?.name ?? ''}`)
  }

  // 1) Todas las palabras presentes (en cualquier orden)
  const allMatch = rows.filter(r => {
    const hay = haystack(r)
    return tokens.every(t => hay.includes(t))
  })
  if (allMatch.length > 0) return allMatch

  // 2) Fallback: al menos una palabra coincide (búsqueda más laxa)
  return rows.filter(r => {
    const hay = haystack(r)
    return tokens.some(t => hay.includes(t))
  })
}

// ── Carga masiva de productos ──────────────────────────────────
export interface BulkProductRow {
  name: string
  sku?: string
  category?: string
  barcode?: string
  price?: number
  cost?: number
  stock?: number
  minStock?: number
  maxStock?: number
}

export interface BulkImportResult {
  created: number
  /** Productos existentes que recibieron cambios (precio, stock, etc.) */
  updated: number
  /** Filas de productos existentes sin ningún cambio */
  skipped: number
  errors: { row: number; message: string }[]
}

/**
 * Importa productos en lote: crea categorías faltantes (por nombre),
 * la bodega principal si no existe, los productos y su stock inicial
 * con movimiento de auditoría.
 */
export async function bulkImportProducts(
  tenantId: string,
  userId: string,
  branchId: string,
  rows: BulkProductRow[],
): Promise<BulkImportResult> {
  const errors: BulkImportResult['errors'] = []
  const preValid = rows
    .map((r, i) => ({ ...r, __row: i + 2 }))   // +2: fila 1 = encabezados
    .filter(r => {
      if (!r.name?.trim()) { errors.push({ row: r.__row, message: 'Sin nombre de producto' }); return false }
      return true
    })
  if (preValid.length === 0) return { created: 0, updated: 0, skipped: 0, errors }

  // 0) Cargar catálogo existente para separar filas nuevas de existentes
  //    (match por SKU, código de barras o nombre). Las existentes se
  //    ACTUALIZAN solo en los campos que cambiaron — nunca se duplican
  //    ni pierden imagen u otros datos no incluidos en la plantilla.
  type ExistingProd = { id: string; name: string; sku: string | null; barcode: string | null; category_id: string | null; price: number; cost_price: number | null; min_stock: number | null; max_stock: number | null }
  const { data: existing, error: exErr } = await supabase
    .from('products')
    .select('id, name, sku, barcode, category_id, price, cost_price, min_stock, max_stock')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
  if (exErr) throw exErr
  const bySku     = new Map<string, ExistingProd>()
  const byBarcode = new Map<string, ExistingProd>()
  const byName    = new Map<string, ExistingProd>()
  for (const e of (existing ?? []) as ExistingProd[]) {
    if (e.sku?.trim())     bySku.set(e.sku.trim().toLowerCase(), e)
    if (e.barcode?.trim()) byBarcode.set(e.barcode.trim(), e)
    if (e.name?.trim())    byName.set(e.name.trim().toLowerCase(), e)
  }

  const valid: typeof preValid = []
  const toUpdate: { r: typeof preValid[number]; ex: ExistingProd }[] = []
  for (const r of preValid) {
    const ex =
      (r.sku?.trim() && bySku.get(r.sku.trim().toLowerCase())) ||
      (r.barcode?.trim() && byBarcode.get(r.barcode.trim())) ||
      byName.get(r.name.trim().toLowerCase()) || null
    if (ex) toUpdate.push({ r, ex })
    else valid.push(r)
  }

  // 1) Categorías: mapear existentes y crear faltantes
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
  if (catErr) throw catErr
  const catMap = new Map((cats ?? []).map(c => [c.name.trim().toLowerCase(), c.id]))

  const missingCats = [...new Set(
    preValid.map(r => r.category?.trim()).filter((c): c is string => !!c)
      .filter(c => !catMap.has(c.toLowerCase())),
  )]
  if (missingCats.length > 0) {
    const { data: newCats, error } = await supabase
      .from('categories')
      .insert(missingCats.map(name => ({ tenant_id: tenantId, name, is_active: true })))
      .select('id, name')
    if (error) throw error
    for (const c of newCats ?? []) catMap.set(c.name.trim().toLowerCase(), c.id)
  }

  // 2) Bodega principal de la sucursal
  let { data: wh } = await supabase
    .from('warehouses')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!wh) {
    const { data: newWh, error } = await supabase
      .from('warehouses')
      .insert({ tenant_id: tenantId, branch_id: branchId, name: 'Bodega Principal', code: 'MAIN', is_default: true, is_active: true })
      .select('id')
      .single()
    if (error) throw error
    wh = newWh
  }

  // 3) Productos NUEVOS en lote
  const stamp = Date.now()
  const { data: created, error: prodErr } = valid.length === 0
    ? { data: [] as { id: string }[], error: null }
    : await supabase
    .from('products')
    .insert(valid.map((r, i) => ({
      tenant_id:   tenantId,
      name:        r.name.trim(),
      sku:         r.sku?.trim() || `SKU-${stamp}-${i}`,
      barcode:     r.barcode?.trim() || null,
      category_id: r.category?.trim() ? catMap.get(r.category.trim().toLowerCase()) ?? null : null,
      price:       r.price ?? 0,
      cost_price:  r.cost ?? null,
      min_stock:   r.minStock ?? 0,
      max_stock:   r.maxStock ?? null,
      status:      'ACTIVE',
      created_by:  userId,
    })))
    .select('id')
  if (prodErr) throw prodErr

  // 4) Inventario + movimientos
  const invRows = (created ?? []).map((p, i) => ({
    tenant_id:    tenantId,
    branch_id:    branchId,
    warehouse_id: wh!.id,
    product_id:   p.id,
    quantity:     valid[i]?.stock ?? 0,
  }))
  if (invRows.length > 0) {
    const { error } = await supabase.from('inventory').insert(invRows)
    if (error) throw error
  }
  const movements = invRows
    .filter(r => Number(r.quantity) > 0)
    .map(r => ({
      tenant_id:      tenantId,
      branch_id:      branchId,
      warehouse_id:   r.warehouse_id,
      product_id:     r.product_id,
      type:           'ADJUSTMENT',
      quantity:       Math.abs(Number(r.quantity)),
      reference_type: 'MANUAL_ADJUSTMENT',
      notes:          'Carga masiva de productos',
    }))
  if (movements.length > 0) {
    const { error } = await supabase.from('stock_movements').insert(movements)
    if (error) console.error('[bulkImportProducts] stock_movements:', error)
  }

  // 5) Productos EXISTENTES: actualizar solo campos que cambiaron
  let updated = 0
  let skipped = 0
  if (toUpdate.length > 0) {
    // Inventario actual de estos productos en la sucursal
    const prodIds = toUpdate.map(t => t.ex.id)
    const { data: invExisting } = await supabase
      .from('inventory')
      .select('id, product_id, quantity')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .in('product_id', prodIds)
    const invByProd = new Map((invExisting ?? []).map(i => [i.product_id, i]))

    for (const { r, ex } of toUpdate) {
      let changed = false

      // Campos del producto: solo los que vienen en la plantilla y difieren.
      // La imagen, el nombre y demás datos no incluidos NO se tocan.
      const patch: Record<string, unknown> = {}
      const newCatId = r.category?.trim() ? catMap.get(r.category.trim().toLowerCase()) : undefined
      if (r.price    !== undefined && Number(r.price)    !== Number(ex.price))            patch['price']       = r.price
      if (r.cost     !== undefined && Number(r.cost)     !== Number(ex.cost_price ?? NaN)) patch['cost_price'] = r.cost
      if (r.minStock !== undefined && Number(r.minStock) !== Number(ex.min_stock ?? 0))   patch['min_stock']   = r.minStock
      if (r.maxStock !== undefined && Number(r.maxStock) !== Number(ex.max_stock ?? NaN)) patch['max_stock']   = r.maxStock
      if (r.barcode?.trim() && r.barcode.trim() !== (ex.barcode ?? ''))                   patch['barcode']     = r.barcode.trim()
      if (newCatId && newCatId !== ex.category_id)                                        patch['category_id'] = newCatId

      if (Object.keys(patch).length > 0) {
        patch['updated_at'] = new Date().toISOString()
        const { error } = await supabase.from('products').update(patch).eq('id', ex.id).eq('tenant_id', tenantId)
        if (error) { errors.push({ row: r.__row, message: error.message }); continue }
        changed = true
      }

      // Stock: solo si viene en la plantilla y difiere del actual
      if (r.stock !== undefined) {
        const inv = invByProd.get(ex.id)
        const current = inv ? Number(inv.quantity) : 0
        if (Number(r.stock) !== current) {
          if (inv) {
            const { error } = await supabase.from('inventory')
              .update({ quantity: r.stock, updated_at: new Date().toISOString() })
              .eq('id', inv.id)
            if (error) { errors.push({ row: r.__row, message: error.message }); continue }
          } else {
            const { error } = await supabase.from('inventory')
              .insert({ tenant_id: tenantId, branch_id: branchId, warehouse_id: wh!.id, product_id: ex.id, quantity: r.stock })
            if (error) { errors.push({ row: r.__row, message: error.message }); continue }
          }
          const delta = Number(r.stock) - current
          await supabase.from('stock_movements').insert({
            tenant_id: tenantId, branch_id: branchId, warehouse_id: wh!.id, product_id: ex.id,
            type: 'ADJUSTMENT', quantity: Math.abs(delta), reference_type: 'MANUAL_ADJUSTMENT',
            notes: `Carga masiva: ajuste ${delta > 0 ? '+' : ''}${delta} uds`,
          })
          changed = true
        }
      }

      if (changed) updated++
      else skipped++
    }
  }

  return { created: created?.length ?? 0, updated, skipped, errors }
}

const CATEGORY_COLS = 'id, tenant_id, name, color, icon, is_active, track_inventory'

export async function getCategories(tenantId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLS)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as unknown as CategoryRow[]
}

export async function createCategory(tenantId: string, name: string, color: string): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ tenant_id: tenantId, name: name.trim(), color, is_active: true })
    .select(CATEGORY_COLS)
    .single()
  if (error) throw error
  return data as unknown as CategoryRow
}

export async function updateCategory(tenantId: string, categoryId: string, name: string, color: string): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: name.trim(), color })
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)
    .select(CATEGORY_COLS)
    .single()
  if (error) throw error
  return data as unknown as CategoryRow
}

/** Activa/desactiva el control de stock para los productos de una categoría. */
export async function setCategoryTrackInventory(tenantId: string, categoryId: string, track: boolean): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from('categories')
    .update({ track_inventory: track })
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)
    .select(CATEGORY_COLS)
    .single()
  if (error) throw error
  return data as unknown as CategoryRow
}

export async function deleteCategory(tenantId: string, categoryId: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', categoryId)
    .eq('tenant_id', tenantId)
  if (error) throw error
}
