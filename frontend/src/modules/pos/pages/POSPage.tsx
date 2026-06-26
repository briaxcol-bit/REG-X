import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Barcode, Plus, Minus, Trash2, CreditCard, Banknote, Receipt, X, ChevronDown, Tag, UserCircle } from 'lucide-react'
import { usePOSStore } from '@store/pos.store'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/format'
import { useProducts } from '@modules/products/hooks/useProducts'
import { CheckoutModal } from '@modules/pos/components/CheckoutModal'
import { BarcodeScanner } from '@modules/pos/components/BarcodeScanner'
import { CustomerPicker } from '@modules/pos/components/CustomerPicker'
import { toast } from 'sonner'

// ── Product grid item ────────────────────────────────────────

interface ProductCardProps {
  product: {
    id: string
    name: string
    price: number
    imageUrl?: string
    sku: string
    stock: number
    categoryColor?: string
    tax: number
  }
  onAdd: () => void
}

function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onAdd}
      className={cn(
        'group relative flex flex-col items-center justify-between rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 p-3',
        'hover:border-brand-500/40 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all duration-150',
        product.stock === 0 && 'opacity-50 cursor-not-allowed',
      )}
      disabled={product.stock === 0}
    >
      {/* Image or placeholder */}
      <div className="mb-3 aspect-square w-full rounded-lg overflow-hidden bg-grafito-200 dark:bg-grafito-700 flex items-center justify-center relative">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center text-4xl font-bold text-white shadow-inner"
            style={{ backgroundColor: product.categoryColor ?? '#374151' }}
          >
            {product.name[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="w-full text-left flex flex-col flex-1">
        <p className="text-sm font-bold text-grafito-900 dark:text-white line-clamp-2 leading-tight" title={product.name}>{product.name}</p>
        <p className="mt-auto pt-2 text-base font-black text-brand-500">
          {formatCurrency(product.price)}
        </p>
        {product.stock > 0 && product.stock <= 5 && (
          <p className="text-[10px] text-yellow-400">Stock: {product.stock}</p>
        )}
      </div>

      {/* Quick add overlay */}
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-brand-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <Plus className="h-6 w-6 text-brand-400" />
      </div>
    </motion.button>
  )
}

// ── Cart item row ────────────────────────────────────────────

function CartRow({ item }: { item: ReturnType<typeof usePOSStore.getState>['items'][0] }) {
  const { updateQuantity, removeItem, applyItemDiscount } = usePOSStore()
  const [inputValue, setInputValue] = useState(item.quantity.toString())

  useEffect(() => {
    setInputValue(item.quantity.toString())
  }, [item.quantity])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-3 rounded-lg bg-grafito-100 dark:bg-grafito-800/60 px-3 py-2.5"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-grafito-900 dark:text-white truncate">{item.name}</p>
        <p className="text-xs text-grafito-500 dark:text-grafito-400">{formatCurrency(item.price)} c/u</p>
        {item.discount > 0 && (
          <p className="text-xs text-green-400">−{item.discount}% dto.</p>
        )}
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => updateQuantity(item.id, item.quantity - 1)}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-grafito-100 dark:bg-grafito-700 text-grafito-600 dark:text-grafito-300 hover:bg-brand-500/20 hover:text-brand-400 transition-colors"
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          type="number"
          min={1}
          max={item.stock}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            const val = parseInt(e.target.value)
            if (!isNaN(val) && val > 0) {
              if (val > item.stock) {
                toast.error(`Solo hay ${item.stock} disponibles en inventario.`)
                updateQuantity(item.id, item.stock)
              } else {
                updateQuantity(item.id, val)
              }
            }
          }}
          onBlur={() => {
            const val = parseInt(inputValue)
            if (isNaN(val) || val < 1) {
              updateQuantity(item.id, 1)
              setInputValue('1')
            } else if (val > item.stock) {
              setInputValue(item.stock.toString())
            }
          }}
          className="w-10 text-center text-sm font-semibold text-grafito-900 dark:text-white bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => updateQuantity(item.id, item.quantity + 1)}
          disabled={item.quantity >= item.stock}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
            item.quantity >= item.stock
              ? "bg-grafito-100 dark:bg-grafito-800 text-grafito-400 dark:text-grafito-600 cursor-not-allowed opacity-50"
              : "bg-grafito-100 dark:bg-grafito-700 text-grafito-600 dark:text-grafito-300 hover:bg-brand-500/20 hover:text-brand-400"
          )}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 shrink-0 ml-auto">
        <span className="text-right text-sm font-bold text-grafito-900 dark:text-white">
          {formatCurrency(item.total)}
        </span>

        <button
          onClick={() => removeItem(item.id)}
          className="text-grafito-400 hover:text-red-500 transition-colors p-1"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ── Main POS Page ────────────────────────────────────────────

export default function POSPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    items, addItem, clearCart, customerId,
    setCustomer, getSubtotal, getTaxTotal, getDiscountTotal, getTotal,
  } = usePOSStore()

  const { branch } = useAuthStore()
  const currency = branch?.currency ?? 'USD'

  // Products query
  const { data: products = [], isLoading: loadingProducts } = useProducts({
    search,
    categoryId: selectedCategory ?? undefined,
  })

  const handleAddProduct = useCallback((product: typeof products[0]) => {
    const existing = items.find(i => i.productId === product.id)
    if (existing && existing.quantity >= product.stock) {
      toast.error(`Solo hay ${product.stock} disponibles en inventario.`)
      return
    }
    addItem({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      quantity: 1,
      stock: product.stock,
      discount: 0,
      tax: product.tax ?? 0,
    })
  }, [addItem, items])

  const handleBarcodeScanned = useCallback((barcode: string) => {
    setScannerOpen(false)
    setSearch(barcode)
    searchRef.current?.focus()
  }, [])

  const subtotal = getSubtotal()
  const taxes = getTaxTotal()
  const discounts = getDiscountTotal()
  const total = getTotal()
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0)

  return (
    <div className="flex h-full overflow-hidden">
      {/* ═══════════════ LEFT: Product Grid ═══════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-grafito-200 dark:border-white/5">
        {/* Search + scanner bar */}
        <div className="flex items-center gap-2 border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 p-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-grafito-100 dark:bg-grafito-800 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-grafito-500 dark:text-grafito-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto o SKU…"
              className="flex-1 bg-transparent text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 dark:placeholder:text-grafito-500 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="h-3.5 w-3.5 text-grafito-500 dark:text-grafito-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setScannerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-brand-500/20 hover:text-brand-400 transition-colors"
            title="Escanear código de barras"
          >
            <Barcode className="h-5 w-5" />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 px-3 py-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              !selectedCategory
                ? 'bg-brand-500 text-grafito-900 dark:text-white'
                : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700',
            )}
          >
            Todos
          </button>
          {/* Categories rendered dynamically */}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loadingProducts ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-grafito-100 dark:bg-grafito-800" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-grafito-500">
              <Search className="h-10 w-10" />
              <p className="text-sm">No se encontraron productos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={() => handleAddProduct(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ RIGHT: Cart ═══════════════════════ */}
      <div className="flex w-96 shrink-0 flex-col bg-white dark:bg-grafito-900">
        {/* Cart header */}
        <div className="flex items-center justify-between border-b border-grafito-200 dark:border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-brand-400" />
            <span className="font-semibold text-grafito-900 dark:text-white">
              Venta
              {itemCount > 0 && (
                <span className="ml-2 rounded-full bg-brand-500 px-2 py-0.5 text-xs">
                  {itemCount}
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCustomerPickerOpen(true)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors',
                customerId
                  ? 'bg-brand-500/15 text-brand-400'
                  : 'text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-900 dark:text-white',
              )}
            >
              <UserCircle className="h-4 w-4" />
              {customerId ? 'Cliente' : 'Agregar cliente'}
            </button>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="rounded-lg p-1.5 text-grafito-500 dark:text-grafito-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                title="Vaciar carrito"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <AnimatePresence>
            {items.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-full flex-col items-center justify-center gap-3 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-grafito-100 dark:bg-grafito-800">
                  <Receipt className="h-8 w-8 text-grafito-600" />
                </div>
                <p className="text-sm text-grafito-500">
                  Agrega productos para comenzar la venta
                </p>
              </motion.div>
            ) : (
              items.map((item) => <CartRow key={item.id} item={item} />)
            )}
          </AnimatePresence>
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="border-t border-grafito-200 dark:border-white/5 p-4 space-y-2">
            <div className="flex justify-between text-sm text-grafito-500 dark:text-grafito-400">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            {discounts > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Descuentos</span>
                <span>−{formatCurrency(discounts, currency)}</span>
              </div>
            )}
            {taxes > 0 && (
              <div className="flex justify-between text-sm text-grafito-500 dark:text-grafito-400">
                <span>Impuestos</span>
                <span>{formatCurrency(taxes, currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-grafito-200 dark:border-white/10 pt-2 font-bold text-grafito-900 dark:text-white">
              <span className="text-lg">TOTAL</span>
              <span className="text-2xl text-brand-400">{formatCurrency(total, currency)}</span>
            </div>
          </div>
        )}

        {/* Payment buttons */}
        <div className="border-t border-grafito-200 dark:border-white/5 p-4 space-y-2">
          {/* Quick cash */}
          <div className="grid grid-cols-3 gap-2">
            {[formatCurrency(total + 0.01, currency), '50', '100'].map((v) => (
              <button
                key={v}
                className="rounded-lg bg-grafito-100 dark:bg-grafito-800 py-2 text-xs font-medium text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
              >
                {v}
              </button>
            ))}
          </div>

          {/* Checkout button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => items.length > 0 && setCheckoutOpen(true)}
            disabled={items.length === 0}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-base transition-all',
              items.length > 0
                ? 'bg-brand-500 text-grafito-900 dark:text-white hover:bg-brand-600 shadow-brand-lg'
                : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-600 cursor-not-allowed',
            )}
          >
            <CreditCard className="h-5 w-5" />
            Cobrar {items.length > 0 ? formatCurrency(total, currency) : ''}
          </motion.button>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────── */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        total={total}
        currency={currency}
      />
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />
      <CustomerPicker
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(id) => { setCustomer(id); setCustomerPickerOpen(false) }}
      />
    </div>
  )
}
