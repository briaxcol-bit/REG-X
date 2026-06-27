import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Barcode, Plus, Minus, Trash2, CreditCard,
  Receipt, X, UserCircle, Lock, Clock, Tag, Printer,
  ShoppingCart, Clock as HistoryIcon, Monitor, ClipboardList,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { usePOSStore } from '@store/pos.store'
import { useAuthStore } from '@store/auth.store'
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
import { getPendingSales, getPOSTerminals, type SaleHistoryRow } from '@lib/db'
import { toast } from 'sonner'

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
      <div className="aspect-square w-full overflow-hidden bg-grafito-100 dark:bg-grafito-700 relative">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl font-black text-white"
            style={{ backgroundColor: product.categoryColor ?? '#374151' }}>
            {product.name[0]?.toUpperCase()}
          </div>
        )}
        {product.stock > 0 && product.stock <= 5 && (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {product.stock}
          </span>
        )}
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
function CartRow({ item }: { item: ReturnType<typeof usePOSStore.getState>['items'][0] }) {
  const { updateQuantity, removeItem } = usePOSStore()
  const [inputValue, setInputValue] = useState(item.quantity.toString())

  useEffect(() => { setInputValue(item.quantity.toString()) }, [item.quantity])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-3 rounded-xl border border-grafito-100 dark:border-white/5 bg-grafito-50 dark:bg-white/[0.03] px-3 py-2.5 group"
    >
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
              if (v > item.stock) { toast.error(`Solo hay ${item.stock}`); updateQuantity(item.id, item.stock) }
              else updateQuantity(item.id, v)
            }
          }}
          onBlur={() => {
            const v = parseInt(inputValue)
            if (isNaN(v) || v < 1) { updateQuantity(item.id, 1); setInputValue('1') }
            else if (v > item.stock) setInputValue(item.stock.toString())
          }}
          className="w-8 text-center text-xs font-bold text-grafito-900 dark:text-white bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => updateQuantity(item.id, item.quantity + 1)}
          disabled={item.quantity >= item.stock}
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

      {/* Total + delete */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm font-black text-grafito-900 dark:text-white w-16 text-right">
          {formatCurrency(item.total)}
        </span>
        <button
          onClick={() => removeItem(item.id)}
          className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-grafito-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
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
  const [closeModalOpen, setCloseModalOpen]   = useState(false)
  const [editingTabId, setEditingTabId]       = useState<string | null>(null)
  const [editingLabel, setEditingLabel]       = useState('')
  const [historyOpen, setHistoryOpen]         = useState(false)
  const [terminalsOpen, setTerminalsOpen]     = useState(false)
  const [selectedComanda, setSelectedComanda] = useState<SaleHistoryRow | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    tabs, activeTabId,
    addItem, clearCart,
    setCustomer, getSubtotal, getTaxTotal, getDiscountTotal, getTotal,
    lastReceipt, setLastReceipt,
    addTab, removeTab, switchTab,
  } = usePOSStore()

  // Derivar datos de la tab activa directamente (reactivo con Zustand)
  const activeTab   = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const items       = activeTab?.items      ?? []
  const customerId  = activeTab?.customerId

  const { branch, tenant, profile, hasRole } = useAuthStore()
  const currency    = branch?.currency ?? 'COP'
  const isManager   = hasRole('OWNER') || hasRole('ADMIN')

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
        cashierName:   profile?.full_name ?? 'Cajero',
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
      toast.warning(`"${product.name}" está agotado — no hay unidades en inventario.`)
      return
    }
    const existing = items.find(i => i.productId === product.id)
    if (existing && existing.quantity >= product.stock) {
      toast.error(`Solo hay ${product.stock} disponibles.`)
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
              placeholder="Buscar producto o escanear SKU…"
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
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-brand-500" />
            <span className="text-sm font-bold text-grafito-900 dark:text-white">
              {tabs.find(t => t.id === activeTabId)?.label ?? 'Venta actual'}
            </span>
            {itemCount > 0 && (
              <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
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
            <button
              onClick={() => setCustomerPickerOpen(true)}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                customerId
                  ? 'bg-brand-500/10 text-brand-500 dark:text-brand-400'
                  : 'text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5',
              )}
            >
              <UserCircle className="h-3.5 w-3.5" />
              Cliente
            </button>
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
              <div className="flex justify-between items-baseline border-t border-grafito-100 dark:border-white/5 pt-2 mt-2">
                <span className="text-xs font-bold text-grafito-500 uppercase tracking-wider">Total</span>
                <span className="text-2xl font-black text-grafito-900 dark:text-white">{formatCurrency(total, currency)}</span>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="px-3 pb-3 pt-1 space-y-2">
            {/* Imprimir último recibo — solo si existe */}
            {lastReceipt && (
              <button
                onClick={() => window.print()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/10 py-2 text-xs font-semibold text-grafito-500 hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                Reimprimir último recibo
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
                onClick={() => items.length > 0 && setCheckoutOpen(true)}
                disabled={items.length === 0}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all',
                  items.length > 0
                    ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20'
                    : 'bg-grafito-100 dark:bg-white/5 text-grafito-400 cursor-not-allowed',
                )}
              >
                <CreditCard className="h-5 w-5" />
                {items.length > 0 ? `Cobrar ${formatCurrency(total, currency)}` : 'Cobrar'}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} total={total} currency={currency} />
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcodeScanned} />
      <CustomerPicker open={customerPickerOpen} onClose={() => setCustomerPickerOpen(false)} onSelect={id => { setCustomer(id); setCustomerPickerOpen(false) }} />
    </div>
  )
}
