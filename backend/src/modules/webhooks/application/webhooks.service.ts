import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '@shared/infrastructure/supabase/supabase.service'
import axios from 'axios'
import * as crypto from 'crypto'

export type WebhookEvent =
  | 'sale.created' | 'sale.completed' | 'sale.cancelled'
  | 'product.created' | 'product.updated'
  | 'customer.created'
  | 'subscription.created' | 'subscription.renewed'

interface WebhookEndpoint {
  id:      string
  url:     string
  secret:  string
  events:  WebhookEvent[]
  active:  boolean
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)

  constructor(private readonly supabase: SupabaseService) {}

  async dispatch(tenantId: string, event: WebhookEvent, payload: unknown): Promise<void> {
    const endpoints = await this.getActiveEndpoints(tenantId, event)
    if (!endpoints.length) return

    await Promise.allSettled(
      endpoints.map((ep) => this.deliver(ep, event, payload)),
    )
  }

  private async deliver(endpoint: WebhookEndpoint, event: WebhookEvent, payload: unknown): Promise<void> {
    const body = JSON.stringify({
      id:        crypto.randomUUID(),
      event,
      payload,
      timestamp: new Date().toISOString(),
    })

    const signature = this.sign(body, endpoint.secret)

    try {
      await axios.post(endpoint.url, body, {
        headers: {
          'Content-Type': 'application/json',
          'x-regx-signature': signature,
          'x-regx-event': event,
        },
        timeout: 10_000,
      })

      await this.logDelivery(endpoint.id, event, 'SUCCESS', null)
      this.logger.log(`Webhook delivered to ${endpoint.url} for event ${event}`)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await this.logDelivery(endpoint.id, event, 'FAILED', error)
      this.logger.warn(`Webhook delivery failed for ${endpoint.url}: ${error}`)
    }
  }

  private sign(body: string, secret: string): string {
    return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
  }

  private async getActiveEndpoints(tenantId: string, event: WebhookEvent): Promise<WebhookEndpoint[]> {
    const { data } = await this.supabase.admin
      .from('webhook_endpoints')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .contains('events', [event])
    return (data ?? []) as WebhookEndpoint[]
  }

  private async logDelivery(endpointId: string, event: string, status: string, error: string | null): Promise<void> {
    await this.supabase.admin.from('webhook_deliveries').insert({
      endpoint_id:  endpointId,
      event,
      status,
      error_message: error,
      delivered_at:  new Date().toISOString(),
    })
  }
}
