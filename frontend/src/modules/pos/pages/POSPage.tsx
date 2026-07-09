import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Barcode, Plus, Minus, Trash2, CreditCard,
  Receipt, X, UserCircle, Lock, Clock, Tag, Printer,
  ShoppingCart, Clock as HistoryIcon, Monitor, ClipboardList,
  UtensilsCrossed, ChevronDown, User,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePOSStore, type CartItem } from '@store/pos.store'
import { useAuthStore } from '@store/auth.store'
import { supabase } from '@lib/supabase'
import { ReceiptTemplate } from '@modules/pos/components/ReceiptTemplate'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/format'
import { useProducts, useCategories } from '@modules/products/hooks/useProducts'
import { CheckoutModal } from '@modules/pos/components/CheckoutModal'
import { BarcodeScanner } from '@modules/pos/components/BarcodeScanner'
import { CustomerPicker } from '@modules/pos/components/CustomerPicker'
import { OpenCashModal } from '@modules/pos/components/OpenCashModal'
import { CloseCashModal } from '@modules/pos/components/CloseCashModal'
import { SalesHistoryModal } from '@modules/pos/components/SalesHistoryModal'
import { ManageTerminalsModal } from '@modules/pos/components/ManageTerminalsModal'
import { CompleteComandaModal } from '@modules/pos/components/CompleteComandaModal'
import { useCashSession } from '@modules/pos/hooks/useCashSession'
import { usePOSTerminal } from '@modules/pos/hooks/usePOSTerminal'
import { useCreateSale } from '@modules/pos/hooks/useCreateSale'
import { getPendingSales, getPOSTerminals, getActiveTableOrders, getAllActiveOrdersForTable, closeAllOrdersForTable, type SaleHistoryRow, type RestaurantOrderRow, type TableRow } from '@lib/db'
import { TableMapModal } from '@modules/pos/components/TableMapModal'
import { toast } from 'sonner'

// Función global — disponible para CartRow y handleAddProduct sin pasar props
async function sendBrowserPush(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined') return
  let perm = Notification.permission
  if (perm === 'default') perm = await Notification.requestPermission()
  if (perm !== 'granted') return
  new Notification(title, { body, icon: '/pwa-192x192.png', tag })
}

// ── Product card ─────────────────────────────────────────────
function ProductCard({ product, onAdd }: {
  product: { id: string; name: string; price: number; imageUrl?: string; sku: string; stock: number; categoryColor?: string; tax: number }
  onAdd: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onAdd}
      disabled={product.stock === 0}
      className={cn(
        'group relative flex flex-col rounded-xl border bg-white dark:bg-grafito-800 overflow-hidden transition-all duration-150 text-left',
        product.stock === 0
          ? 'border-grafito-200 dark:border-white/5 opacity-50 cursor-not-allowed'
          : 'border-grafito-200 dark:border-white/5 hover:border-brand-500/50 hover:shadow-md dark:hover:border-brand-500/30',
      )}
    >
      {/* Image */}
      <div className="h-40 w-full overflow-hidden bg-grafito-50 dark:bg-grafito-700/50 relative flex items-center justify-center">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-2xl font-black text-white"
            style={{ backgroundColor: product.categoryColor ?? '#374151' }}>
            {product.name[0]?.toUpperCase()}
          </div>
        )}
        {/* Badge de stock — siempre visible */}
        <span className={cn(
          'absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold border',
          product.stock === 0
            ? 'bg-red-500 text-white border-red-600/20'
            : product.stock <= 5
              ? 'bg-amber-400 text-amber-900 border-amber-500/20'
              : 'bg-white/90 dark:bg-grafito-900/90 text-grafito-700 dark:text-grafito-200 border-black/5 dark:border-white/10',
        )}>
          {product.stock} uds
        </span>
        {product.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-grafito-900/60">
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Agotado</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-2.5 flex-1 flex flex-col">
        <p className="text-xs font-semibold text-grafito-800 dark:text-white line-clamp-2 leading-tight mb-auto">{product.name}</p>
        <p className="text-sm font-black text-brand-500 mt-1.5">{formatCurrency(product.price)}</p>
      </div>
      {/* Add overlay */}
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-brand-500/15 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 shadow-lg">
          <Plus className="h-5 w-5 text-white" />
        </div>
      </div>
    </motion.button>
  )
}

// ── Cart row ──────────────────────────────────────────────────
function CartRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = usePOSStore()
  const [inputValue, setInputValue] = useState(item.quantity.toString())
  const [expanded, setExpanded]     = useState(false)
  const hasDetail = !!(item.addedByName || item.notes)

  useEffect(() => { setInputValue(item.quantity.toString()) }, [item.quantity])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-xl border border-grafito-100 dark:border-white/5 bg-grafito-50 dark:bg-white/[0.03] overflow-hidden group"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Name + price */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-grafito-900 dark:text-white truncate">{item.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-grafito-500">{formatCurrency(item.price)} c/u</p>
            {item.discount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-500">
                <Tag className="h-2.5 w-2.5" />−{item.discount}%
              </span>
            )}
          </div>
        </div>

        {/* Qty controls */}
        <div className="flex items-center rounded-lg border border-grafito-200 dark:border-white/10 overflow-hidden shrink-0">
          <button
            onClick={() => updateQuantity(item.id, item.quantity - 1)}
            className="flex h-7 w-7 items-center justify-center text-grafito-500 hover:bg-brand-500/10 hover:text-brand-500 transition-colors"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number" min={1} max={item.stock}
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value)
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v > 0) {
                if (v > item.stock) {
                  toast.error(`Solo hay ${item.stock} ud${item.stock !== 1 ? 's' : ''} de "${item.name}".`, { duration: 3000 })
                  sendBrowserPush('Stock máximo', `Solo hay ${item.stock} unidades de "${item.name}" disponibles.`, `stock-max-${item.id}`)
                  updateQuantity(item.id, item.stock)
                  setInputValue(item.stock.toString())
                } else {
                  updateQuantity(item.id, v)
                }
              }
            }}
            onBlur={() => {
              const v = parseInt(inputValue)
              if (isNaN(v) || v < 1) { updateQuantity(item.id, 1); setInputValue('1') }
              else if (v > item.stock) setInputValue(item.stock.toString())
            }}
            className="w-10 text-center text-xs font-bold text-grafito-900 dark:text-white bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => {
              if (item.quantity >= item.stock) {
                toast.error(`Solo hay ${item.stock} ud${item.stock !== 1 ? 's' : ''} de "${item.name}".`, { duration: 3000 })
                sendBrowserPush('Stock máximo', `Solo hay ${item.stock} unidades de "${item.name}" disponibles.`, `stock-max-${item.id}`)
                return
              }
              updateQuantity(item.id, item.quantity + 1)
            }}
            className={cn(
              'flex h-7 w-7 items-center justify-center transition-colors',
              item.quantity >= item.stock
                ? 'text-grafito-300 dark:text-grafito-700 cursor-not-allowed'
                : 'text-grafito-500 hover:bg-brand-500/10 hover:text-brand-500'
            )}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Total + detail toggle + delete */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm font-black text-grafito-900 dark:text-white w-16 text-right">
            {formatCurrency(item.total)}
          </span>
          {hasDetail && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="rounded-lg p-1 text-grafito-400 hover:text-brand-500 transition-colors"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
          <button
            onClick={() => removeItem(item.id)}
            className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-grafito-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {expanded && hasDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 space-y-1 border-t border-grafito-100 dark:border-white/5 pt-2">
              {item.addedByName && (
                <div className="flex items-center gap-1.5 text-xs text-grafito-500">
                  <User className="h-3 w-3 shrink-0" />
                  <span>Agregado por <span className="font-semibold text-grafito-700 dark:text-grafito-300">{item.addedByName}</span></span>
                </div>
              )}
              {item.notes && (
                <p className="text-xs text-amber-600 dark:text-amber-400 pl-4">• {item.notes}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function POSPage() {
  const [search, setSearch]                   = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen]       = useState(false)
  const [scannerOpen, setScannerOpen]         = useState(false)
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [customerName, setCustomerName]             = useState<string | null>(null)
  const [closeModalOpen, setCloseModalOpen]   = useState(false)
  const [editingTabId, setEditingTabId]       = useState<string | null>(null)
  const [editingLabel, setEditingLabel]       = useState('')
  const [historyOpen, setHistoryOpen]         = useState(false)
  const [terminalsOpen, setTerminalsOpen]     = useState(false)
  const [mesasOpen,     setMesasOpen]         = useState(false)
  const [selectedComanda, setSelectedComanda] = useState<SaleHistoryRow | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    tabs, activeTabId,
    addItem, clearCart,
    setCustomer, setTip, loadTableOrder,
    getSubtotal, getTaxTotal, getDiscountTotal, getTotal, getTip, getGrandTotal,
    lastReceipt, setLastReceipt,
    addTab, removeTab, switchTab, renameTab,
  } = usePOSStore()

  // Derivar datos de la tab activa directamente (reactivo con Zustand)
  const activeTab   = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const items       = activeTab?.items      ?? []
  const customerId  = activeTab?.customerId
  const tipAmount   = activeTab?.tip        ?? 0

  const { branch, tenant, profile, hasRole } = useAuthStore()
  const currency    = branch?.currency ?? 'COP'
  const isManager   = hasRole('OWNER') || hasRole('ADMIN')
  const queryClient = useQueryClient()

  const { activeRegister, isLoading: loadingSession, hasOpenSession } = useCashSession()
  const { terminal, isCommandsOnly, allowedCategories } = usePOSTerminal()
  const { mutateAsync: createSaleCmd, isPending: sendingCmd } = useCreateSale()

  // ¿Hay algún terminal COMMANDS_ONLY en este branch?
  const { data: allTerminals = [] } = useQuery({
    queryKey: ['pos-terminals', tenant?.tenantId, branch?.branchId],
    queryFn:  () => getPOSTerminals(tenant!.tenantId, branch!.branchId),
    enabled:  isManager && !!tenant?.tenantId && !!branch?.branchId,
    staleTime: 60_000,
  })
  const hasComandasMode = allTerminals.some(t => t.mode === 'COMMANDS_ONLY')

  // Comandas pendientes (solo si hay terminales de comandas)
  const { data: pendingSales = [] } = useQuery({
    queryKey: ['pending-sales', tenant?.tenantId, branch?.branchId],
    queryFn:  () => getPendingSales(tenant!.tenantId, branch!.branchId),
    enabled:  isManager && hasComandasMode && !!tenant?.tenantId && !!branch?.branchId,
    refetchInterval: 15_000,
  })

  // Cuentas de mesa activas — visible para el cajero
  const { data: tableOrders = [] } = useQuery<RestaurantOrderRow[]>({
    queryKey: ['active-table-orders', tenant?.tenantId, branch?.branchId],
    queryFn:  () => getActiveTableOrders(tenant!.tenantId, branch!.branchId),
    enabled:  !!tenant?.tenantId && !!branch?.branchId,
    refetchInterval: 5_000,   // polling cada 5s como fallback
  })

  // Refs para evitar closures stale en los callbacks de Realtime
  const tabsRef                  = useRef(tabs)
  const handleLoadTableOrdersRef = useRef<((orders: RestaurantOrderRow[]) => void) | null>(null)
  useEffect(() => { tabsRef.current = tabs }, [tabs])

  // Realtime: actualiza la sidebar Y recarga el tab abierto si la mesa tiene uno
  useEffect(() => {
    if (!tenant?.tenantId) return

    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ['active-table-orders'] })

    // Cuando llega un evento de orders, recarga el tab abierto para esa mesa
    const refreshTabForTable = async (tableId: string | null | undefined) => {
      if (!tableId || !tenant?.tenantId) return
      const openTab = tabsRef.current.find(t => t.tableId === tableId)
      if (!openTab) return
      try {
        const orders = await getAllActiveOrdersForTable(tenant.tenantId, tableId)
        handleLoadTableOrdersRef.current?.(orders)
      } catch { /* silent */ }
    }

    const channel = supabase
      .channel(`pos-table-orders-${tenant.tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        invalidate()
        const tableId = (payload.new as any)?.table_id ?? (payload.old as any)?.table_id
        refreshTabForTable(tableId)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        invalidate()
        // Para order_items no tenemos table_id directo — refrescamos todos los tabs de mesa abiertos
        const tableIds = [...new Set(
          tabsRef.current.filter(t => t.tableId).map(t => t.tableId!)
        )]
        tableIds.forEach(refreshTabForTable)
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') invalidate()
      })

    return () => { supabase.removeChannel(channel) }
  }, [tenant?.tenantId, queryClient])

  // Cargar cuenta de mesa en el POS — consolida TODAS las comandas activas de la mesa
  const handleLoadTableOrders = useCallback((orders: RestaurantOrderRow[]) => {
    if (orders.length === 0) return
    const firstOrder = orders[0]!
    const allItems   = orders.flatMap(o => o.order_items ?? [])
    const posItems   = allItems.map(item => ({
      productId:      item.product_id,
      sku:            item.products?.sku   ?? item.sku   ?? '',
      name:           item.products?.name  ?? item.name  ?? 'Producto',
      price:          item.products?.price ?? item.unit_price ?? 0,
      quantity:       item.quantity,
      stock:          9999,
      discount:       0,
      discountAmount: 0,
      tax:            0,
      taxAmount:      0,
      addedByName:    (item as any).added_by_name ?? undefined,
    }))
    const waiterName = allItems.map(i => (i as any).added_by_name).find(Boolean) ?? undefined
    const tableLabel = `${firstOrder.tables?.number ?? '?'}${firstOrder.tables?.name ? ` · ${firstOrder.tables.name}` : ''}`
    loadTableOrder({
      tableId:    firstOrder.table_id!,
      label:      tableLabel,
      waiterName,
      items:      posItems,
    })
    toast.success(`${tableLabel} cargada en POS`)
  }, [loadTableOrder])

  // Mantener el ref actualizado para que el callback de Realtime siempre use la versión más reciente
  useEffect(() => { handleLoadTableOrdersRef.current = handleLoadTableOrders }, [handleLoadTableOrders])

  // Selección desde el mapa de mesas en el modal
  const handleTableSelectFromMap = useCallback(async (table: TableRow) => {
    const tableLabel = `${table.number ?? '?'}${table.name ? ` · ${table.name}` : ''}`
    if (table.status === 'OCCUPIED') {
      try {
        const orders = await getAllActiveOrdersForTable(tenant!.tenantId, table.id)
        if (orders.length > 0) {
          handleLoadTableOrders(orders)
          return
        }
      } catch {}
    }
    // Mesa disponible / sin orden activa: abrir una tab vacía para esa mesa
    loadTableOrder({ tableId: table.id, label: tableLabel, items: [] })
    toast.success(`${tableLabel} abierta en POS`)
  }, [tenant, loadTableOrder, handleLoadTableOrders])

  const { data: allCategories = [] } = useCategories()

  // Categorías visibles para este cajero
  const visibleCategories = allowedCategories
    ? allCategories.filter(c => allowedCategories.includes(c.id))
    : allCategories

  const { data: products = [], isLoading: loadingProducts } = useProducts({
    search,
    categoryId: selectedCategory ?? undefined,
  })

  // Filtrar productos por categorías permitidas si hay restricción
  const visibleProducts = allowedCategories
    ? products.filter(p => !p.categoryId || allowedCategories.includes(p.categoryId))
    : products

  // Enviar comanda (modo COMMANDS_ONLY) — crea venta PENDING e imprime ticket
  const handleSendComanda = async () => {
    if (items.length === 0) return
    try {
      const sale = await createSaleCmd({
        items: items.map(it => ({
          product_id:      it.productId,
          name:            it.name,
          sku:             it.sku,
          quantity:        it.quantity,
          unit_price:      it.price,
          discount:        it.discount,
          discount_amount: it.discountAmount,
          tax:             it.tax,
          tax_amount:      it.taxAmount,
          total:           it.total,
        })),
        payments:         [],
        customer_id:      customerId,
        notes:            'COMANDA',
        cash_register_id: activeRegister?.id,
        subtotal:       getSubtotal(),
        tax_total:      getTaxTotal(),
        discount_total: getDiscountTotal(),
        total:          getTotal(),
        currency,
        status:         'PENDING',
      })

      // Construir ticket de comanda e imprimir
      const receipt = {
        businessName:  tenant?.tenantName ?? '',
        branchName:    branch?.branchName ?? '',
        nit:           '',
        orderNumber:   sale?.order_number ?? String(Date.now()),
        cashierName:   profile?.fullName ?? 'Cajero',
        date:          new Date(),
        items:         items.map(it => ({
          name:     it.name,
          qty:      it.quantity,
          price:    it.price,
          total:    it.total,
          discount: it.discountAmount,
          tax:      it.tax,
          taxAmt:   it.taxAmount,
        })),
        subtotal:      getSubtotal(),
        discountTotal: getDiscountTotal(),
        taxBase:       0,
        taxTotal:      getTaxTotal(),
        total:         getTotal(),
        paymentMethod: '',
        currency,
        isComanda:     true,
      }
      setLastReceipt(receipt)
      setTimeout(() => window.print(), 80)

      clearCart()
      toast.success('Comanda enviada')
    } catch {
      toast.error('Error al enviar la comanda')
    }
  }

  const handleAddProduct = useCallback((product: typeof products[0]) => {
    if (product.stock === 0) {
      toast.error(`"${product.name}" está agotado.`, { duration: 3000 })
      sendBrowserPush('Producto agotado', `"${product.name}" no tiene unidades en inventario.`, `agotado-${product.id}`)
      return
    }
    const existing = items.find(i => i.productId === product.id)
    if (existing && existing.quantity >= product.stock) {
      toast.error(`Solo hay ${product.stock} ud${product.stock !== 1 ? 's' : ''} de "${product.name}".`, { duration: 3000 })
      sendBrowserPush('Stock máximo', `Solo hay ${product.stock} unidad${product.stock !== 1 ? 'es' : ''} de "${product.name}".`, `stock-max-${product.id}`)
      return
    }
    addItem({ productId: product.id, sku: product.sku, name: product.name, price: product.price, quantity: 1, stock: product.stock, discount: 0, tax: product.tax ?? 0 })
  }, [addItem, items])

  const handleBarcodeScanned = useCallback((barcode: string) => {
    setScannerOpen(false)
    setSearch(barcode)
    searchRef.current?.focus()
  }, [])

  const subtotal   = getSubtotal()
  const taxes      = getTaxTotal()
  const discounts  = getDiscountTotal()
  const total      = getTotal()
  const tip        = getTip()
  const grandTotal = getGrandTotal()
  const itemCount  = items.reduce((acc, i) => acc + i.quantity, 0)

  const sessionDuration = (() => {
    if (!activeRegister) return ''
    const ms = Date.now() - new Date(activeRegister.opened_at).getTime()
    const h  = Math.floor(ms / 3_600_000)
    const m  = Math.floor((ms % 3_600_000) / 60_000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  })()

  return (
    <div className="flex h-full overflow-hidden bg-grafito-50 dark:bg-grafito-950">
      {/* Recibo térmico — portal directo en document.body para que @media print lo controle sin conflictos */}
      {createPortal(
        <div id="pos-receipt" style={{ display: 'none' }}>
          {lastReceipt && <ReceiptTemplate data={lastReceipt} />}
        </div>,
        document.body,
      )}

      {/* Modales */}
      <OpenCashModal
        open={!loadingSession && !hasOpenSession}
        isCommandsOnly={isCommandsOnly}
        terminalName={terminal?.name}
      />
      {activeRegister && (
        <CloseCashModal
          open={closeModalOpen}
          onClose={() => setCloseModalOpen(false)}
          register={activeRegister}
          isCommandsOnly={isCommandsOnly}
        />
      )}
      <SalesHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} activeRegister={activeRegister ?? null} />
      {isManager && <ManageTerminalsModal open={terminalsOpen} onClose={() => setTerminalsOpen(false)} />}
      <CompleteComandaModal
        open={!!selectedComanda}
        onClose={() => setSelectedComanda(null)}
        sale={selectedComanda}
        currency={currency}
      />
      {mesasOpen && (
        <TableMapModal
          onClose={() => setMesasOpen(false)}
          onTableSelect={handleTableSelectFromMap}
        />
      )}

      {/* ══════════════ LEFT: Productos ══════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Barra superior */}
        <div className="flex items-center gap-3 border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 px-4 py-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-grafito-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras…"
              className="flex-1 bg-transparent text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-grafito-400 hover:text-grafito-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setScannerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 text-grafito-500 hover:text-brand-500 hover:border-brand-500/40 transition-colors"
          >
            <Barcode className="h-5 w-5" />
          </button>
        </div>

        {/* Categorías */}
        <div className="flex gap-2 overflow-x-auto bg-white dark:bg-grafito-900 px-4 py-2 border-b border-grafito-100 dark:border-white/5 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              !selectedCategory
                ? 'bg-brand-500 text-white'
                : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700',
            )}
          >
            Todos
          </button>
          {visibleCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap',
                selectedCategory === cat.id
                  ? 'text-white'
                  : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700',
              )}
              style={selectedCategory === cat.id ? { backgroundColor: cat.color || '#6366f1' } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Barra de tabs — siempre visible */}
        <div className="border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 flex items-center overflow-x-auto scrollbar-none">

          {/* Tabs de cuentas abiertas */}
          {tabs.map(tab => {
            const isActive   = tab.id === activeTabId
            const isMain     = tab.id === 'main'
            const isEditing  = editingTabId === tab.id
            const tabTotal   = tab.items.reduce((s, i) => s + i.total, 0)

            const startEdit = (e: React.MouseEvent) => {
              if (isMain) return
              e.stopPropagation()
              setEditingTabId(tab.id)
              setEditingLabel(tab.label)
            }
            const commitEdit = () => {
              if (editingLabel.trim()) renameTab(tab.id, editingLabel.trim())
              setEditingTabId(null)
            }

            return (
              <div
                key={tab.id}
                className={cn(
                  'group flex items-center gap-1.5 shrink-0 border-b-2 px-3 py-2.5 transition-colors cursor-pointer whitespace-nowrap',
                  isActive
                    ? 'border-brand-500 text-brand-500'
                    : 'border-transparent text-grafito-500 hover:text-grafito-900 dark:hover:text-white hover:border-grafito-300',
                )}
                onClick={() => !isEditing && switchTab(tab.id)}
              >
                {isMain
                  ? <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                  : <Receipt className="h-3.5 w-3.5 shrink-0" />
                }

                {/* Nombre editable con doble clic */}
                {isEditing ? (
                  <input
                    autoFocus
                    value={editingLabel}
                    onChange={e => setEditingLabel(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingTabId(null)
                    }}
                    onClick={e => e.stopPropagation()}
                    className="w-24 text-sm font-semibold bg-transparent border-b border-brand-500 outline-none text-grafito-900 dark:text-white"
                  />
                ) : (
                  <span
                    className="text-sm font-semibold max-w-[110px] truncate"
                    onDoubleClick={startEdit}
                    title={!isMain ? 'Doble clic para renombrar' : undefined}
                  >
                    {tab.label}
                  </span>
                )}

                {tab.items.length > 0 && !isEditing && (
                  <span className={cn('text-xs font-bold', isActive ? 'text-brand-400' : 'text-grafito-400')}>
                    {formatCurrency(tabTotal, currency)}
                  </span>
                )}
                {!isMain && (
                  <button
                    onClick={e => { e.stopPropagation(); removeTab(tab.id) }}
                    className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-500/10 hover:text-red-500 transition-all"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}

          {/* Tabs: comandas pendientes de otras cajas */}
          {isManager && hasComandasMode && pendingSales.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedComanda(s)}
              className="group flex items-center gap-2 shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-grafito-500 hover:text-grafito-900 dark:hover:text-white hover:border-amber-400 transition-colors whitespace-nowrap"
            >
              <ClipboardList className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="max-w-[110px] truncate">#{s.order_number}</span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(s.total, currency)}
              </span>
            </button>
          ))}

          {/* Cuentas de mesa activas — deduplicadas por mesa, totales consolidados */}
          {tableOrders
            .filter((o, idx, arr) => arr.findIndex(x => x.table_id === o.table_id) === idx)
            .filter(o => !tabs.some(t => t.tableId === o.table_id))
            .map(representative => {
              const mesaLabel   = `${representative.tables?.number ?? '?'}${representative.tables?.name ? ` · ${representative.tables.name}` : ''}`
              // Sumar ítems de TODAS las comandas activas de esta mesa
              const ordersForTable = tableOrders.filter(x => x.table_id === representative.table_id)
              const mesaTotal   = ordersForTable
                .flatMap(o => o.order_items ?? [])
                .reduce((s, i) => s + (i.unit_price ?? i.products?.price ?? 0) * i.quantity, 0)
              return (
                <button
                  key={representative.table_id}
                  onClick={() => handleLoadTableOrders(ordersForTable)}
                  title={`Cargar ${mesaLabel} en POS (${ordersForTable.length} comanda${ordersForTable.length !== 1 ? 's' : ''})`}
                  className="group flex items-center gap-2 shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-grafito-500 hover:text-grafito-900 dark:hover:text-white hover:border-brand-400 transition-colors whitespace-nowrap"
                >
                  <UtensilsCrossed className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                  <span className="max-w-[110px] truncate">{mesaLabel}</span>
                  <span className="text-xs font-bold text-brand-500">
                    {formatCurrency(mesaTotal, currency)}
                  </span>
                </button>
              )
            })
          }

          {/* Botón + nueva cuenta */}
          <button
            onClick={addTab}
            className="flex items-center justify-center shrink-0 h-7 w-7 mx-2 rounded-lg border border-dashed border-grafito-300 dark:border-white/10 text-grafito-400 hover:border-brand-400 hover:text-brand-500 transition-colors"
            title="Nueva cuenta"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingProducts ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-grafito-200 dark:bg-grafito-800" />
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-grafito-400">
              <Search className="h-12 w-12 opacity-30" />
              <p className="text-sm font-medium">No se encontraron productos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {visibleProducts.map(product => (
                <ProductCard key={product.id} product={product} onAdd={() => handleAddProduct(product)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ RIGHT: Carrito ════════════════════════ */}
      <div className="flex w-[360px] shrink-0 flex-col border-l border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900">

        {/* Barra de caja */}
        {hasOpenSession && activeRegister && (
          <div className="flex items-center justify-between bg-grafito-900 dark:bg-black/30 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/80">{activeRegister.name}</span>
              <span className="flex items-center gap-1 text-[11px] text-white/40">
                <Clock className="h-3 w-3" />{sessionDuration}
              </span>
            </div>
            <button
              onClick={() => setCloseModalOpen(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Lock className="h-3 w-3" /> Cerrar caja
            </button>
          </div>
        )}

        {/* Header carrito */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grafito-100 dark:border-white/5">
          <div className="flex flex-col min-w-0 gap-0.5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-brand-500 shrink-0" />
              <span className="text-sm font-bold text-grafito-900 dark:text-white">
                {tabs.find(t => t.id === activeTabId)?.label ?? 'Venta actual'}
              </span>
              {itemCount > 0 && (
                <span className="shrink-0 rounded-full bg-grafito-200 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold text-grafito-600 dark:text-grafito-300">
                  {itemCount}
                </span>
              )}
            </div>
            {activeTab?.waiterName && (
              <div className="flex items-center gap-1 pl-6 text-[11px] text-grafito-500 dark:text-grafito-400">
                <User className="h-3 w-3 shrink-0" />
                <span>{activeTab.waiterName}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMesasOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-grafito-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              title="Ver mapa de mesas"
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mesas</span>
            </button>
            {isManager && (
              <button
                onClick={() => setTerminalsOpen(true)}
                className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-700 dark:hover:text-white transition-colors"
                title="Gestionar terminales"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setHistoryOpen(true)}
              className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-700 dark:hover:text-white transition-colors"
              title="Historial de ventas"
            >
              <HistoryIcon className="h-3.5 w-3.5" />
            </button>
            {customerId && customerName ? (
              <div className="flex items-center gap-1 rounded-lg bg-brand-500/10 px-2 py-1.5">
                <UserCircle className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                <button
                  onClick={() => setCustomerPickerOpen(true)}
                  className="text-xs font-semibold text-brand-500 dark:text-brand-400 max-w-[100px] truncate leading-none"
                  title={customerName}
                >
                  {customerName}
                </button>
                <button
                  onClick={() => { setCustomer(undefined); setCustomerName(null) }}
                  className="ml-0.5 text-brand-400 hover:text-red-500 transition-colors"
                  title="Quitar cliente"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCustomerPickerOpen(true)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
              >
                <UserCircle className="h-3.5 w-3.5" />
                Cliente
              </button>
            )}
            {items.length > 0 && (
              <button onClick={clearCart} className="rounded-lg p-1.5 text-grafito-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          <AnimatePresence>
            {items.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-full flex-col items-center justify-center gap-4 text-center py-12"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-grafito-100 dark:bg-white/5">
                  <Receipt className="h-7 w-7 text-grafito-300 dark:text-grafito-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-grafito-500">Carrito vacío</p>
                  <p className="text-xs text-grafito-400 mt-0.5">Selecciona productos del catálogo</p>
                </div>
              </motion.div>
            ) : (
              items.map(item => <CartRow key={item.id} item={item} />)
            )}
          </AnimatePresence>
        </div>

        {/* Totales + cobro */}
        <div className="border-t border-grafito-100 dark:border-white/5">
          {items.length > 0 && (
            <div className="px-4 pt-3 pb-2 space-y-1.5">
              <div className="flex justify-between text-xs text-grafito-500">
                <span>Subtotal ({itemCount} ítem{itemCount !== 1 ? 's' : ''})</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              {discounts > 0 && (
                <div className="flex justify-between text-xs text-emerald-500 font-semibold">
                  <span>Descuentos</span>
                  <span>−{formatCurrency(discounts, currency)}</span>
                </div>
              )}
              {taxes > 0 && (
                <div className="flex justify-between text-xs text-grafito-500">
                  <span>IVA</span>
                  <span>{formatCurrency(taxes, currency)}</span>
                </div>
              )}
              {/* Propina */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-xs text-grafito-500 shrink-0">Propina</span>
                <div className="flex items-center gap-1">
                  {[0, 5000, 10000, 15000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setTip(amt)}
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors',
                        tipAmount === amt
                          ? 'bg-brand-500 text-white'
                          : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-500 hover:bg-grafito-200 dark:hover:bg-grafito-700',
                      )}
                    >
                      {amt === 0 ? 'No' : formatCurrency(amt, currency)}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={0}
                    value={tipAmount || ''}
                    onChange={e => setTip(parseInt(e.target.value.replace(/\D/g, '')) || 0)}
                    placeholder="Otro"
                    className="w-16 text-xs text-right rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 px-1.5 py-0.5 text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              {tip > 0 && (
                <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 font-semibold">
                  <span>Propina</span>
                  <span>+{formatCurrency(tip, currency)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t border-grafito-100 dark:border-white/5 pt-2 mt-2">
                <span className="text-xs font-bold text-grafito-500 uppercase tracking-wider">Total</span>
                <span className="text-2xl font-black text-grafito-900 dark:text-white">{formatCurrency(grandTotal, currency)}</span>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="px-3 pb-3 pt-1 space-y-2">
            {/* Cerrar pestaña de mesa — solo después de cobrar (carrito vacío y es una mesa) */}
            {activeTab?.tableId && items.length === 0 && (
              <button
                onClick={async () => {
                  if (activeTab.tableId && tenant?.tenantId) {
                    try { await closeAllOrdersForTable(tenant.tenantId, activeTab.tableId) } catch { /* silent */ }
                  }
                  removeTab(activeTab.id)
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Cerrar pestaña de mesa
              </button>
            )}

            {/* Cobrar / Enviar comanda */}
            {isCommandsOnly ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSendComanda}
                disabled={items.length === 0 || sendingCmd}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all',
                  items.length > 0
                    ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20'
                    : 'bg-grafito-100 dark:bg-white/5 text-grafito-400 cursor-not-allowed',
                )}
              >
                <Printer className="h-5 w-5" />
                {sendingCmd ? 'Imprimiendo…' : items.length > 0 ? `Imprimir comanda (${itemCount})` : 'Imprimir comanda'}
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setCheckoutOpen(true)}
                disabled={items.length === 0}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all',
                  items.length > 0
                    ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20'
                    : 'bg-grafito-100 dark:bg-white/5 text-grafito-400 cursor-not-allowed',
                )}
              >
                <CreditCard className="h-5 w-5" />
                {items.length > 0 ? `Cobrar ${formatCurrency(grandTotal)}` : 'Cobrar'}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
