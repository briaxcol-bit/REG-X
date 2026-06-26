import { Injectable, Inject, ConflictException } from '@nestjs/common'
import { Product } from '../../domain/entities/product.entity'
import { IProductRepository, PRODUCT_REPOSITORY } from '../../domain/repositories/product.repository'
import { Money } from '@shared/domain/value-objects/money.vo'
import { EventBusService } from '@shared/events/event-bus.service'
import { CacheService } from '@shared/infrastructure/redis/cache.service'
import type { CreateProductDto } from '../dtos/create-product.dto'

interface CreateProductCommand {
  tenantId:  string
  branchId?: string
  userId:    string
  dto:       CreateProductDto
  currency:  string
}

@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepo: IProductRepository,
    private readonly eventBus: EventBusService,
    private readonly cache: CacheService,
  ) {}

  async execute(command: CreateProductCommand): Promise<Product> {
    const { tenantId, branchId, userId, dto, currency } = command

    // ── Check SKU uniqueness ─────────────────────────────
    const existing = await this.productRepo.findBySku(dto.sku, tenantId)
    if (existing) {
      throw new ConflictException(`Product with SKU "${dto.sku}" already exists`)
    }

    // ── Check barcode uniqueness if provided ─────────────
    if (dto.barcode) {
      const byBarcode = await this.productRepo.findByBarcode(dto.barcode, tenantId)
      if (byBarcode) {
        throw new ConflictException(`Product with barcode "${dto.barcode}" already exists`)
      }
    }

    // ── Create aggregate ─────────────────────────────────
    const product = Product.create({
      tenantId,
      branchId,
      sku:                dto.sku,
      name:               dto.name,
      description:        dto.description,
      price:              Money.of(dto.price, dto.currency ?? currency),
      costPrice:          dto.costPrice ? Money.of(dto.costPrice, dto.currency ?? currency) : undefined,
      tax:                dto.tax,
      categoryId:         dto.categoryId,
      brandId:            dto.brandId,
      imageUrl:           dto.imageUrl,
      barcode:            dto.barcode,
      unit:               dto.unit,
      minStock:           dto.minStock ?? 0,
      maxStock:           dto.maxStock,
      trackInventory:     dto.trackInventory ?? true,
      allowNegativeStock: dto.allowNegativeStock ?? false,
      tags:               dto.tags ?? [],
      createdBy:          userId,
    })

    // ── Persist ──────────────────────────────────────────
    await this.productRepo.save(product)

    // ── Publish domain events ────────────────────────────
    await this.eventBus.publishFromAggregate(product)

    // ── Invalidate cache ─────────────────────────────────
    await this.cache.delByPattern(this.cache.tenantKey(tenantId, 'products:*'))

    return product
  }
}
