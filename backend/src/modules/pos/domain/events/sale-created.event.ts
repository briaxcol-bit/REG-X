import { DomainEvent } from '@shared/domain/events/domain-event'
export class SaleCreatedEvent extends DomainEvent {
  constructor(public readonly payload: {
    saleId: string; tenantId: string; branchId: string;
    customerId?: string; total: { amount: number; currency: string };
    itemCount: number; orderNumber: string;
  }) { super('sale.created') }
}
