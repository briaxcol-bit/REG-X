import { DomainEvent } from '@shared/domain/events/domain-event'

interface Payload {
  productId: string
  tenantId:  string
  sku:       string
  name:      string
  price:     { amount: number; currency: string }
}

export class ProductCreatedEvent extends DomainEvent {
  constructor(public readonly payload: Payload) {
    super('product.created')
  }
}
