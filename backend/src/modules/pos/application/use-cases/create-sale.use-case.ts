import { Injectable, Inject, BadRequestException } from '@nestjs/common'
import { Sale } from '../../domain/entities/sale.entity'
import { Money } from '@shared/domain/value-objects/money.vo'
import { EventBusService } from '@shared/events/event-bus.service'
import { RedisService } from '@shared/infrastructure/redis/redis.service'
import { SupabaseService } from '@shared/infrastructure/supabase/supabase.service'
import { v4 as uuidv4 } from 'uuid'

export interface CreateSaleCommand {
  tenantId:        string
  branchId:        string
  cashRegisterId?: string
  userId:          string
  customerId?:     string
  tableId?:        string
  currency:        string
  notes?:          string
  items: Array<{
    productId:   string
    variantId?:  string
    sku:         string
    name:        string
    quantity:    number
    unitPrice:   number
    discount:    number
    tax:         number
  }>
  payments: Array<{
    method:      string
    amount:      number
    reference?:  string
  }>
}

@Injectable()
export class CreateSaleUseCase {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventBus: EventBusService,
    private readonly redis: RedisService,
  ) {}

  async execute(cmd: CreateSaleCommand): Promise<Sale> {
    const { tenantId, branchId, userId, currency } = cmd

    // ── Validate cash register is open ──────────────────
    if (cmd.cashRegisterId) {
      const { data: register } = await this.supabase.admin
        .from('cash_registers')
        .select('status')
        .eq('id', cmd.cashRegisterId)
        .single()
      if (!register || register.status !== 'OPEN') {
        throw new BadRequestException('Cash register is not open')
      }
    }

    // ── Build Money values ───────────────────────────────
    const items = cmd.items.map((item) => {
      const unitPrice     = Money.of(item.unitPrice, currency)
      const base          = unitPrice.multiply(item.quantity)
      const discountAmt   = base.percentage(item.discount)
      const afterDiscount = base.subtract(discountAmt)
      const taxAmt        = afterDiscount.percentage(item.tax)
      const total         = afterDiscount.add(taxAmt)
      return {
        id:             uuidv4(),
        productId:      item.productId,
        variantId:      item.variantId,
        sku:            item.sku,
        name:           item.name,
        quantity:       item.quantity,
        unitPrice,
        discount:       item.discount,
        discountAmount: discountAmt,
        tax:            item.tax,
        taxAmount:      taxAmt,
        total,
      }
    })

    const subtotal      = items.reduce((acc, i) => acc.add(i.unitPrice.multiply(i.quantity)), Money.zero(currency))
    const taxTotal      = items.reduce((acc, i) => acc.add(i.taxAmount),      Money.zero(currency))
    const discountTotal = items.reduce((acc, i) => acc.add(i.discountAmount), Money.zero(currency))
    const total         = subtotal.subtract(discountTotal).add(taxTotal)

    const payments = cmd.payments.map((p) => ({
      method:    p.method as any,
      amount:    Money.of(p.amount, currency),
      reference: p.reference,
    }))

    // ── Validate payment covers total ────────────────────
    const totalPaid = payments.reduce((acc, p) => acc.add(p.amount), Money.zero(currency))
    if (totalPaid.amount < total.amount) {
      throw new BadRequestException(
        `Payment amount (${totalPaid}) is less than total (${total})`,
      )
    }

    // ── Generate order number ────────────────────────────
    const orderNumber = await this.generateOrderNumber(tenantId, branchId)

    // ── Create Sale aggregate ────────────────────────────
    const sale = Sale.create({
      tenantId, branchId,
      cashRegisterId: cmd.cashRegisterId,
      customerId:     cmd.customerId,
      tableId:        cmd.tableId,
      orderNumber,
      items,
      payments,
      subtotal,
      taxTotal,
      discountTotal,
      total,
      notes:     cmd.notes,
      createdBy: userId,
    })

    // ── Complete immediately (sync POS flow) ─────────────
    const receiptNumber = `RCT-${orderNumber}`
    sale.complete(userId, receiptNumber)

    // ── Persist ──────────────────────────────────────────
    await this.persistSale(sale)

    // ── Publish events ───────────────────────────────────
    await this.eventBus.publishFromAggregate(sale)

    // ── Publish to Redis Streams (for webhooks/KDS) ──────
    await this.redis.publishEvent('sale.completed', {
      saleId:      sale.id,
      tenantId:    sale.tenantId,
      branchId:    sale.branchId,
      total:       sale.total.toJSON(),
      tableId:     sale.tableId,
      itemCount:   sale.items.length,
      orderNumber: sale.orderNumber,
    })

    return sale
  }

  private async persistSale(sale: Sale): Promise<void> {
    // Insert sale + items + payments in a single Supabase transaction via RPC
    const { error } = await this.supabase.admin.rpc('create_sale_transaction', {
      p_sale: {
        id:              sale.id,
        tenant_id:       sale.tenantId,
        branch_id:       sale.branchId,
        cash_register_id: sale.cashRegisterId ?? null,
        customer_id:     sale.customerId ?? null,
        table_id:        sale.tableId ?? null,
        order_number:    sale.orderNumber,
        subtotal:        sale.subtotal.amount,
        tax_total:       sale.taxTotal.amount,
        discount_total:  sale.discountTotal.amount,
        total:           sale.total.amount,
        currency:        sale.total.currency,
        status:          sale.status,
        receipt_number:  sale.receiptNumber,
        notes:           sale.notes ?? null,
        created_by:      sale.createdBy,
        completed_by:    sale.completedBy ?? null,
        completed_at:    sale.completedAt?.toISOString() ?? null,
        created_at:      sale.createdAt.toISOString(),
        updated_at:      sale.createdAt.toISOString(),
      },
      p_items: sale.items.map((i) => ({
        id:              i.id,
        sale_id:         sale.id,
        product_id:      i.productId,
        variant_id:      i.variantId ?? null,
        sku:             i.sku,
        name:            i.name,
        quantity:        i.quantity,
        unit_price:      i.unitPrice.amount,
        discount:        i.discount,
        discount_amount: i.discountAmount.amount,
        tax:             i.tax,
        tax_amount:      i.taxAmount.amount,
        total:           i.total.amount,
        notes:           i.notes ?? null,
      })),
      p_payments: sale.payments.map((p) => ({
        sale_id:   sale.id,
        method:    p.method,
        amount:    p.amount.amount,
        reference: p.reference ?? null,
      })),
    })

    if (error) throw new Error(`Failed to persist sale: ${error.message}`)
  }

  private async generateOrderNumber(tenantId: string, branchId: string): Promise<string> {
    const key     = `regx:order-seq:${tenantId}:${branchId}`
    const seq     = await this.redis.incrementRateLimit(key, 86400) // 24h window
    const date    = new Date()
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    return `${dateStr}-${String(seq).padStart(4, '0')}`
  }
}
