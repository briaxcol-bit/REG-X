/**
 * TableMapCanvas — componente compartido entre TablesPage (meseros) y POS (cajero).
 * Single Source of Truth para el mapa de mesas.
 *
 * Exports:
 *  - Constantes: CANVAS_W, CANVAS_H, TABLE_W, TABLE_H, GRID, DEFAULT_ZOOM, ZOOM_STEPS
 *  - STATUS_MAP, snap, defaultPos
 *  - TableCard           — tarjeta de mesa (con info de orden si se proporciona)
 *  - useTableMap         — hook: datos, posiciones, zoom, realtime
 *  - TableMapCanvas      — área de canvas scrollable (sin header)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Users, Minus, Plus, Maximize, Loader2, Clock, ShoppingBag, User } from 'lucide-react'
import { getTables, getActiveTableOrders, type TableRow, type RestaurantOrderRow } from '@lib/db'
import { supabase } from '@lib/supabase'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'

// ── Constantes ────────────────────────────────────────────────────────────────

export const CANVAS_W    = 2400
export const CANVAS_H    = 1600
export const TABLE_W     = 110
export const TABLE_H     = 80
export const GRID        = 20
export const DEFAULT_ZOOM = 0.55

export const STORAGE_KEY    = 'regx_table_positions'
export const CANVAS_CFG_KEY = 'regx_canvas_config'

export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2]

// ── Status map ────────────────────────────────────────────────────────────────

export const STATUS_MAP: Record<TableRow['status'], {
  label: string; bg: string; border: string; dot: string
}> = {
  AVAILABLE:   { label: 'Disponible',    bg: 'bg-emerald-50 dark:bg-emerald-500/10',  border: 'border-emerald-300 dark:border-emerald-500/40', dot: 'bg-emerald-500' },
  OCCUPIED:    { label: 'Ocupada',       bg: 'bg-red-50    dark:bg-red-500/10',       border: 'border-red-300    dark:border-red-500/40',      dot: 'bg-red-500'     },
  RESERVED:    { label: 'Reservada',     bg: 'bg-amber-50  dark:bg-amber-500/10',     border: 'border-amber-300  dark:border-amber-500/40',    dot: 'bg-amber-500'   },
  MAINTENANCE: { label: 'Mantenimiento', bg: 'bg-grafito-100 dark:bg-white/5',        border: 'border-grafito-300 dark:border-white/10',       dot: 'bg-grafito-400' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const snap = (v: number) => Math.round(v / GRID) * GRID

export const defaultPos = (index: number) => ({
  x: snap(40 + (index % 8) * 280),
  y: snap(40 + Math.floor(index / 8) * 160),
})

function elapsedLabel(createdAt: string): string {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  if (diff < 60)  return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TableOrderInfo {
  itemCount:  number
  total:      number
  waiterName: string | null
  createdAt:  string
}

// ── TableCard ─────────────────────────────────────────────────────────────────

interface TableCardProps {
  table:      TableRow
  pos:        { x: number; y: number }
  editMode:   boolean
  zoom:       number
  orderInfo?: TableOrderInfo | null
  onDragEnd:  (id: string, x: number, y: number) => void
  onClick:    (table: TableRow) => void
}

export function TableCard({ table, pos, editMode, zoom, orderInfo, onDragEnd, onClick }: TableCardProps) {
  const s        = STATUS_MAP[table.status] ?? STATUS_MAP.AVAILABLE
  const dragging = useRef(false)
  const didMove  = useRef(false)
  const offset   = useRef({ x: 0, y: 0 })
  const elRef    = useRef<HTMLDivElement>(null)

  // Ticker para actualizar tiempo cada 30s
  const [, setTick] = useState(0)
  useEffect(() => {
    if (table.status !== 'OCCUPIED' || !orderInfo) return
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [table.status, orderInfo])

  const onMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return
    e.preventDefault()
    dragging.current = true
    didMove.current  = false
    const rect = elRef.current!.getBoundingClientRect()
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !elRef.current) return
      didMove.current = true
      const parent = elRef.current.parentElement!.getBoundingClientRect()
      const nx = snap(Math.max(0, Math.min((ev.clientX - parent.left - offset.current.x) / zoom, CANVAS_W - TABLE_W)))
      const ny = snap(Math.max(0, Math.min((ev.clientY - parent.top  - offset.current.y) / zoom, CANVAS_H - TABLE_H)))
      elRef.current.style.left = `${nx}px`
      elRef.current.style.top  = `${ny}px`
    }
    const onUp = (ev: MouseEvent) => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      if (!elRef.current) return
      const parent = elRef.current.parentElement!.getBoundingClientRect()
      const nx = snap(Math.max(0, Math.min((ev.clientX - parent.left - offset.current.x) / zoom, CANVAS_W - TABLE_W)))
      const ny = snap(Math.max(0, Math.min((ev.clientY - parent.top  - offset.current.y) / zoom, CANVAS_H - TABLE_H)))
      onDragEnd(table.id, nx, ny)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  const handleClick = () => {
    // En modo edición un clic sin arrastre también dispara (editar/eliminar mesa);
    // si hubo arrastre, no.
    if (didMove.current) return
    onClick(table)
  }

  const occupied = table.status === 'OCCUPIED' && !!orderInfo

  return (
    <div
      ref={elRef}
      onMouseDown={onMouseDown}
      onClick={handleClick}
      style={{
        left: pos.x, top: pos.y,
        width: TABLE_W, height: occupied ? TABLE_H + 28 : TABLE_H,
        position: 'absolute',
      }}
      className={cn(
        'rounded-xl border-2 flex flex-col justify-between p-2.5 select-none transition-shadow',
        s.bg, s.border,
        editMode
          ? 'cursor-grab active:cursor-grabbing shadow-lg ring-2 ring-brand-500/30'
          : 'cursor-pointer shadow-sm hover:shadow-lg hover:scale-105 transition-transform',
      )}
    >
      {/* Fila 1: nombre + dot */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-black text-grafito-900 dark:text-white truncate leading-tight">
          {table.name ?? table.number}
        </span>
        <span className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
      </div>

      {/* Fila 2: capacidad + tiempo (si ocupada) */}
      <div className="flex items-center justify-between gap-1 text-[10px] text-grafito-500 dark:text-grafito-400">
        <div className="flex items-center gap-0.5">
          <Users className="h-2.5 w-2.5 shrink-0" />
          <span>{table.capacity}</span>
        </div>
        {occupied && (
          <div className="flex items-center gap-0.5 text-red-500 dark:text-red-400">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span className="font-semibold">{elapsedLabel(orderInfo!.createdAt)}</span>
          </div>
        )}
      </div>

      {/* Fila 3: status pill + ítems */}
      <div className="flex items-center justify-between gap-1">
        <span className={cn(
          'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
          table.status === 'AVAILABLE'   ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
          table.status === 'OCCUPIED'    ? 'bg-red-500/15 text-red-600 dark:text-red-400'             :
          table.status === 'RESERVED'    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'       :
                                           'bg-grafito-200 text-grafito-500',
        )}>
          {s.label}
        </span>
        {occupied && (
          <div className="flex items-center gap-0.5 text-[9px] text-grafito-500 dark:text-grafito-400">
            <ShoppingBag className="h-2.5 w-2.5 shrink-0" />
            <span>{orderInfo!.itemCount}</span>
          </div>
        )}
      </div>

      {/* Fila extra (solo si ocupada): total + mesero */}
      {occupied && (
        <div className="pt-1 mt-0.5 border-t border-current/10 flex items-center justify-between gap-1">
          <span className="text-[9px] font-black text-grafito-800 dark:text-white truncate">
            {fmt(orderInfo!.total)}
          </span>
          {orderInfo!.waiterName && (
            <div className="flex items-center gap-0.5 text-[9px] text-grafito-500 dark:text-grafito-400 min-w-0">
              <User className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{orderInfo!.waiterName.split(' ')[0]}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── useTableMap hook ──────────────────────────────────────────────────────────

export function useTableMap() {
  const { tenant, branch } = useAuthStore()

  const [tables,    setTables]    = useState<TableRow[]>([])
  const [orders,    setOrders]    = useState<RestaurantOrderRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [zoom,      setZoom]      = useState(DEFAULT_ZOOM)
  const [bgImage,   setBgImage]   = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Cargar config persistida ──────────────────────────────────
  useEffect(() => {
    try {
      const cfg = JSON.parse(localStorage.getItem(CANVAS_CFG_KEY) ?? '{}')
      if (cfg.zoom && cfg.zoom >= 0.25 && cfg.zoom <= 2) setZoom(cfg.zoom)
      if (cfg.bg) setBgImage(cfg.bg)
    } catch {}
  }, [])

  const saveCfg = useCallback((z: number, bg: string | null) => {
    localStorage.setItem(CANVAS_CFG_KEY, JSON.stringify({ zoom: z, bg }))
  }, [])

  // ── Cargar mesas + órdenes activas ────────────────────────────
  useEffect(() => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setLoading(true)
    Promise.all([
      getTables(tenant.tenantId, branch.branchId),
      getActiveTableOrders(tenant.tenantId, branch.branchId),
    ])
      .then(([rows, activeOrders]) => {
        setTables(rows)
        setOrders(activeOrders)
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
          const merged: Record<string, { x: number; y: number }> = {}
          rows.forEach((t, i) => { merged[t.id] = saved[t.id] ?? defaultPos(i) })
          setPositions(merged)
        } catch {
          const merged: Record<string, { x: number; y: number }> = {}
          rows.forEach((t, i) => { merged[t.id] = defaultPos(i) })
          setPositions(merged)
        }
      })
      .catch(() => { setTables([]); setOrders([]) })
      .finally(() => setLoading(false))
  }, [tenant?.tenantId, branch?.branchId])

  // ── Realtime: mesas ───────────────────────────────────────────
  useEffect(() => {
    if (!tenant?.tenantId) return
    const ch = supabase
      .channel('tables-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tables',
        filter: `tenant_id=eq.${tenant.tenantId}`,
      }, payload => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as TableRow
          setTables(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
        } else if (payload.eventType === 'INSERT') {
          if (tenant?.tenantId && branch?.branchId) {
            getTables(tenant.tenantId, branch.branchId).then(setTables).catch(() => {})
          }
        } else if (payload.eventType === 'DELETE') {
          setTables(prev => prev.filter(t => t.id !== (payload.old as any).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tenant?.tenantId, branch?.branchId])

  // ── Realtime: órdenes (para total, mesero, ítems en tarjeta) ─
  useEffect(() => {
    if (!tenant?.tenantId || !branch?.branchId) return
    const refresh = () =>
      getActiveTableOrders(tenant!.tenantId, branch!.branchId)
        .then(setOrders).catch(() => {})

    const ch = supabase
      .channel('table-map-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },      refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tenant?.tenantId, branch?.branchId])

  // ── Zoom ──────────────────────────────────────────────────────
  const changeZoom = useCallback((delta: number) => {
    setZoom(prev => {
      const idx  = ZOOM_STEPS.findIndex(s => s >= prev)
      const next = (delta > 0
        ? ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, idx + 1)]
        : ZOOM_STEPS[Math.max(0, idx - 1)]) ?? prev
      saveCfg(next, bgImage)
      return next
    })
  }, [bgImage, saveCfg])

  const fitToScreen = useCallback(() => {
    if (!scrollRef.current) return
    const { clientWidth, clientHeight } = scrollRef.current
    const zw = (clientWidth  - 48) / CANVAS_W
    const zh = (clientHeight - 48) / CANVAS_H
    const z  = parseFloat(Math.min(2, Math.max(0.25, Math.min(zw, zh))).toFixed(2))
    setZoom(z)
    saveCfg(z, bgImage)
  }, [bgImage, saveCfg])

  // Ctrl + scroll → zoom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      changeZoom(e.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [changeZoom])

  // ── Drag ──────────────────────────────────────────────────────
  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    setPositions(prev => {
      const next = { ...prev, [id]: { x, y } }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // ── Callbacks para el padre ───────────────────────────────────
  const handleTableUpdated = useCallback((updated: TableRow) => {
    setTables(prev => prev.map(t => t.id === updated.id ? updated : t))
  }, [])

  const handleTableCreated = useCallback((table: TableRow, pos: { x: number; y: number }) => {
    setTables(prev => [...prev, table])
    setPositions(prev => {
      const next = { ...prev, [table.id]: pos }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // ── orderInfoMap: table_id → TableOrderInfo ───────────────────
  // Agrega TODAS las comandas activas de cada mesa (puede haber varias).
  const orderInfoMap = useMemo(() => {
    const map = new Map<string, TableOrderInfo>()
    for (const order of orders) {
      if (!order.table_id) continue
      const items      = order.order_items ?? []
      const itemCount  = items.reduce((s, i) => s + i.quantity, 0)
      const total      = items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0)
      const waiterName = (order as any).waiter_name ?? null
      const existing   = map.get(order.table_id)
      if (existing) {
        map.set(order.table_id, {
          itemCount:   existing.itemCount + itemCount,
          total:       existing.total + total,
          waiterName:  existing.waiterName ?? waiterName,
          createdAt:   existing.createdAt,   // conserva la hora de la primera comanda
        })
      } else {
        map.set(order.table_id, { itemCount, total, waiterName, createdAt: order.created_at })
      }
    }
    return map
  }, [orders])

  return {
    tenant, branch,
    tables, setTables,
    orders, setOrders,
    loading,
    positions, setPositions,
    zoom, changeZoom, fitToScreen,
    bgImage, setBgImage, saveCfg,
    scrollRef,
    orderInfoMap,
    handleDragEnd,
    handleTableUpdated,
    handleTableCreated,
  }
}

// ── TableMapCanvas ────────────────────────────────────────────────────────────
// Área scrollable con canvas. Sin header ni toolbar — el padre provee eso.

export interface TableMapCanvasProps {
  tables:       TableRow[]
  positions:    Record<string, { x: number; y: number }>
  zoom:         number
  bgImage?:     string | null
  editMode?:    boolean
  loading?:     boolean
  scrollRef:    React.RefObject<HTMLDivElement | null>
  orderInfoMap: Map<string, TableOrderInfo>
  onTableClick: (table: TableRow) => void
  onDragEnd:    (id: string, x: number, y: number) => void
  changeZoom:   (delta: number) => void
  fitToScreen:  () => void
  emptySlot?:   React.ReactNode   // contenido para estado vacío
}

export function TableMapCanvas({
  tables, positions, zoom, bgImage, editMode = false, loading = false,
  scrollRef, orderInfoMap, onTableClick, onDragEnd, changeZoom, fitToScreen,
  emptySlot,
}: TableMapCanvasProps) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-auto p-6 relative">
      {loading ? (
        <div className="flex items-center justify-center h-full gap-2 text-grafito-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando mesas...</span>
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          {emptySlot ?? (
            <p className="text-sm text-grafito-400">No hay mesas configuradas.</p>
          )}
        </div>
      ) : (
        <>
          {/* Wrapper para el scroll correcto */}
          <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}>
            <div
              style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              className={cn(
                'relative rounded-2xl border-2 overflow-hidden',
                editMode
                  ? 'border-brand-400/50 dark:border-brand-500/30'
                  : 'border-dashed border-grafito-200 dark:border-white/10',
              )}
            >
              {/* Fondo */}
              <div className="absolute inset-0 bg-white dark:bg-grafito-900" />

              {/* Imagen de fondo */}
              {bgImage && (
                <>
                  <img src={bgImage} alt="plano del local" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                  <div className="absolute inset-0 bg-black/15 dark:bg-black/35" />
                </>
              )}

              {/* Grid SVG */}
              <svg
                className={cn('absolute inset-0 pointer-events-none', bgImage ? 'opacity-20' : 'opacity-100')}
                width={CANVAS_W} height={CANVAS_H}
              >
                <defs>
                  <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                    <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="currentColor" strokeWidth="0.4" className="text-grafito-200 dark:text-white/10" />
                  </pattern>
                  <pattern id="grid-lg" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                    <rect width={GRID * 5} height={GRID * 5} fill="url(#grid)" />
                    <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="currentColor" strokeWidth="0.8" className="text-grafito-200 dark:text-white/10" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-lg)" />
              </svg>

              <span className="absolute bottom-3 right-4 text-xs font-semibold text-grafito-300 dark:text-white/15 uppercase tracking-widest pointer-events-none select-none">
                Salón
              </span>

              {/* Tarjetas de mesa */}
              {tables.map((t, i) => (
                <TableCard
                  key={t.id}
                  table={t}
                  pos={positions[t.id] ?? defaultPos(i)}
                  editMode={editMode}
                  zoom={zoom}
                  orderInfo={orderInfoMap.get(t.id) ?? null}
                  onDragEnd={onDragEnd}
                  onClick={onTableClick}
                />
              ))}
            </div>
          </div>

          {/* Control de zoom flotante */}
          <div className="fixed bottom-6 right-6 z-30 flex items-center gap-0.5 rounded-xl bg-white dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 shadow-xl p-1">
            <button
              onClick={() => changeZoom(-1)}
              title="Alejar"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={fitToScreen}
              title="Zoom actual"
              className="px-2.5 py-1 text-xs font-mono font-semibold text-grafito-700 dark:text-grafito-200 hover:bg-grafito-100 dark:hover:bg-white/10 rounded-lg transition-colors min-w-[3.5rem] text-center"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => changeZoom(1)}
              title="Acercar"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-grafito-200 dark:bg-white/10 mx-0.5" />
            <button
              onClick={fitToScreen}
              title="Ajustar a pantalla"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-grafito-500 dark:text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
            >
              <Maximize className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
