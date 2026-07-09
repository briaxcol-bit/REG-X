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
  discount: number
  discountAmount: number
  tax: number
  taxAmount: number
  total: number
  notes?: string
  isKitchen?: boolean
  isBar?: boolean
  addedByName?: string   // Mesero que agregó el ítem (órdenes de restaurante)
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

// ── Tab (cuenta individual) ───────────────────────────────────

export interface CartTab {
  id: string
  label: string
  items: CartItem[]
  discounts: CartDiscount[]
  payments: PaymentLine[]
  customerId?: string
  tableId?: string
  restaurantOrderId?: string   // ID de la orden de restaurante vinculada
  waiterName?: string          // Mesero principal de la mesa
  tip: number                  // Propina (no impositiva)
  notes: string
}

const MAIN_TAB_ID = 'main'

function newTab(label?: string): CartTab {
  return {
    id: nanoid(6),
    label: label ?? 'Nueva cuenta',
    items: [],
    discounts: [],
    payments: [],
    customerId: undefined,
    tableId: undefined,
    restaurantOrderId: undefined,
    tip: 0,
    notes: '',
  }
}

function emptyMain(): CartTab {
  return { ...newTab('Venta principal'), id: MAIN_TAB_ID }
}

// ── Helpers ──────────────────────────────────────────────────

const calcItemTotal = (item: Omit<CartItem, 'id' | 'total' | 'taxAmount' | 'discountAmount'>) => {
  const base           = item.price * item.quantity
  const discountAmount = base * (item.discount / 100)
  const afterDiscount  = base - discountAmount
  const taxAmount      = afterDiscount * (item.tax / 100)
  const total          = afterDiscount + taxAmount
  return { discountAmount, taxAmount, total }
}

// ── Store state / actions ─────────────────────────────────────

interface POSState {
  tabs:        CartTab[]
  activeTabId: string
  isOffline:   boolean
  session:     POSSession | null
  pendingSync: CartItem[][]
  lastReceipt: ReceiptData | null
}

interface POSActions {
  // Tab management
  addTab:        () => void
  removeTab:     (id: string) => void
  switchTab:     (id: string) => void
  renameTab:     (id: string, label: string) => void

  // Cart (all operate on activeTab)
  addItem:            (item: Omit<CartItem, 'id' | 'total' | 'taxAmount' | 'discountAmount'>) => void
  updateQuantity:     (id: string, quantity: number) => void
  removeItem:         (id: string) => void
  applyItemDiscount:  (id: string, discount: number) => void
  applyCartDiscount:  (discount: CartDiscount) => void
  removeCartDiscount: (index: number) => void
  addPayment:         (payment: PaymentLine) => void
  removePayment:      (index: number) => void
  setCustomer:        (customerId: string | undefined) => void
  setTable:           (tableId: string | undefined) => void
  setNotes:           (notes: string) => void
  setTip:             (amount: number) => void
  clearCart:          () => void
  /** Carga los ítems de una orden de restaurante en una nueva tab del POS */
  loadTableOrder: (params: {
    tableId:           string
    restaurantOrderId?: string
    label:              string
    waiterName?:        string
    items:              Omit<CartItem, 'id' | 'total' | 'taxAmount' | 'discountAmount'>[]
  }) => void

  // Session / misc
  setOffline:    (offline: boolean) => void
  setSession:    (session: POSSession | null) => void
  setLastReceipt:(receipt: ReceiptData | null) => void

  // Computed (active tab)
  getSubtotal:      () => number
  getTaxTotal:      () => number
  getDiscountTotal: () => number
  getTotal:         () => number   // total sin propina
  getTip:           () => number
  getGrandTotal:    () => number   // total + propina (lo que paga el cliente)
  getChange:        () => number
  getPendingAmount: () => number

}

// ── Store ────────────────────────────────────────────────────

export const usePOSStore = create<POSState & POSActions>()(
  persist(
    immer((set, get) => {
      // helper: get active tab (with fallback)
      const activeTab = (): CartTab => {
        const { tabs, activeTabId } = get()
        return tabs.find(t => t.id === activeTabId) ?? tabs[0] ?? emptyMain()
      }

      // helper: mutate active tab
      const mutateActive = (fn: (tab: CartTab) => void) =>
        set(state => {
          const tab = state.tabs.find(t => t.id === state.activeTabId)
          if (tab) fn(tab)
        })

      return {
        tabs:        [emptyMain()],
        activeTabId: MAIN_TAB_ID,
        isOffline:   false,
        session:     null,
        pendingSync: [],
        lastReceipt: null,

        // ── Tab management ───────────────────────────────────
        addTab: () => set(state => {
          const tab = newTab(`Cuenta ${state.tabs.length}`)
          state.tabs.push(tab)
          state.activeTabId = tab.id
        }),

        removeTab: (id) => set(state => {
          if (id === MAIN_TAB_ID) return          // main tab is permanent
          state.tabs = state.tabs.filter(t => t.id !== id)
          if (state.activeTabId === id) {
            state.activeTabId = state.tabs[state.tabs.length - 1]?.id ?? MAIN_TAB_ID
          }
        }),

        switchTab: (id) => set(state => { state.activeTabId = id }),

        renameTab: (id, label) => set(state => {
          const tab = state.tabs.find(t => t.id === id)
          if (tab) tab.label = label
        }),

        // ── Cart actions (active tab) ────────────────────────
        addItem: (item) => mutateActive(tab => {
          const existing = tab.items.find(
            i => i.productId === item.productId && i.variantId === item.variantId,
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
            tab.items.push({ ...item, id: nanoid(), ...calc })
          }
        }),

        updateQuantity: (id, quantity) => mutateActive(tab => {
          const item = tab.items.find(i => i.id === id)
          if (!item) return
          if (quantity <= 0) { tab.items = tab.items.filter(i => i.id !== id); return }
          if (quantity > item.stock) return
          item.quantity = quantity
          const calc = calcItemTotal(item)
          item.total = calc.total
          item.taxAmount = calc.taxAmount
          item.discountAmount = calc.discountAmount
        }),

        removeItem: (id) => mutateActive(tab => {
          tab.items = tab.items.filter(i => i.id !== id)
        }),

        applyItemDiscount: (id, discount) => mutateActive(tab => {
          const item = tab.items.find(i => i.id === id)
          if (!item) return
          item.discount = discount
          const calc = calcItemTotal(item)
          item.total = calc.total
          item.taxAmount = calc.taxAmount
          item.discountAmount = calc.discountAmount
        }),

        applyCartDiscount:  (d)  => mutateActive(tab => { tab.discounts.push(d) }),
        removeCartDiscount: (i)  => mutateActive(tab => { tab.discounts.splice(i, 1) }),
        addPayment:         (p)  => mutateActive(tab => { tab.payments.push(p) }),
        removePayment:      (i)  => mutateActive(tab => { tab.payments.splice(i, 1) }),
        setCustomer: (customerId) => mutateActive(tab => { tab.customerId = customerId }),
        setTable:    (tableId)    => mutateActive(tab => { tab.tableId = tableId }),
        setNotes:    (notes)      => mutateActive(tab => { tab.notes = notes }),
        setTip:      (amount)     => mutateActive(tab => { tab.tip = Math.max(0, amount) }),

        loadTableOrder: ({ tableId, restaurantOrderId, label, waiterName, items }) => set(state => {
          // Reusar tab existente si ya está abierta para esa mesa
          const existing = state.tabs.find(t => t.tableId === tableId)
          if (existing) {
            // Actualizar ítems y activar
            existing.restaurantOrderId = restaurantOrderId
            existing.label             = label
            existing.waiterName        = waiterName
            existing.items             = items.map(it => {
              const calc = calcItemTotal(it)
              return { ...it, id: nanoid(), ...calc }
            })
            state.activeTabId = existing.id
            return
          }
          // Crear nueva tab
          const tab: CartTab = {
            id:                nanoid(6),
            label,
            items:             items.map(it => {
              const calc = calcItemTotal(it)
              return { ...it, id: nanoid(), ...calc }
            }),
            discounts:         [],
            payments:          [],
            customerId:        undefined,
            tableId,
            restaurantOrderId,
            waiterName,
            tip:               0,
            notes:             '',
          }
          state.tabs.push(tab)
          state.activeTabId = tab.id
        }),

        clearCart: () => mutateActive(tab => {
          tab.items              = []
          tab.discounts          = []
          tab.payments           = []
          tab.customerId         = undefined
          tab.tableId            = undefined
          tab.restaurantOrderId  = undefined
          tab.tip                = 0
          tab.notes              = ''
        }),

        // ── Session / misc ─────
        setOffline:     (offline) => set(state => { state.isOffline = offline }),
        setSession:     (session) => set(state => { state.session = session }),
        setLastReceipt: (receipt) => set(state => { state.lastReceipt = receipt }),

        // ── Computed (active tab) ────────────────────────────
        getSubtotal: () => activeTab().items.reduce((acc, i) => acc + i.price * i.quantity, 0),

        getTaxTotal: () => activeTab().items.reduce((acc, i) => acc + i.taxAmount, 0),

        getDiscountTotal: () => {
          const tab = activeTab()
          const itemDiscounts = tab.items.reduce((acc, i) => acc + i.discountAmount, 0)
          const subtotal = tab.items.reduce((acc, i) => acc + i.price * i.quantity, 0)
          const cartDiscounts = tab.discounts.reduce((acc, d) => {
            if (d.type === 'PERCENTAGE') return acc + subtotal * (d.value / 100)
            return acc + d.value
          }, 0)
          return itemDiscounts + cartDiscounts
        },

        getTotal: () => {
          const { getSubtotal, getTaxTotal, getDiscountTotal } = get()
          return Math.max(0, getSubtotal() + getTaxTotal() - getDiscountTotal())
        },

        getTip: () => activeTab().tip ?? 0,

        getGrandTotal: () => get().getTotal() + (activeTab().tip ?? 0),

        getPendingAmount: () => {
          const tab  = activeTab()
          const paid = tab.payments.reduce((acc, p) => acc + p.amount, 0)
          return Math.max(0, get().getGrandTotal() - paid)
        },

        getChange: () => {
          const tab  = activeTab()
          const paid = tab.payments.reduce((acc, p) => acc + p.amount, 0)
          return Math.max(0, paid - get().getGrandTotal())
        },

      }
    }),
    {
      name: 'regx:pos-cart-v2',
      storage: createJSONStorage(() => localStorage),
      // Las tabs (cuentas abiertas) son por sesión de usuario — NO se persisten
      // para evitar que un usuario vea las cuentas abiertas de otro en el mismo browser.
      partialize: (state) => ({
        session:     state.session,
        pendingSync: state.pendingSync,
      }),
      },
  ),
)
