import { Injectable } from '@nestjs/common'
import { SupabaseService } from '@shared/infrastructure/supabase/supabase.service'
import { Product, type ProductProps } from '../../domain/entities/product.entity'
import type { IProductRepository, ProductFilters, PaginatedResult } from '../../domain/repositories/product.repository'
import { Money } from '@shared/domain/value-objects/money.vo'

const TABLE = 'products'

@Injectable()
export class SupabaseProductRepository implements IProductRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findById(id: string, tenantId: string): Promise<Product | null> {
    const { data, error } = await this.supabase.admin
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single()

    if (error || !data) return null
    return this.toDomain(data)
  }

  async findBySku(sku: string, tenantId: string): Promise<Product | null> {
    const { data, error } = await this.supabase.admin
      .from(TABLE)
      .select('*')
      .eq('sku', sku)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null
    return this.toDomain(data)
  }

  async findByBarcode(barcode: string, tenantId: string): Promise<Product | null> {
    const { data, error } = await this.supabase.admin
      .from(TABLE)
      .select('*')
      .eq('barcode', barcode)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null
    return this.toDomain(data)
  }

  async findAll(tenantId: string, filters: ProductFilters): Promise<PaginatedResult<Product>> {
    const page  = filters.page  ?? 1
    const limit = filters.limit ?? 50
    const from  = (page - 1) * limit
    const to    = from + limit - 1

    let query = this.supabase.admin
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .range(from, to)
      .order('name')

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,barcode.eq.${filters.search}`)
    }
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters.brandId)    query = query.eq('brand_id',    filters.brandId)
    if (filters.status)     query = query.eq('status',      filters.status)

    const { data, error, count } = await query

    if (error) throw new Error(`Product query failed: ${error.message}`)

    return {
      data:  (data ?? []).map((r) => this.toDomain(r)),
      total: count ?? 0,
      page,
      limit,
    }
  }

  async save(product: Product): Promise<void> {
    const row = this.toRow(product)
    const { error } = await this.supabase.admin.from(TABLE).insert(row)
    if (error) throw new Error(`Failed to save product: ${error.message}`)
  }

  async update(product: Product): Promise<void> {
    const row = this.toRow(product)
    const { error } = await this.supabase.admin
      .from(TABLE)
      .update(row)
      .eq('id', product.id)
      .eq('tenant_id', product.tenantId)
    if (error) throw new Error(`Failed to update product: ${error.message}`)
  }

  async softDelete(id: string, tenantId: string, deletedBy: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString(), updated_by: deletedBy })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new Error(`Failed to delete product: ${error.message}`)
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    const { count } = await this.supabase.admin
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
    return (count ?? 0) > 0
  }

  // ── Mappers ──────────────────────────────────────────────

  private toDomain(row: Record<string, unknown>): Product {
    return Product.reconstitute({
      id:                 row['id'] as string,
      tenantId:           row['tenant_id'] as string,
      branchId:           row['branch_id'] as string | undefined,
      sku:                row['sku'] as string,
      name:               row['name'] as string,
      description:        row['description'] as string | undefined,
      price:              Money.of(row['price'] as number, row['currency'] as string),
      costPrice:          row['cost_price'] ? Money.of(row['cost_price'] as number, row['currency'] as string) : undefined,
      tax:                row['tax'] as number,
      categoryId:         row['category_id'] as string | undefined,
      brandId:            row['brand_id'] as string | undefined,
      imageUrl:           row['image_url'] as string | undefined,
      barcode:            row['barcode'] as string | undefined,
      unit:               row['unit'] as string,
      minStock:           row['min_stock'] as number,
      maxStock:           row['max_stock'] as number | undefined,
      trackInventory:     row['track_inventory'] as boolean,
      allowNegativeStock: row['allow_negative_stock'] as boolean,
      status:             row['status'] as ProductProps['status'],
      tags:               (row['tags'] as string[]) ?? [],
      createdBy:          row['created_by'] as string,
      updatedBy:          row['updated_by'] as string | undefined,
      createdAt:          new Date(row['created_at'] as string),
      updatedAt:          new Date(row['updated_at'] as string),
      deletedAt:          row['deleted_at'] ? new Date(row['deleted_at'] as string) : undefined,
    })
  }

  private toRow(product: Product): Record<string, unknown> {
    return {
      id:                   product.id,
      tenant_id:            product.tenantId,
      branch_id:            product.branchId ?? null,
      sku:                  product.sku,
      name:                 product.name,
      description:          product.description ?? null,
      price:                product.price.amount,
      cost_price:           product.costPrice?.amount ?? null,
      currency:             product.price.currency,
      tax:                  product.tax,
      category_id:          product.categoryId ?? null,
      brand_id:             product.brandId ?? null,
      image_url:            product.imageUrl ?? null,
      barcode:              product.barcode ?? null,
      unit:                 product.unit,
      min_stock:            product.minStock,
      max_stock:            product.maxStock ?? null,
      track_inventory:      product.trackInventory,
      allow_negative_stock: product.allowNegativeStock,
      status:               product.status,
      tags:                 product.tags,
      created_by:           product.createdBy,
      updated_by:           product.updatedBy ?? null,
      created_at:           product.createdAt.toISOString(),
      updated_at:           product.updatedAt.toISOString(),
      deleted_at:           product.deletedAt?.toISOString() ?? null,
    }
  }
}
