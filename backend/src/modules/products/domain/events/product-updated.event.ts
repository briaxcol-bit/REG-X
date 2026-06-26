import { DomainEvent } from '@shared/domain/events/domain-event'

export class ProductUpdatedEvent extends DomainEvent {
  constructor(public readonly payload: {
    productId: string
    tenantId:  string
    changes:   Record<string, unknown>
  }) {
    super('product.updated')
  }
}
