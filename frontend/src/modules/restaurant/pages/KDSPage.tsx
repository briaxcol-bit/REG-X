import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, ChefHat, CheckCheck, Loader2, UtensilsCrossed, MessageSquare } from 'lucide-react'
import { supabase } from '@lib/supabase'
import { useAuthStore } from '@store/auth.store'
import {
  getKDSOrders,
  updateRestaurantOrderStatus,
  type RestaurantOrderRow,
  type RestaurantOrderItemRow,
} from '@lib/db'
import { toast } from 'sonner'
import { cn } from '@shared/utils/cn'

// ── Helpers de tiempo ──────────────────────────────────────────

function elapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
}

function formatElapsed(min: number): string {
  if (min < 1)  return '< 1 min'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

function urgencyClasses(min: number) {
  if (min < 5)  return { border: 'border-grafito-200 dark:border-white/5', clock: 'text-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
  if (min < 10) return { border: 'border-amber-400/60 ring-1 ring-amber-400/20', clock: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
  return { border: 'border-red-500/60 ring-2 ring-red-500/20', clock: 'text-red-500', badge: 'bg-red-500/10 text-red-600 dark:text-red-400' }
}

// ── Tarjeta de comanda ─────────────────────────────────────────

interface KDSCardProps {
  order:    RestaurantOrderRow
  onUpdate: (id: string, status: 'PREPARING' | 'READY') => Promise<void>
}

function KDSCard({ order, onUpdate }: KDSCardProps) {
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  // Actualiza el timer cada minuto
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const min    = elapsedMinutes(order.created_at)
  const urg    = urgencyClasses(min)
  const tableName = order.tables
    ? (order.tables.name ?? `Mesa ${order.tables.number}`)
    : 'Sin mesa'

  const items = (order.order_items ?? []) as RestaurantOrderItemRow[]

  const handleAction = async (status: 'PREPARING' | 'READY') => {
    setBusy(true)
    try {
      await onUpdate(order.id, status)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border-2 bg-white dark:bg-grafito-900 p-5 flex flex-col gap-4 shadow-sm transition-all',
        urg.border,
      )}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-grafito-100 dark:border-white/5">
        <div>
          <h3 className="text-lg font-extrabold text-grafito-900 dark:text-white">
            #{order.order_number}
          </h3>
          <p className="text-xs font-semibold text-brand-500 mt-0.5">{tableName}</p>
        </div>
        <div className={cn('flex items-center gap-1.5 text-xs font-bold shrink-0', urg.clock)}>
          <Clock className="h-4 w-4" />
          <span>{formatElapsed(min)}</span>
        </div>
      </div>

      {/* Estado actual */}
      {order.status === 'PREPARING' && (
        <div className="flex items-center gap-1.5 -mt-1 mb-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-bold px-2 py-0.5">
            <ChefHat className="h-3 w-3" />
            En preparación
          </span>
        </div>
      )}

      {/* Ítems */}
      <ul className="space-y-2.5 flex-1">
        {items.map((item, idx) => {
          const itemName = (item as any).name ?? item.products?.name ?? 'Producto'
          return (
            <li key={item.id ?? idx}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-md bg-grafito-100 dark:bg-white/10 text-[10px] font-black text-grafito-700 dark:text-grafito-200">
                  {item.quantity}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-grafito-900 dark:text-white leading-snug">
                    {itemName}
                  </p>
                  {/* Nota del mesero */}
                  {item.notes && (
                    <p className="mt-0.5 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Nota general de la orden */}
      {order.notes && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span><span className="font-semibold">Nota:</span> {order.notes}</span>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 mt-auto pt-1">
        {order.status === 'PENDING' && (
          <button
            disabled={busy}
            onClick={() => handleAction('PREPARING')}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-xs font-bold text-grafito-700 dark:text-grafito-200 hover:bg-grafito-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChefHat className="h-3.5 w-3.5" />}
            Preparando
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => handleAction('READY')}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          Despachar / Listo
        </button>
      </div>
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────

export default function KDSPage() {
  const navigate           = useNavigate()
  const { tenant, branch } = useAuthStore()

  const [orders,  setOrders]  = useState<RestaurantOrderRow[]>([])
  const [loading, setLoading] = useState(true)

  // ── Carga inicial ────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!tenant?.tenantId || !branch?.branchId) return
    try {
      const rows = await getKDSOrders(tenant.tenantId, branch.branchId)
      setOrders(rows)
    } catch (e: any) {
      console.error('[KDS] load error', e)
    } finally {
      setLoading(false)
    }
  }, [tenant?.tenantId, branch?.branchId])

  useEffect(() => { load() }, [load])

  // Polling cada 30 s de respaldo
  useEffect(() => {
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  // ── Supabase Realtime ────────────────────────────────────────
  useEffect(() => {
    if (!tenant?.tenantId) return

    const channel = supabase
      .channel(`kds-orders-${tenant.tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => load())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') load()
      })

    return () => { supabase.removeChannel(channel) }
  }, [tenant?.tenantId, load])

  // ── Despachar / cambiar estado ───────────────────────────────
  const handleUpdate = useCallback(async (id: string, status: 'PREPARING' | 'READY') => {
    try {
      await updateRestaurantOrderStatus(id, status)
      if (status === 'READY') {
        toast.success('Comanda despachada ✓')
        // Quitar de la vista localmente (Realtime también lo hará)
        setOrders(prev => prev.filter(o => o.id !== id))
      } else {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
        toast('Marcada como "En preparación"')
      }
    } catch (e: any) {
      toast.error('Error al actualizar la comanda.')
    }
  }, [])

  // Separar PENDING vs PREPARING para mostrar PENDING primero con urgencia
  const pending    = orders.filter(o => o.status === 'PENDING')
  const preparing  = orders.filter(o => o.status === 'PREPARING')
  const allSorted  = [...pending, ...preparing]

  return (
    <div className="flex flex-col min-h-screen bg-grafito-50 dark:bg-grafito-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/restaurant')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">
              KDS — Pantalla de Cocina
            </h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">
              Control y despacho de comandas de alimentos y bebidas.
            </p>
          </div>
        </div>

        {/* Contadores */}
        {!loading && (
          <div className="flex items-center gap-3">
            {pending.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                {pending.length} nueva{pending.length !== 1 ? 's' : ''}
              </span>
            )}
            {preparing.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold px-3 py-1.5">
                <ChefHat className="h-3.5 w-3.5" />
                {preparing.length} en prep.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-grafito-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando comandas...</span>
          </div>
        ) : allSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
              <UtensilsCrossed className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-grafito-700 dark:text-grafito-200">Cocina libre</p>
            <p className="text-sm text-grafito-400 dark:text-grafito-500">
              No hay comandas pendientes en este momento.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allSorted.map(order => (
              <KDSCard
                key={order.id}
                order={order}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
