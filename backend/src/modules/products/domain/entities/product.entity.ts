import { AggregateRoot } from '@shared/domain/entities/aggregate-root'
import { Money } from '@shared/domain/value-objects/money.vo'
import { ProductCreatedEvent } from '../events/product-created.event'
import { ProductUpdatedEvent } from '../events/product-updated.event'
import { v4 as uuidv4 } from 'uuid'

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED'

export interface ProductProps {
  id: string
  tenantId: string
  branchId?: string
  sku: string
  name: string
  description?: string
  price: Money
  costPrice?: Money
  tax: number               // percentage 0-100
  categoryId?: string
  brandId?: string
  imageUrl?: string
  barcode?: string
  unit: string              // UNIT, KG, LT, ML, etc.
  minStock: number
  maxStock?: number
  trackInventory: boolean
  allowNegativeStock: boolean
  status: ProductStatus
  businessType?: string     // RESTAURANT, BAR, etc. — for type-specific logic
  tags: string[]
  createdBy: string
  updatedBy?: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export class Product extends AggregateRoot {
  private constructor(private readonly props: ProductProps) {
    super()
  }

  // ── Factory ──────────────────────────────────────────────

  static create(params: Omit<ProductProps, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'tags'> & {
    tags?: string[]
    status?: ProductStatus
  }): Product {
    const product = new Product({
      ...params,
      id:        uuidv4(),
      status:    params.status ?? 'ACTIVE',
      tags:      params.tags   ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    product.addDomainEvent(new ProductCreatedEvent({
      productId: product.id,
      tenantId:  product.tenantId,
      sku:       product.sku,
      name:      product.name,
      price:     product.price.toJSON(),
    }))

    return product
  }

  static reconstitute(props: ProductProps): Product {
    return new Product(props)
  }

  // ── Commands ─────────────────────────────────────────────

  update(params: Partial<Pick<ProductProps, 'name' | 'description' | 'price' | 'costPrice' | 'tax' | 'categoryId' | 'brandId' | 'imageUrl' | 'barcode' | 'unit' | 'minStock' | 'maxStock' | 'trackInventory' | 'allowNegativeStock' | 'status' | 'tags'>> & { updatedBy: string }): void {
    Object.assign(this.props, params)
    this.props.updatedAt = new Date()

    this.addDomainEvent(new ProductUpdatedEvent({
      productId: this.id,
      tenantId:  this.tenantId,
      changes:   params,
    }))
  }

  archive(updatedBy: string): void {
    this.props.status    = 'ARCHIVED'
    this.props.updatedBy = updatedBy
    this.props.updatedAt = new Date()
  }

  softDelete(updatedBy: string): void {
    this.props.deletedAt = new Date()
    this.props.updatedBy = updatedBy
  }

  // ── Getters ──────────────────────────────────────────────

  get id():                  string        { return this.props.id }
  get tenantId():            string        { return this.props.tenantId }
  get branchId():            string | undefined { return this.props.branchId }
  get sku():                 string        { return this.props.sku }
  get name():                string        { return this.props.name }
  get description():         string | undefined { return this.props.description }
  get price():               Money         { return this.props.price }
  get costPrice():           Money | undefined  { return this.props.costPrice }
  get tax():                 number        { return this.props.tax }
  get categoryId():          string | undefined { return this.props.categoryId }
  get brandId():             string | undefined { return this.props.brandId }
  get imageUrl():            string | undefined { return this.props.imageUrl }
  get barcode():             string | undefined { return this.props.barcode }
  get unit():                string        { return this.props.unit }
  get minStock():            number        { return this.props.minStock }
  get maxStock():            number | undefined { return this.props.maxStock }
  get trackInventory():      boolean       { return this.props.trackInventory }
  get allowNegativeStock():  boolean       { return this.props.allowNegativeStock }
  get status():              ProductStatus { return this.props.status }
  get tags():                string[]      { return this.props.tags }
  get createdBy():           string        { return this.props.createdBy }
  get updatedBy():           string | undefined { return this.props.updatedBy }
  get createdAt():           Date          { return this.props.createdAt }
  get updatedAt():           Date          { return this.props.updatedAt }
  get deletedAt():           Date | undefined   { return this.props.deletedAt }

  isActive():   boolean { return this.props.status === 'ACTIVE' }
  isDeleted():  boolean { return !!this.props.deletedAt }

  toJSON(): ProductProps {
    return { ...this.props, price: this.props.price.toJSON() as any }
  }
}
