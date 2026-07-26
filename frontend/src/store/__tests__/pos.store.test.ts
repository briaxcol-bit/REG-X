import { describe, it, expect, beforeEach } from 'vitest'
import { usePOSStore } from '../pos.store'

const S = () => usePOSStore.getState()

const item = (over: Partial<Parameters<ReturnType<typeof usePOSStore.getState>['addItem']>[0]> = {}) => ({
  productId: 'p1',
  sku:       'SKU-1',
  name:      'Producto de prueba',
  price:     10_000,
  quantity:  1,
  stock:     50,
  discount:  0,
  tax:       0,
  discountAmount: 0,
  taxAmount:      0,
  total:          0,
  ...over,
})

beforeEach(() => {
  S().clearCart()
  // vaciar la cola offline entre tests
  for (const p of S().pendingSync) S().removePendingSale(p.id)
})

describe('pos.store — matemática del carrito', () => {
  it('ítem con descuento e impuesto: mismos números que valida el servidor', () => {
    // price 10000 × 2, desc 10%, IVA 19%
    S().addItem(item({ quantity: 2, discount: 10, tax: 19 }))
    const it0 = S().tabs.find(t => t.id === S().activeTabId)!.items[0]!

    expect(it0.discountAmount).toBeCloseTo(2_000)          // 20000 × 10%
    expect(it0.taxAmount).toBeCloseTo(3_420)               // 18000 × 19%
    expect(it0.total).toBeCloseTo(21_420)                  // 18000 + 3420

    expect(S().getSubtotal()).toBeCloseTo(20_000)
    expect(S().getTaxTotal()).toBeCloseTo(3_420)
    expect(S().getDiscountTotal()).toBeCloseTo(2_000)
    expect(S().getTotal()).toBeCloseTo(21_420)
  })

  it('invariante de la migración 061: total = max(0, subtotal + imp − desc)', () => {
    S().addItem(item({ productId: 'a', quantity: 3, discount: 5,  tax: 19 }))
    S().addItem(item({ productId: 'b', price: 3_500, quantity: 1, tax: 8 }))

    const subtotal = S().getSubtotal()
    const tax      = S().getTaxTotal()
    const disc     = S().getDiscountTotal()
    const total    = S().getTotal()

    // La función create_sale_transaction (v5) rechaza la venta si esta
    // ecuación no cuadra con tolerancia 0.5 — este test ancla el contrato.
    expect(total).toBeCloseTo(Math.max(0, subtotal + tax - disc), 1)
  })

  it('agregar el mismo producto suma cantidad y recalcula totales', () => {
    S().addItem(item({ quantity: 1, tax: 19 }))
    S().addItem(item({ quantity: 2, tax: 19 }))
    const tab = S().tabs.find(t => t.id === S().activeTabId)!
    expect(tab.items).toHaveLength(1)
    expect(tab.items[0]!.quantity).toBe(3)
    expect(tab.items[0]!.total).toBeCloseTo(30_000 * 1.19)
  })

  it('no permite vender más unidades que el stock', () => {
    S().addItem(item({ quantity: 5, stock: 3 }))
    const tab = S().tabs.find(t => t.id === S().activeTabId)!
    expect(tab.items).toHaveLength(0)   // rechazado de entrada

    S().addItem(item({ quantity: 3, stock: 3 }))
    S().addItem(item({ quantity: 1, stock: 3 }))   // excede: ignorado
    expect(S().tabs.find(t => t.id === S().activeTabId)!.items[0]!.quantity).toBe(3)
  })

  it('updateQuantity a 0 elimina el ítem', () => {
    S().addItem(item())
    const id = S().tabs.find(t => t.id === S().activeTabId)!.items[0]!.id
    S().updateQuantity(id, 0)
    expect(S().tabs.find(t => t.id === S().activeTabId)!.items).toHaveLength(0)
  })

  it('vuelto y pendiente de pago', () => {
    S().addItem(item({ quantity: 2 }))               // total 20.000
    S().addPayment({ method: 'CASH', amount: 50_000 } as any)
    expect(S().getChange()).toBeCloseTo(30_000)
    expect(S().getPendingAmount()).toBe(0)
  })
})

describe('pos.store — cola de ventas offline (ADR-003)', () => {
  const pending = (id: string) => ({
    id,
    tenantId: 't1', branchId: 'b1', userId: 'u1',
    payload: { total: 1000 },
    status: 'PENDING' as const,
    createdAt: new Date().toISOString(),
  })

  it('encola, marca en revisión y elimina', () => {
    S().queuePendingSale(pending('s1') as any)
    S().queuePendingSale(pending('s2') as any)
    expect(S().pendingSync).toHaveLength(2)

    S().markPendingReview('s1', 'stock insuficiente')
    const s1 = S().pendingSync.find(p => p.id === 's1')!
    expect(s1.status).toBe('REVIEW')
    expect(s1.error).toBe('stock insuficiente')

    S().removePendingSale('s2')
    expect(S().pendingSync.map(p => p.id)).toEqual(['s1'])
  })
})
