import type { Product } from '../entities/product.entity'

export interface ProductFilters {
  search?:     string
  categoryId?: string
  brandId?:    string
  status?:     string
  page?:       number
  limit?:      number
}

export interface PaginatedResult<T> {
  data:  T[]
  total: number
  page:  number
  limit: number
}

/**
 * Port (interface) for the Product Repository.
 * The Infrastructure layer provides the concrete adapter.
 */
export interface IProductRepository {
  findById(id: string, tenantId: string): Promise<Product | null>
  findBySku(sku: string, tenantId: string): Promise<Product | null>
  findByBarcode(barcode: string, tenantId: string): Promise<Product | null>
  findAll(tenantId: string, filters: ProductFilters): Promise<PaginatedResult<Product>>
  save(product: Product): Promise<void>
  update(product: Product): Promise<void>
  softDelete(id: string, tenantId: string, deletedBy: string): Promise<void>
  exists(id: string, tenantId: string): Promise<boolean>
}

export const PRODUCT_REPOSITORY = Symbol('IProductRepository')
