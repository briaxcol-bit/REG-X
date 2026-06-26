import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common'
import { ProductsController } from './infrastructure/controllers/products.controller'
import { SupabaseProductRepository } from './infrastructure/repositories/supabase-product.repository'
import { CreateProductUseCase } from './application/use-cases/create-product.use-case'
import { PRODUCT_REPOSITORY } from './domain/repositories/product.repository'
import { TenantMiddleware } from '@shared/middleware/tenant.middleware'

@Module({
  providers: [
    // ── Repository binding (DIP) ───────────────────────
    { provide: PRODUCT_REPOSITORY, useClass: SupabaseProductRepository },
    // ── Use cases ─────────────────────────────────────
    CreateProductUseCase,
  ],
  controllers: [ProductsController],
  exports: [PRODUCT_REPOSITORY],
})
export class ProductsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: 'api/v1/products*', method: RequestMethod.ALL })
  }
}
