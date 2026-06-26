import { AggregateRoot } from '@shared/domain/entities/aggregate-root'
import { Money } from '@shared/domain/value-objects/money.vo'
import { SaleCreatedEvent } from '../events/sale-created.event'
import { SaleCompletedEvent } from '../events/sale-completed.event'
import { SaleCancelledEvent } from '../events/sale-cancelled.event'
import { v4 as uuidv4 } from 'uuid'

export type SaleStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'QR' | 'GIFT_CARD' | 'MIXED'

export interface SaleItem {
  id:             string
  productId:      string
  variantId?:     string
  sku:            string
  name:           string
  quantity:       number
  unitPrice:      Money
  discount:       number      // percentage
  discountAmount: Money
  tax:            number      // percentage
  taxAmount:      Money
  total:          Money
  notes?:         string
  sentToKitchen?: boolean
  sentToBar?:     boolean
}

export interface PaymentLine {
  method:     PaymentMethod
  amount:     Money
  reference?: string
}

export interface SaleProps {
  id:               string
  tenantId:         string
  branchId:         string
  cashRegisterId?:  string
  customerId?:      string
  tableId?:         string
  orderNumber:      string
  items:            SaleItem[]
  payments:         PaymentLine[]
  subtotal:         Money
  taxTotal:         Money
  discountTotal:    Money
  total:            Money
  status:           SaleStatus
  notes?:           string
  receiptNumber?:   string
  createdBy:        string
  completedBy?:     string
  cancelledBy?:     string
  cancelReason?:    string
  createdAt:        Date
  updatedAt:        Date
  completedAt?:     Date
  cancelledAt?:     Date
}

export class Sale extends AggregateRoot {
  private constructor(private readonly props: SaleProps) {
    super()
  }

  static create(params: Omit<SaleProps, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'receiptNumber'>): Sale {
    const sale = new Sale({
      ...params,
      id:        uuidv4(),
      status:    'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    sale.addDomainEvent(new SaleCreatedEvent({
      saleId:      sale.id,
      tenantId:    sale.tenantId,
      branchId:    sale.branchId,
      customerId:  sale.customerId,
      total:       sale.total.toJSON(),
      itemCount:   sale.items.length,
      orderNumber: sale.orderNumber,
    }))

    return sale
  }

  static reconstitute(props: SaleProps): Sale {
    return new Sale(props)
  }

  // ── Commands ─────────────────────────────────────────────

  complete(completedBy: string, receiptNumber: string): void {
    if (this.props.status !== 'PENDING') {
      throw new Error(`Cannot complete sale with status ${this.props.status}`)
    }
    this.props.status         = 'COMPLETED'
    this.props.completedBy    = completedBy
    this.props.completedAt    = new Date()
    this.props.receiptNumber  = receiptNumber
    this.props.updatedAt      = new Date()

    this.addDomainEvent(new SaleCompletedEvent({
      saleId:        this.id,
      tenantId:      this.tenantId,
      branchId:      this.branchId,
      total:         this.total.toJSON(),
      receiptNumber,
      customerId:    this.customerId,
    }))
  }

  cancel(cancelledBy: string, reason: string): void {
    if (!['PENDING', 'COMPLETED'].includes(this.props.status)) {
      throw new Error(`Cannot cancel sale with status ${this.props.status}`)
    }
    this.props.status       = 'CANCELLED'
    this.props.cancelledBy  = cancelledBy
    this.props.cancelReason = reason
    this.props.cancelledAt  = new Date()
    this.props.updatedAt    = new Date()

    this.addDomainEvent(new SaleCancelledEvent({
      saleId:   this.id,
      tenantId: this.tenantId,
      reason,
    }))
  }

  // ── Getters ──────────────────────────────────────────────

  get id():              string        { return this.props.id }
  get tenantId():        string        { return this.props.tenantId }
  get branchId():        string        { return this.props.branchId }
  get cashRegisterId():  string | undefined { return this.props.cashRegisterId }
  get customerId():      string | undefined { return this.props.customerId }
  get tableId():         string | undefined { return this.props.tableId }
  get orderNumber():     string        { return this.props.orderNumber }
  get items():           SaleItem[]    { return this.props.items }
  get payments():        PaymentLine[] { return this.props.payments }
  get subtotal():        Money         { return this.props.subtotal }
  get taxTotal():        Money         { return this.props.taxTotal }
  get discountTotal():   Money         { return this.props.discountTotal }
  get total():           Money         { return this.props.total }
  get status():          SaleStatus    { return this.props.status }
  get notes():           string | undefined { return this.props.notes }
  get receiptNumber():   string | undefined { return this.props.receiptNumber }
  get createdBy():       string        { return this.props.createdBy }
  get completedBy():     string | undefined { return this.props.completedBy }
  get createdAt():       Date          { return this.props.createdAt }
  get completedAt():     Date | undefined   { return this.props.completedAt }
  get cancelledAt():     Date | undefined   { return this.props.cancelledAt }

  isCompleted(): boolean { return this.props.status === 'COMPLETED' }
  isCancelled(): boolean { return this.props.status === 'CANCELLED' }
}
