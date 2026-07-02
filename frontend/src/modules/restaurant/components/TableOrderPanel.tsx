/**
 * TableOrderPanel — panel lateral para gestionar órdenes de restaurante.
 * Se monta via portal para escapar el canvas de TablesPage.
 *
 * Layout:
 *   Header: info de mesa + estado
 *   Orden activa (si existe): lista de ítems enviados
 *   Selector de productos: búsqueda + categorías + grid
 *   Carrito nuevo: ítems por enviar + botón "Enviar a cocina"
 *   Footer: "Cerrar mesa" (si hay orden activa)
 */

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Search, Plus, Minus, ChefHat, Loader2,
  Users, ChevronDown, ChevronUp, ShoppingCart,
  CheckCircle2, Clock, AlertCircle,
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
}

// ── Colores de estado ──────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  AVAILABLE:   { label: 'Disponible',    cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  OCCUPIED:    { label: 'Ocupada',       cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  RESERVED:    { label: 'Reservada',     cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  MAINTENANCE: { label: 'Mantenimiento', cls: 'bg-grafito-200 text-grafito-500' },
}

const ITEM_STATUS: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  PENDING:   { icon: Clock,         cls: 'text-amber-500',   label: 'Pendiente' },
  IN_PROGRESS: { icon: ChefHat,    cls: 'text-blue-500',    label: 'En cocina' },
  READY:     { icon: CheckCircle2,  cls: 'text-emerald-500', label: 'Listo'     },
  DELIVERED: { icon: CheckCircle2,  cls: 'text-grafito-400', label: 'Entregado' },
  CANCELLED: { icon: AlertCircle,   cls: 'text-red-400',     label: 'Cancelado' },
}

// ── Props ──────────────────────────────────────────────────────

interface TableOrderPanelProps {
  table:           TableRow
  onClose:         () => void
  onTableUpdated:  (updated: TableRow) => void
}

// ── Componente ─────────────────────────────────────────────────

export function TableOrderPanel({ table, onClose, onTableUpdated }: TableOrderPanelProps) {
  const { tenant, branch, user, profile } = useAuthStore()
  const { order, loading, submitting, loadOrder, sendItems } = useRestaurantOrder()

  // Productos
  const [products,   setProducts]   = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [prodLoading, setProdLoading] = useState(true)
  const [search,     setSearch]     = useState('')
  const [activeCat,  setActiveCat]  = useState<string | null>(null)

  // Carrito local (ítems siendo preparados para enviar)
  const [cart, setCart] = useState<CartItem[]>([])

  // UI toggles
  const [orderExpanded, setOrderExpanded] = useState(true)

  // ── Cargar datos al montar ──────────────────────────────────
  useEffect(() => {
    if (!tenant?.tenantId || !branch?.branchId) return

    // Orden activa de la mesa
    loadOrder(tenant.tenantId, table.id)

    // Productos y categorías
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

  // ── Carrito helpers ─────────────────────────────────────────
  const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const addToCart = (product: ProductRow) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        product_id: product.id,
        name:       product.name,
        sku:        product.sku,
        unit_price: product.price,
        quantity:   1,
        notes:      '',
      }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setCart(prev => {
      const next = prev.map(i => i.product_id === productId ? { ...i, quantity: i.quantity + delta } : i)
      return next.filter(i => i.quantity > 0)
    })
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

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
      // Marcar mesa como OCUPADA en DB y notificar al padre
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-grafito-100 dark:border-white/5 shrink-0 bg-white dark:bg-grafito-900">
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
              {/* Toggle */}
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
                    // Nombre: del campo denormalizado (post-migración) o del join de productos
                    const itemName  = item.name ?? item.products?.name ?? 'Producto'
                    // Precio: del campo denormalizado o del join de productos
                    const itemPrice = item.unit_price ?? item.products?.price ?? 0
                    return (
                      <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-grafito-50 dark:border-white/5 last:border-0">
                        <span className="text-xs font-bold text-grafito-500 dark:text-grafito-400 w-5 shrink-0 text-center">
                          {item.quantity}×
                        </span>
                        <span className="flex-1 text-xs text-grafito-800 dark:text-grafito-100 truncate">{itemName}</span>
                        {item.notes && (
                          <span className="text-[10px] text-grafito-400 italic truncate max-w-[80px]">{item.notes}</span>
                        )}
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
                  {/* Total orden activa */}
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
                  const inCart = cart.find(i => i.product_id === product.id)
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={cn(
                        'relative flex flex-col gap-1 rounded-xl border-2 p-3 text-left transition-all',
                        inCart
                          ? 'border-brand-500 bg-brand-500/5'
                          : 'border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 hover:border-brand-500/50 hover:bg-brand-500/5',
                      )}
                    >
                      {inCart && (
                        <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {inCart.quantity}
                        </span>
                      )}
                      {product.categories && (
                        <span
                          className="self-start text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white mb-0.5"
                          style={{ backgroundColor: product.categories.color }}
                        >
                          {product.categories.name}
                        </span>
                      )}
                      <span className="text-xs font-bold text-grafito-900 dark:text-white leading-tight line-clamp-2">
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
        <div className="shrink-0 border-t border-grafito-100 dark:border-white/5 bg-white dark:bg-grafito-900">
          {cart.length > 0 && (
            <div className="px-5 pt-3 pb-2 space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-brand-500 shrink-0" />
                <span className="text-xs font-semibold text-grafito-700 dark:text-grafito-200">
                  Nuevo pedido ({cartCount} ítem{cartCount !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.product_id} className="flex items-center gap-2">
                    <button
                      onClick={() => changeQty(item.product_id, -1)}
                      className="h-6 w-6 rounded-md bg-grafito-100 dark:bg-grafito-800 flex items-center justify-center text-grafito-600 dark:text-grafito-300 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-bold text-grafito-700 dark:text-grafito-200 w-4 text-center shrink-0">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => changeQty(item.product_id, 1)}
                      className="h-6 w-6 rounded-md bg-grafito-100 dark:bg-grafito-800 flex items-center justify-center text-grafito-600 dark:text-grafito-300 hover:bg-brand-50 hover:text-brand-500 transition-colors shrink-0"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <span className="flex-1 text-xs text-grafito-800 dark:text-grafito-100 truncate">{item.name}</span>
                    <span className="text-xs font-semibold text-grafito-700 dark:text-grafito-200 shrink-0">
                      {fmt(item.unit_price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-1 text-sm font-bold text-grafito-900 dark:text-white border-t border-grafito-100 dark:border-white/5">
                <span>Total nuevo pedido</span>
                <span className="text-brand-500">{fmt(cartTotal)}</span>
        
              </div>
            </div>
          )}

          {/* ── Botones de acción ── */}
          {cart.length > 0 && (
            <div className="px-5 py-3">
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
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
