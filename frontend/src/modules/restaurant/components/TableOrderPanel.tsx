/**
 * TableOrderPanel — panel lateral para gestionar órdenes de restaurante.
 * Se monta via portal para escapar el canvas de TablesPage.
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Search, Plus, Minus, ChefHat, Loader2,
  Users, ChevronDown, ChevronUp, ShoppingCart,
  CheckCircle2, Clock, AlertCircle, Trash2, MessageSquare,
} from 'lucide-react'
import { getProducts, getCategories, updateTableStatus, type ProductRow, type CategoryRow, type TableRow } from '@lib/db'
import type { RestaurantOrderItemInput } from '@lib/db'
import { useRestaurantOrder } from '../hooks/useRestaurantOrder'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'
import { toast } from 'sonner'

// ── Tipos locales ──────────────────────────────────────────────

interface CartItem {
  product_id: string
  name:       string
  sku:        string
  unit_price: number
  quantity:   number
  notes:      string
  stock:      number   // límite de inventario
}

// ── Colores de estado ──────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  AVAILABLE:   { label: 'Disponible',    cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  OCCUPIED:    { label: 'Ocupada',       cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  RESERVED:    { label: 'Reservada',     cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  MAINTENANCE: { label: 'Mantenimiento', cls: 'bg-grafito-200 text-grafito-500' },
}

const ITEM_STATUS: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  PENDING:     { icon: Clock,        cls: 'text-amber-500',   label: 'Pendiente' },
  IN_PROGRESS: { icon: ChefHat,     cls: 'text-blue-500',    label: 'En cocina' },
  READY:       { icon: CheckCircle2, cls: 'text-emerald-500', label: 'Listo'     },
  DELIVERED:   { icon: CheckCircle2, cls: 'text-grafito-400', label: 'Entregado' },
  CANCELLED:   { icon: AlertCircle,  cls: 'text-red-400',     label: 'Cancelado' },
}

// ── Props ──────────────────────────────────────────────────────

interface TableOrderPanelProps {
  table:           TableRow
  onClose:         () => void
  onTableUpdated:  (updated: TableRow) => void
}

// ── CartRow — fila individual en el carrito ────────────────────

function CartRow({
  item,
  onQty,
  onNotes,
  onRemove,
}: {
  item:     CartItem
  onQty:    (id: string, qty: number) => void
  onNotes:  (id: string, notes: string) => void
  onRemove: (id: string) => void
}) {
  const [inputVal, setInputVal] = useState(item.quantity.toString())
  const [showNotes, setShowNotes] = useState(!!item.notes)

  useEffect(() => { setInputVal(item.quantity.toString()) }, [item.quantity])

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  const handleQtyChange = (raw: string) => {
    setInputVal(raw)
    const v = parseInt(raw)
    if (!isNaN(v) && v > 0) {
      if (v > item.stock) {
        toast.error(`Solo hay ${item.stock} ud${item.stock !== 1 ? 's' : ''} de "${item.name}".`, { duration: 2500 })
        onQty(item.product_id, item.stock)
        setInputVal(item.stock.toString())
      } else {
        onQty(item.product_id, v)
      }
    }
  }

  const handleBlur = () => {
    const v = parseInt(inputVal)
    if (isNaN(v) || v < 1) { onQty(item.product_id, 1); setInputVal('1') }
  }

  const handlePlus = () => {
    if (item.quantity >= item.stock) {
      toast.error(`Solo hay ${item.stock} ud${item.stock !== 1 ? 's' : ''} de "${item.name}".`, { duration: 2500 })
      return
    }
    onQty(item.product_id, item.quantity + 1)
  }

  return (
    <div className="rounded-xl border border-grafito-100 dark:border-white/5 bg-grafito-50 dark:bg-white/[0.03] px-3 py-2.5 space-y-1.5">
      {/* Fila principal */}
      <div className="flex items-center gap-2">
        {/* Controles de cantidad */}
        <div className="flex items-center rounded-lg border border-grafito-200 dark:border-white/10 overflow-hidden shrink-0">
          <button
            onClick={() => {
              if (item.quantity <= 1) { onRemove(item.product_id); return }
              onQty(item.product_id, item.quantity - 1)
            }}
            className="flex h-7 w-7 items-center justify-center text-grafito-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number" min={1} max={item.stock}
            value={inputVal}
            onChange={e => handleQtyChange(e.target.value)}
            onBlur={handleBlur}
            className="w-10 text-center text-xs font-bold text-grafito-900 dark:text-white bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={handlePlus}
            className={cn(
              'flex h-7 w-7 items-center justify-center transition-colors',
              item.quantity >= item.stock
                ? 'text-grafito-300 dark:text-grafito-600 cursor-not-allowed'
                : 'text-grafito-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:text-brand-500',
            )}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Nombre + stock */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-grafito-900 dark:text-white truncate">{item.name}</p>
          <p className="text-[10px] text-grafito-400">
            {fmt(item.unit_price)} c/u
            {item.stock <= 5 && item.stock > 0 && (
              <span className="ml-1.5 text-amber-500 font-semibold">· {item.stock} en stock</span>
            )}
          </p>
        </div>

        {/* Precio total */}
        <span className="text-xs font-bold text-grafito-800 dark:text-white shrink-0">
          {fmt(item.unit_price * item.quantity)}
        </span>

        {/* Acciones */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setShowNotes(v => !v)}
            title="Agregar comentario"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
              showNotes
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-grafito-400 hover:bg-grafito-200 dark:hover:bg-white/10 hover:text-grafito-600',
            )}
          >
            <MessageSquare className="h-3 w-3" />
          </button>
          <button
            onClick={() => onRemove(item.product_id)}
            title="Eliminar"
            className="flex h-6 w-6 items-center justify-center rounded-md text-grafito-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Campo de notas (expandible) */}
      {showNotes && (
        <input
          autoFocus
          type="text"
          value={item.notes}
          onChange={e => onNotes(item.product_id, e.target.value)}
          placeholder="Ej: sin cebolla, poco picante…"
          className="w-full text-xs rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 px-2.5 py-1.5 text-grafito-800 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 transition-colors"
        />
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────

export function TableOrderPanel({ table, onClose, onTableUpdated }: TableOrderPanelProps) {
  const { tenant, branch, user, profile } = useAuthStore()
  const { order, loading, submitting, loadOrder, sendItems } = useRestaurantOrder()

  const [products,    setProducts]    = useState<ProductRow[]>([])
  const [categories,  setCategories]  = useState<CategoryRow[]>([])
  const [prodLoading, setProdLoading] = useState(true)
  const [search,      setSearch]      = useState('')
  const [activeCat,   setActiveCat]   = useState<string | null>(null)
  const [cart,        setCart]        = useState<CartItem[]>([])
  const [orderExpanded, setOrderExpanded] = useState(true)

  // ── Cargar datos al montar ──────────────────────────────────
  useEffect(() => {
    if (!tenant?.tenantId || !branch?.branchId) return
    loadOrder(tenant.tenantId, table.id)
    Promise.all([
      getProducts(tenant.tenantId),
      getCategories(tenant.tenantId),
    ]).then(([prods, cats]) => {
      setProducts(prods.filter(p => p.status === 'ACTIVE'))
      setCategories(cats)
    }).catch(() => {}).finally(() => setProdLoading(false))
  }, [tenant?.tenantId, branch?.branchId, table.id])

  // ── Filtro de productos ─────────────────────────────────────
  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
      const matchCat = !activeCat || p.category_id === activeCat
      return matchSearch && matchCat
    })
  }, [products, search, activeCat])

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  // ── Stock helper ────────────────────────────────────────────
  const getStock = (p: ProductRow) =>
    (p.inventory ?? []).reduce((s, i) => s + Number(i.quantity), 0)

  // ── Carrito helpers ─────────────────────────────────────────
  const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const addToCart = (product: ProductRow) => {
    const stock = getStock(product)
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error(`Solo hay ${stock} ud${stock !== 1 ? 's' : ''} de "${product.name}".`, { duration: 2500 })
          return prev
        }
        return prev.map(i =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      if (stock === 0) {
        toast.error(`"${product.name}" está agotado.`, { duration: 2500 })
        return prev
      }
      return [...prev, {
        product_id: product.id,
        name:       product.name,
        sku:        product.sku,
        unit_price: product.price,
        quantity:   1,
        notes:      '',
        stock,
      }]
    })
  }

  const setQty = (productId: string, qty: number) => {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i))
  }

  const setNotes = (productId: string, notes: string) => {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, notes } : i))
  }

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.product_id !== productId))
  }

  // ── Enviar pedido ───────────────────────────────────────────
  const handleSend = async () => {
    if (cart.length === 0) return
    if (!tenant?.tenantId || !branch?.branchId || !user?.id) return

    const items: RestaurantOrderItemInput[] = cart.map(i => ({
      product_id:  i.product_id,
      name:        i.name,
      sku:         i.sku,
      quantity:    i.quantity,
      unit_price:  i.unit_price,
      notes:       i.notes || null,
      destination: 'KITCHEN',
    }))

    try {
      await sendItems(
        tenant.tenantId,
        branch.branchId,
        table.id,
        user.id,
        profile?.fullName ?? 'Mesero',
        items,
      )
      setCart([])
      try {
        await updateTableStatus(table.id, 'OCCUPIED')
      } catch { /* el Realtime puede haber actualizado ya */ }
      onTableUpdated({ ...table, status: 'OCCUPIED' })
      toast.success('Pedido enviado a cocina.')
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al enviar el pedido.')
    }
  }

  // ── Render ──────────────────────────────────────────────────
  const statusBadge = STATUS_BADGE[table.status] ?? STATUS_BADGE.AVAILABLE

  return createPortal(
    <div className="fixed inset-0 z-[300] flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-[480px] bg-white dark:bg-grafito-900 flex flex-col shadow-2xl border-l border-grafito-200 dark:border-white/10 h-full overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-grafito-100 dark:border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
              <ChefHat className="h-5 w-5 text-brand-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-grafito-900 dark:text-white">
                  Mesa {table.number}{table.name ? ` · ${table.name}` : ''}
                </h2>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusBadge.cls)}>
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-xs text-grafito-500 dark:text-grafito-400 flex items-center gap-1 mt-0.5">
                <Users className="h-3 w-3" /> {table.capacity} personas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Orden activa ── */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-grafito-400" />
            </div>
          ) : order ? (
            <div className="border-b border-grafito-100 dark:border-white/5">
              <button
                onClick={() => setOrderExpanded(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-grafito-700 dark:text-grafito-200 hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ChefHat className="h-3.5 w-3.5 text-brand-500" />
                  Pedido activo — #{order.order_number}
                  <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {order.order_items?.length ?? 0} ítems
                  </span>
                </span>
                {orderExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {orderExpanded && (
                <div className="px-5 pb-3 space-y-1.5">
                  {(order.order_items ?? []).map(item => {
                    const st = ITEM_STATUS[item.status] ?? ITEM_STATUS.PENDING
                    const Icon = st.icon
                    const itemName  = item.name ?? item.products?.name ?? 'Producto'
                    const itemPrice = item.unit_price ?? item.products?.price ?? 0
                    return (
                      <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-grafito-50 dark:border-white/5 last:border-0">
                        <span className="text-xs font-bold text-grafito-500 dark:text-grafito-400 w-5 shrink-0 text-center">
                          {item.quantity}×
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-grafito-800 dark:text-grafito-100 truncate">{itemName}</p>
                          {item.notes && (
                            <p className="text-[10px] text-grafito-400 italic truncate">{item.notes}</p>
                          )}
                          {item.added_by_name && (
                            <p className="text-[10px] text-brand-500/90 truncate flex items-center gap-1">
                              <Users className="h-2.5 w-2.5 shrink-0" />
                              {item.added_by_name}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-grafito-700 dark:text-grafito-200 shrink-0">
                          {fmt(itemPrice * item.quantity)}
                        </span>
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', st.cls)} title={st.label} />
                      </div>
                    )
                  })}
                  {order.order_items?.length === 0 && (
                    <p className="text-xs text-grafito-400 py-2 text-center">Sin ítems registrados.</p>
                  )}
                  {(order.order_items?.length ?? 0) > 0 && (
                    <div className="flex justify-between pt-2 text-xs font-bold text-grafito-900 dark:text-white">
                      <span>Subtotal pedido</span>
                      <span>
                        {fmt((order.order_items ?? []).reduce((s, i) =>
                          s + (i.unit_price ?? i.products?.price ?? 0) * i.quantity, 0))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* ── Selector de productos ── */}
          <div className="px-5 pt-4 space-y-3">
            <p className="text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wide">
              {order ? 'Agregar más productos' : 'Seleccionar productos'}
            </p>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-grafito-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full rounded-xl bg-grafito-50 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 pl-9 pr-3 py-2 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Categorías */}
            {categories.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setActiveCat(null)}
                  className={cn(
                    'shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors',
                    !activeCat
                      ? 'bg-brand-500 text-white'
                      : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700',
                  )}
                >
                  Todas
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCat(activeCat === cat.id ? null : cat.id)}
                    className={cn(
                      'shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors',
                      activeCat === cat.id
                        ? 'text-white'
                        : 'bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700',
                    )}
                    style={activeCat === cat.id ? { backgroundColor: cat.color } : undefined}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: activeCat === cat.id ? 'rgba(255,255,255,0.6)' : cat.color }}
                    />
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Grid de productos */}
            {prodLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-grafito-400" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-grafito-400 text-center py-8">
                {search ? 'No hay productos que coincidan.' : 'No hay productos activos.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 pb-4">
                {filtered.map(product => {
                  const stock   = getStock(product)
                  const inCart  = cart.find(i => i.product_id === product.id)
                  const outOfStock = stock === 0
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={outOfStock}
                      className={cn(
                        'relative flex flex-col gap-1 rounded-xl border-2 p-3 text-left transition-all',
                        outOfStock
                          ? 'border-grafito-100 dark:border-white/5 opacity-40 cursor-not-allowed'
                          : inCart
                            ? 'border-brand-500 bg-brand-500/5'
                            : 'border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 hover:border-brand-500/50 hover:bg-brand-500/5',
                      )}
                    >
                      {/* Badge cantidad en carrito */}
                      {inCart && !outOfStock && (
                        <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {inCart.quantity}
                        </span>
                      )}
                      {/* Badge stock */}
                      {!inCart && !outOfStock && (
                        <span className={cn(
                          'absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                          stock <= 5
                            ? 'bg-amber-400/90 text-amber-900'
                            : 'bg-grafito-100 dark:bg-grafito-700 text-grafito-500 dark:text-grafito-300',
                        )}>
                          {stock} uds
                        </span>
                      )}
                      {outOfStock && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                          Agotado
                        </span>
                      )}

                      {product.categories && (
                        <span
                          className="self-start text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white mb-0.5"
                          style={{ backgroundColor: (product.categories as any).color }}
                        >
                          {(product.categories as any).name}
                        </span>
                      )}
                      <span className="text-xs font-bold text-grafito-900 dark:text-white leading-tight line-clamp-2 pr-8">
                        {product.name}
                      </span>
                      <span className="text-xs font-semibold text-brand-500 mt-auto">
                        {fmt(product.price)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Carrito + Acciones (fijo abajo) ── */}
        {cart.length > 0 && (
          <div className="shrink-0 border-t border-grafito-100 dark:border-white/5 bg-white dark:bg-grafito-900">
            <div className="px-4 pt-3 pb-2 space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-brand-500 shrink-0" />
                <span className="text-xs font-semibold text-grafito-700 dark:text-grafito-200">
                  Nuevo pedido ({cartCount} ítem{cartCount !== 1 ? 's' : ''})
                </span>
              </div>

              {/* Lista del carrito */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {cart.map(item => (
                  <CartRow
                    key={item.product_id}
                    item={item}
                    onQty={setQty}
                    onNotes={setNotes}
                    onRemove={removeItem}
                  />
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-between pt-1 text-sm font-bold text-grafito-900 dark:text-white border-t border-grafito-100 dark:border-white/5">
                <span>Total nuevo pedido</span>
                <span className="text-brand-500">{fmt(cartTotal)}</span>
              </div>
            </div>

            <div className="px-4 pb-4">
              <button
                onClick={handleSend}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ChefHat className="h-4 w-4" />
                }
                {submitting ? 'Enviando…' : `Enviar a cocina (${cartCount})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
