import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Clock, ChefHat, CheckCheck, Loader2,
  UtensilsCrossed, MessageSquare, LogOut, History, X,
} from 'lucide-react'
import { supabase } from '@lib/supabase'
import { useAuthStore } from '@store/auth.store'
import {
  getKDSOrders,
  getKDSHistory,
  updateRestaurantOrderStatus,
  type RestaurantOrderRow,
  type RestaurantOrderItemRow,
} from '@lib/db'
import { toast } from 'sonner'
import { cn } from '@shared/utils/cn'

// ── Helpers ────────────────────────────────────────────────────

function elapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
}

function formatElapsed(min: number): string {
  if (min < 1)  return '< 1 min'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

function urgencyClasses(min: number) {
  if (min < 5)  return { border: 'border-grafito-200 dark:border-white/5', clock: 'text-emerald-500' }
  if (min < 10) return { border: 'border-amber-400/60 ring-1 ring-amber-400/20', clock: 'text-amber-400' }
  return          { border: 'border-red-500/60 ring-2 ring-red-500/20',   clock: 'text-red-500'   }
}

/** Nombre de mesa sin duplicar "Mesa" */
function tableLabel(order: RestaurantOrderRow): string {
  if (!order.tables) return 'Sin mesa'
  return order.tables.name ?? order.tables.number ?? 'Mesa'
}

// ── KDSCard ────────────────────────────────────────────────────

interface KDSCardProps {
  order:    RestaurantOrderRow
  onUpdate: (id: string, status: 'PREPARING' | 'READY') => Promise<void>
}

function KDSCard({ order, onUpdate }: KDSCardProps) {
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const min   = elapsedMinutes(order.created_at)
  const urg   = urgencyClasses(min)
  const items = (order.order_items ?? []) as RestaurantOrderItemRow[]

  const act = async (status: 'PREPARING' | 'READY') => {
    setBusy(true)
    try { await onUpdate(order.id, status) }
    finally { setBusy(false) }
  }

  return (
    <div className={cn(
      'rounded-2xl border-2 bg-white dark:bg-grafito-900 p-5 flex flex-col gap-4 shadow-sm transition-all',
      urg.border,
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-grafito-100 dark:border-white/5">
        <div>
          <h3 className="text-lg font-extrabold text-grafito-900 dark:text-white">
            #{order.order_number}
          </h3>
          <p className="text-xs font-semibold text-brand-500 mt-0.5">{tableLabel(order)}</p>
        </div>
        <div className={cn('flex items-center gap-1.5 text-xs font-bold shrink-0', urg.clock)}>
          <Clock className="h-4 w-4" />
          <span>{formatElapsed(min)}</span>
        </div>
      </div>

      {order.status === 'PREPARING' && (
        <div className="-mt-1 mb-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-bold px-2 py-0.5">
            <ChefHat className="h-3 w-3" /> En preparación
          </span>
        </div>
      )}

      {/* Ítems */}
      <ul className="space-y-2.5 flex-1">
        {items.map((item, idx) => (
          <li key={item.id ?? idx} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-md bg-grafito-100 dark:bg-white/10 text-[10px] font-black text-grafito-700 dark:text-grafito-200">
              {item.quantity}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-grafito-900 dark:text-white leading-snug">
                {(item as any).name ?? item.products?.name ?? 'Producto'}
              </p>
              {item.notes && (
                <p className="mt-0.5 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                  {item.notes}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

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
            onClick={() => act('PREPARING')}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-xs font-bold text-grafito-700 dark:text-grafito-200 hover:bg-grafito-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChefHat className="h-3.5 w-3.5" />}
            Preparando
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => act('READY')}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          Despachar / Listo
        </button>
      </div>
    </div>
  )
}

// ── Panel de historial (drawer lateral) ────────────────────────

interface HistoryPanelProps {
  orders:  RestaurantOrderRow[]
  loading: boolean
  onClose: () => void
}

function HistoryPanel({ orders, loading, onClose }: HistoryPanelProps) {

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 flex flex-col w-full max-w-sm bg-white dark:bg-grafito-900 shadow-2xl border-l border-grafito-200 dark:border-white/10 h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-grafito-100 dark:border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <History className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-grafito-900 dark:text-white">Historial de despachos</h2>
              <p className="text-[11px] text-grafito-500 dark:text-grafito-400">Últimas 4 horas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-grafito-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <CheckCheck className="h-10 w-10 text-grafito-300 dark:text-grafito-600" />
              <p className="text-sm font-semibold text-grafito-500">Sin despachos recientes</p>
              <p className="text-xs text-grafito-400">Las comandas despachadas aparecerán aquí.</p>
            </div>
          ) : orders.map(order => {
            const items = (order.order_items ?? []) as RestaurantOrderItemRow[]
            const min   = elapsedMinutes(order.created_at)
            return (
              <div
                key={order.id}
                className="rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800/60 p-3 space-y-2"
              >
                {/* Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-extrabold text-grafito-900 dark:text-white">
                      #{order.order_number}
                    </span>
                    <span className="ml-2 text-xs text-brand-500 font-semibold">{tableLabel(order)}</span>
                  </div>
                  <span className="text-[10px] text-grafito-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{formatElapsed(min)}
                  </span>
                </div>

                {/* Ítems compactos */}
                <ul className="space-y-0.5">
                  {items.map((item, idx) => (
                    <li key={item.id ?? idx} className="flex items-center gap-1.5 text-xs text-grafito-600 dark:text-grafito-300">
                      <span className="font-bold text-grafito-800 dark:text-grafito-200">{item.quantity}×</span>
                      {(item as any).name ?? item.products?.name ?? 'Producto'}
                    </li>
                  ))}
                </ul>

              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────

export default function KDSPage() {
  const navigate                          = useNavigate()
  const { tenant, branch, hasRole, logout } = useAuthStore()
  const isChef = hasRole('CHEF')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
  }

  const [orders,       setOrders]       = useState<RestaurantOrderRow[]>([])
  const [history,      setHistory]      = useState<RestaurantOrderRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [historyOpen,  setHistoryOpen]  = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Carga activas ────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!tenant?.tenantId || !branch?.branchId) return
    try {
      const rows = await getKDSOrders(tenant.tenantId, branch.branchId)
      setOrders(rows)
    } catch (e) {
      console.error('[KDS] load error', e)
    } finally {
      setLoading(false)
    }
  }, [tenant?.tenantId, branch?.branchId])

  // ── Carga historial ──────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setHistoryLoading(true)
    try {
      const rows = await getKDSHistory(tenant.tenantId, branch.branchId)
      setHistory(rows)
    } catch (e) {
      console.error('[KDS] history error', e)
    } finally {
      setHistoryLoading(false)
    }
  }, [tenant?.tenantId, branch?.branchId])

  useEffect(() => { load() }, [load])

  // Abrir historial → cargar datos
  const openHistory = () => { setHistoryOpen(true); loadHistory() }

  // Polling cada 30 s de respaldo
  useEffect(() => {
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  // ── Supabase Realtime ────────────────────────────────────────
  useEffect(() => {
    if (!tenant?.tenantId) return
    const ch = supabase
      .channel(`kds-orders-${tenant.tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },      () => { load(); if (historyOpen) loadHistory() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => load())
      .subscribe((s) => { if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') load() })
    return () => { supabase.removeChannel(ch) }
  }, [tenant?.tenantId, load, loadHistory, historyOpen])

  // ── Despachar ────────────────────────────────────────────────
  const handleUpdate = useCallback(async (id: string, status: 'PREPARING' | 'READY') => {
    try {
      await updateRestaurantOrderStatus(id, status)
      if (status === 'READY') {
        toast.success('Comanda despachada ✓')
        setOrders(prev => prev.filter(o => o.id !== id))
        if (historyOpen) loadHistory()
      } else {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
        toast('En preparación')
      }
    } catch {
      toast.error('Error al actualizar la comanda.')
    }
  }, [historyOpen, loadHistory])

  const pending   = orders.filter(o => o.status === 'PENDING')
  const preparing = orders.filter(o => o.status === 'PREPARING')
  const allSorted = [...pending, ...preparing]

  return (
    <div className="flex flex-col min-h-screen bg-grafito-50 dark:bg-grafito-950">

      {/* Panel historial */}
      {historyOpen && (
        <HistoryPanel
          orders={history}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {!isChef && (
            <button
              onClick={() => navigate('/restaurant')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">
              KDS — Pantalla de Cocina
            </h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">
              Control y despacho de comandas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!loading && (
            <>
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
            </>
          )}

          <button
            onClick={openHistory}
            title="Historial de despachos"
            className="flex items-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 px-3 py-2 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-500/30 transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Historial</span>
          </button>

          {isChef && (
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex items-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 px-3 py-2 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          )}
        </div>
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
            <button
              onClick={openHistory}
              className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold mt-1"
            >
              <History className="h-3.5 w-3.5" />
              Ver comandas despachadas
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allSorted.map(order => (
              <KDSCard key={order.id} order={order} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
