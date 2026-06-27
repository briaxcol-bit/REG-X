import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { ReceiptData } from '@modules/pos/components/ReceiptTemplate'

// ── Types ────────────────────────────────────────────────────

export interface CartItem {
  id: string
  productId: string
  variantId?: string
  sku: string
  name: string
  price: number
  quantity: number
  stock: number
  discount: number          // percentage 0-100
  discountAmount: number    // absolute
  tax: number               // percentage
  taxAmount: number
  total: number
  notes?: string
  isKitchen?: boolean
  isBar?: boolean
}

export interface CartDiscount {
  type: 'PERCENTAGE' | 'AMOUNT' | 'COUPON'
  value: number
  code?: string
  description: string
}

export interface PaymentLine {
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'QR' | 'GIFT_CARD' | 'MIXED'
  amount: number
  reference?: string
}

export interface POSSession {
  sessionId: string
  cashRegisterId: string
  openedAt: string
  openingCash: number
  cashierId: string
}

interface POSState {
  items: CartItem[]
  discounts: CartDiscount[]
  payments: PaymentLine[]
  customerId?: string | undefined
  tableId?: string | undefined
  orderId?: string | undefined
  notes: string
  isOffline: boolean
  session: POSSession | null
  pendingSync: CartItem[][]
  lastReceipt: ReceiptData | null
}

interface POSActions {
  addItem: (item: Omit<CartItem, 'id' | 'total' | 'taxAmount' | 'discountAmount'>) => void
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  applyItemDiscount: (id: string, discount: number) => void
  applyCartDiscount: (discount: CartDiscount) => void
  removeCartDiscount: (index: number) => void
  addPayment: (payment: PaymentLine) => void
  removePayment: (index: number) => void
  setCustomer: (customerId: string | undefined) => void
  setTable: (tableId: string | undefined) => void
  setNotes: (notes: string) => void
  setOffline: (offline: boolean) => void
  setSession: (session: POSSession | null) => void
  setLastReceipt: (receipt: ReceiptData | null) => void
  clearCart: () => void
  // Computed
  getSubtotal: () => number
  getTaxTotal: () => number
  getDiscountTotal: () => number
  getTotal: () => number
  getChange: () => number
  getPendingAmount: () => number
}

// ── Helpers ──────────────────────────────────────────────────

const calcItemTotal = (item: Omit<CartItem, 'id' | 'total' | 'taxAmount' | 'discountAmount'>) => {
  const base = item.price * item.quantity
  const discountAmount = base * (item.discount / 100)
  const afterDiscount = base - discountAmount
  const taxAmount = afterDiscount * (item.tax / 100)
  const total = afterDiscount + taxAmount
  return { discountAmount, taxAmount, total }
}

// ── Store ────────────────────────────────────────────────────

export const usePOSStore = create<POSState & POSActions>()(
  persist(
    immer((set, get) => ({
      items: [],
      discounts: [],
      payments: [],
      customerId: undefined,
      tableId: undefined,
      orderId: undefined,
      notes: '',
      isOffline: false,
      session: null,
      pendingSync: [],
      lastReceipt: null,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variantId === item.variantId,
          )
          if (existing) {
            if (existing.quantity >= existing.stock) return
            existing.quantity += item.quantity
            const calc = calcItemTotal(existing)
            existing.total = calc.total
            existing.taxAmount = calc.taxAmount
            existing.discountAmount = calc.discountAmount
          } else {
            if (item.quantity > item.stock) return
            const calc = calcItemTotal(item)
            state.items.push({ ...item, id: nanoid(), ...calc })
          }
        }),

      updateQuantity: (id, quantity) =>
        set((state) => {
          const item = state.items.find((i) => i.id === id)
          if (!item) return
          if (quantity <= 0) {
            state.items = state.items.filter((i) => i.id !== id)
            return
          }
          if (quantity > item.stock) return
          item.quantity = quantity
          const calc = calcItemTotal(item)
          item.total = calc.total
          item.taxAmount = calc.taxAmount
          item.discountAmount = calc.discountAmount
        }),

      removeItem: (id) =>
        set((state) => {
          state.items = state.items.filter((i) => i.id !== id)
        }),

      applyItemDiscount: (id, discount) =>
        set((state) => {
          const item = state.items.find((i) => i.id === id)
          if (!item) return
          item.discount = discount
          const calc = calcItemTotal(item)
          item.total = calc.total
          item.taxAmount = calc.taxAmount
          item.discountAmount = calc.discountAmount
        }),

      applyCartDiscount: (discount) =>
        set((state) => { state.discounts.push(discount) }),

      removeCartDiscount: (index) =>
        set((state) => { state.discounts.splice(index, 1) }),

      addPayment: (payment) =>
        set((state) => { state.payments.push(payment) }),

      removePayment: (index) =>
        set((state) => { state.payments.splice(index, 1) }),

      setCustomer: (customerId) =>
        set((state) => { state.customerId = customerId }),

      setTable: (tableId) =>
        set((state) => { state.tableId = tableId }),

      setNotes: (notes) =>
        set((state) => { state.notes = notes }),

      setOffline: (offline) =>
        set((state) => { state.isOffline = offline }),

      setSession: (session) =>
        set((state) => { state.session = session }),

      setLastReceipt: (receipt) =>
        set((state) => { state.lastReceipt = receipt }),

      clearCart: () =>
        set((state) => {
          state.items = []
          state.discounts = []
          state.payments = []
          state.customerId = undefined
          state.tableId = undefined
          state.orderId = undefined
          state.notes = ''
        }),

      // ── Computed ──────────────────────────────────────────

      getSubtotal: () => {
        const { items } = get()
        return items.reduce((acc, i) => acc + i.price * i.quantity, 0)
      },

      getTaxTotal: () => {
        const { items } = get()
        return items.reduce((acc, i) => acc + i.taxAmount, 0)
      },

      getDiscountTotal: () => {
        const { items, discounts, getSubtotal } = get()
        const itemDiscounts = items.reduce((acc, i) => acc + i.discountAmount, 0)
        const cartDiscounts = discounts.reduce((acc, d) => {
          if (d.type === 'PERCENTAGE') return acc + getSubtotal() * (d.value / 100)
          return acc + d.value
        }, 0)
        return itemDiscounts + cartDiscounts
      },

      getTotal: () => {
        const { getSubtotal, getTaxTotal, getDiscountTotal } = get()
        return Math.max(0, getSubtotal() + getTaxTotal() - getDiscountTotal())
      },

      getPendingAmount: () => {
        const { payments, getTotal } = get()
        const paid = payments.reduce((acc, p) => acc + p.amount, 0)
        return Math.max(0, getTotal() - paid)
      },

      getChange: () => {
        const { payments, getTotal } = get()
        const paid = payments.reduce((acc, p) => acc + p.amount, 0)
        return Math.max(0, paid - getTotal())
      },
    })),
    {
      name: 'regx:pos-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        discounts: state.discounts,
        customerId: state.customerId,
        tableId: state.tableId,
        notes: state.notes,
        session: state.session,
        pendingSync: state.pendingSync,
      }),
    },
  ),
)
