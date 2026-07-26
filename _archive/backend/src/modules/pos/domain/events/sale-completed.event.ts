import { DomainEvent } from '@shared/domain/events/domain-event'
export class SaleCompletedEvent extends DomainEvent {
  constructor(public readonly payload: {
    saleId: string; tenantId: string; branchId: string;
    total: { amount: number; currency: string };
    receiptNumber: string; customerId?: string;
  }) { super('sale.completed') }
}
