import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common'
import { CreateSaleUseCase } from './application/use-cases/create-sale.use-case'
import { POSController } from './infrastructure/controllers/pos.controller'
import { TenantMiddleware } from '@shared/middleware/tenant.middleware'

@Module({
  providers: [CreateSaleUseCase],
  controllers: [POSController],
  exports: [CreateSaleUseCase],
})
export class POSModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: 'api/v1/pos*', method: RequestMethod.ALL })
  }
}
