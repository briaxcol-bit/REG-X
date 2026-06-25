import { DomainEvent } from '@shared/domain/events/domain-event'
export class SaleCancelledEvent extends DomainEvent {
  constructor(public readonly payload: { saleId: string; tenantId: string; reason: string }) {
    super('sale.cancelled')
  }
}
