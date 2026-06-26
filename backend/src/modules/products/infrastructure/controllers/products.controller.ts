import {
  Controller, Get, Post, Put, Delete, Param, Body,
  Query, HttpCode, HttpStatus, UseGuards, Version,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { ThrottlerGuard } from '@nestjs/throttler'
import { RBACGuard, Permissions } from '@shared/guards/rbac.guard'
import { Tenant, TenantId } from '@shared/decorators/tenant.decorator'
import type { TenantContext } from '@shared/middleware/tenant.middleware'
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case'
import { CreateProductDto } from '../../application/dtos/create-product.dto'
import { Inject } from '@nestjs/common'
import { IProductRepository, PRODUCT_REPOSITORY } from '../../domain/repositories/product.repository'

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard, RBACGuard)
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProductUseCase,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepo: IProductRepository,
  ) {}

  @Get()
  @Permissions('products.view')
  @ApiOperation({ summary: 'List products' })
  @ApiQuery({ name: 'search',     required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'page',       required: false })
  @ApiQuery({ name: 'limit',      required: false })
  async findAll(
    @TenantId() tenantId: string,
    @Query('search')     search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page')       page = 1,
    @Query('limit')      limit = 50,
  ) {
    return this.productRepo.findAll(tenantId, {
      search, categoryId,
      page: +page, limit: Math.min(+limit, 200),
    })
  }

  @Get(':id')
  @Permissions('products.view')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    const product = await this.productRepo.findById(id, tenantId)
    if (!product) return null
    return product.toJSON()
  }

  @Post()
  @Permissions('products.create')
  @ApiOperation({ summary: 'Create product' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateProductDto,
    @Tenant() tenant: TenantContext,
  ) {
    const product = await this.createProduct.execute({
      tenantId: tenant.tenantId,
      userId:   tenant.userId,
      currency: 'COP',           // Read from tenant settings in production
      dto,
    })
    return product.toJSON()
  }

  @Delete(':id')
  @Permissions('products.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
  ) {
    await this.productRepo.softDelete(id, tenant.tenantId, tenant.userId)
  }
}
