import { Module } from '@nestjs/common'
import { WebhooksService } from './application/webhooks.service'
import { WebhookDeliveryListener } from './application/webhook-delivery.listener'

@Module({
  providers: [WebhooksService, WebhookDeliveryListener],
  exports:   [WebhooksService],
})
export class WebhooksModule {}
