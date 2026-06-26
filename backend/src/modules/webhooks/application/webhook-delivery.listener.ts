import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { WebhooksService } from './webhooks.service'
import type { SaleCompletedEvent } from '@modules/pos/domain/events/sale-completed.event'
import type { ProductCreatedEvent } from '@modules/products/domain/events/product-created.event'

@Injectable()
export class WebhookDeliveryListener {
  constructor(private readonly webhooks: WebhooksService) {}

  @OnEvent('sale.completed')
  async onSaleCompleted(event: SaleCompletedEvent) {
    await this.webhooks.dispatch(event.payload.tenantId, 'sale.completed', event.payload)
  }

  @OnEvent('sale.created')
  async onSaleCreated(event: { payload: { tenantId: string } & Record<string, unknown> }) {
    await this.webhooks.dispatch(event.payload.tenantId, 'sale.created', event.payload)
  }

  @OnEvent('product.created')
  async onProductCreated(event: ProductCreatedEvent) {
    await this.webhooks.dispatch(event.payload.tenantId, 'product.created', event.payload)
  }
}
