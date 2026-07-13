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
  categories?: { name: string; color: string } | null
  inventory?: { quantity: number; warehouse_id: string }[]
}

export interface CategoryRow {
  id: string
  tenant_id: string
  name: string
  color: string
  icon: string | null
  is_active: boolean
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
export async function getProducts(
  tenantId: string,
  params?: { search?: string; categoryId?: string; status?: string },
): Promise<ProductRow[]> {
  let q = supabase
    .from('products')
    .select(`
      id, tenant_id, name, sku, price, cost_price, tax, image_url, status,
      track_inventory, category_id,
      categories(name, color),
      inventory(quantity)
    `)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name')

  if (params?.status) q = q.eq('status', params.status as any)
  else q = q.eq('status', 'ACTIVE')

  if (params?.categoryId) q = q.eq('category_id', params.categoryId)

  if (params?.search) {
    q = q.or(`name.ilike.%${params.search}%,sku.ilike.%${params.search}%`)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ProductRow[]
}

export async function getCategories(tenantId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, tenant_id, name, color, icon, is_active')
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
    .select('id, tenant_id, name, color, icon, is_active')
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
    .select('id, tenant_id, name, color, icon, is_active')
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
