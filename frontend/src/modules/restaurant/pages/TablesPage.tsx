import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Lock, Unlock, RotateCcw, Loader2, Plus, X } from 'lucide-react'
import { getTables, createTable, type TableRow } from '@lib/db'
import { supabase } from '@lib/supabase'
import { useAuthStore } from '@store/auth.store'
import { TableOrderPanel } from '../components/TableOrderPanel'
import { toast } from 'sonner'
import { cn } from '@shared/utils/cn'

// ── Constantes ─────────────────────────────────────────────────
const CANVAS_W = 1200
const CANVAS_H = 700
const TABLE_W  = 110
const TABLE_H  = 80
const GRID     = 20

const STATUS_MAP: Record<TableRow['status'], { label: string; bg: string; border: string; dot: string }> = {
  AVAILABLE:   { label: 'Disponible',    bg: 'bg-emerald-50 dark:bg-emerald-500/10',  border: 'border-emerald-300 dark:border-emerald-500/40', dot: 'bg-emerald-500' },
  OCCUPIED:    { label: 'Ocupada',       bg: 'bg-red-50    dark:bg-red-500/10',       border: 'border-red-300    dark:border-red-500/40',      dot: 'bg-red-500'     },
  RESERVED:    { label: 'Reservada',     bg: 'bg-amber-50  dark:bg-amber-500/10',     border: 'border-amber-300  dark:border-amber-500/40',    dot: 'bg-amber-500'   },
  MAINTENANCE: { label: 'Mantenimiento', bg: 'bg-grafito-100 dark:bg-white/5',        border: 'border-grafito-300 dark:border-white/10',       dot: 'bg-grafito-400' },
}

const snap = (v: number) => Math.round(v / GRID) * GRID

const defaultPos = (index: number) => ({
  x: snap(40 + (index % 5) * 200),
  y: snap(40 + Math.floor(index / 5) * 160),
})

// ── TableCard ──────────────────────────────────────────────────

interface TableCardProps {
  table:    TableRow
  pos:      { x: number; y: number }
  editMode: boolean
  onDragEnd: (id: string, x: number, y: number) => void
  onClick:   (table: TableRow) => void
}

function TableCard({ table, pos, editMode, onDragEnd, onClick }: TableCardProps) {
  const s        = STATUS_MAP[table.status] ?? STATUS_MAP.AVAILABLE
  const dragging = useRef(false)
  const didMove  = useRef(false)
  const offset   = useRef({ x: 0, y: 0 })
  const elRef    = useRef<HTMLDivElement>(null)

  const onMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return
    e.preventDefault()
    dragging.current = true
    didMove.current  = false
    const rect   = elRef.current!.getBoundingClientRect()
    const parent = elRef.current!.parentElement!.getBoundingClientRect()
    offset.current = {
      x: e.clientX - rect.left + parent.left - parent.left,
      y: e.clientY - rect.top  + parent.top  - parent.top,
    }

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !elRef.current) return
      didMove.current = true
      const parent = elRef.current.parentElement!.getBoundingClientRect()
      const nx = snap(Math.max(0, Math.min(ev.clientX - parent.left - offset.current.x, CANVAS_W - TABLE_W)))
      const ny = snap(Math.max(0, Math.min(ev.clientY - parent.top  - offset.current.y, CANVAS_H - TABLE_H)))
      elRef.current.style.left = `${nx}px`
      elRef.current.style.top  = `${ny}px`
    }
    const onUp = (ev: MouseEvent) => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      if (!elRef.current) return
      const parent = elRef.current.parentElement!.getBoundingClientRect()
      const nx = snap(Math.max(0, Math.min(ev.clientX - parent.left - offset.current.x, CANVAS_W - TABLE_W)))
      const ny = snap(Math.max(0, Math.min(ev.clientY - parent.top  - offset.current.y, CANVAS_H - TABLE_H)))
      onDragEnd(table.id, nx, ny)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  const handleClick = () => {
    if (editMode || didMove.current) return
    onClick(table)
  }

  return (
    <div
      ref={elRef}
      onMouseDown={onMouseDown}
      onClick={handleClick}
      style={{ left: pos.x, top: pos.y, width: TABLE_W, height: TABLE_H, position: 'absolute' }}
      className={cn(
        'rounded-xl border-2 flex flex-col justify-between p-2.5 select-none transition-shadow',
        s.bg, s.border,
        editMode
          ? 'cursor-grab active:cursor-grabbing shadow-lg ring-2 ring-brand-500/30'
          : 'cursor-pointer shadow-sm hover:shadow-lg hover:scale-105 transition-transform',
      )}
    >
      {/* Nombre + dot */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-black text-grafito-900 dark:text-white truncate leading-tight">
          {table.name ?? table.number}
        </span>
        <span className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
      </div>

      {/* Capacidad */}
      <div className="flex items-center gap-1 text-[10px] text-grafito-500 dark:text-grafito-400">
        <Users className="h-3 w-3 shrink-0" />
        <span>{table.capacity} personas</span>
      </div>

      {/* Estado */}
      <span className={cn(
        'self-start text-[9px] font-bold px-1.5 py-0.5 rounded-full',
        table.status === 'AVAILABLE'   ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
        table.status === 'OCCUPIED'    ? 'bg-red-500/15 text-red-600 dark:text-red-400'             :
        table.status === 'RESERVED'    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'       :
                                         'bg-grafito-200 text-grafito-500',
      )}>
        {s.label}
      </span>
    </div>
  )
}

// ── Modal nueva mesa ───────────────────────────────────────────

interface AddTableModalProps {
  onClose: () => void
  onSaved: (table: TableRow, pos: { x: number; y: number }) => void
}

function AddTableModal({ onClose, onSaved }: AddTableModalProps) {
  const { tenant, branch } = useAuthStore()
  const [number,   setNumber]   = useState('')
  const [name,     setName]     = useState('')
  const [capacity, setCapacity] = useState('4')
  const [saving,   setSaving]   = useState(false)

  const inputCls = 'w-full rounded-xl bg-grafito-50 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 px-3 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 transition-colors'

  const handleSave = async () => {
    if (!number.trim()) { toast.warning('El número de mesa es requerido.'); return }
    if (!tenant?.tenantId || !branch?.branchId) return
    setSaving(true)
    try {
      const row = await createTable(tenant.tenantId, branch.branchId, {
        number:   number.trim(),
        name:     name.trim() || null,
        capacity: Math.max(1, parseInt(capacity) || 4),
      })
      toast.success(`Mesa "${row.number}" creada.`)
      onSaved(row, { x: snap(CANVAS_W / 2 - TABLE_W / 2), y: snap(CANVAS_H / 2 - TABLE_H / 2) })
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al crear la mesa.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-grafito-100 dark:border-white/5">
          <h2 className="text-sm font-bold text-grafito-900 dark:text-white">Nueva Mesa</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Número / ID <span className="text-red-400">*</span>
            </label>
            <input
              value={number}
              onChange={e => setNumber(e.target.value)}
              placeholder="Ej: 1, A3, VIP-1"
              autoFocus
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Nombre descriptivo <span className="text-grafito-400 font-normal">(opcional)</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Terraza, VIP, Ventana..."
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Capacidad (personas)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCapacity(v => String(Math.max(1, (parseInt(v) || 4) - 1)))}
                className="h-10 w-10 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors font-bold text-lg"
              >−</button>
              <input
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={e => setCapacity(e.target.value)}
                className="flex-1 text-center rounded-xl bg-grafito-50 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-bold text-grafito-900 dark:text-white outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setCapacity(v => String(Math.min(20, (parseInt(v) || 4) + 1)))}
                className="h-10 w-10 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors font-bold text-lg"
              >+</button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !number.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Crear mesa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────

const STORAGE_KEY = 'regx_table_positions'

export default function TablesPage() {
  const navigate            = useNavigate()
  const { tenant, branch }  = useAuthStore()

  const [tables,    setTables]    = useState<TableRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editMode,  setEditMode]  = useState(false)
  const [addOpen,   setAddOpen]   = useState(false)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})

  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null)

  // ── Click en mesa → siempre abre el panel del mesero ──────────
  const handleTableClick = useCallback((table: TableRow) => {
    if (editMode) return
    setSelectedTable(table)
  }, [editMode])

  // ── Cargar mesas ─────────────────────────────────────────────
  useEffect(() => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setLoading(true)
    getTables(tenant.tenantId, branch.branchId)
      .then(rows => {
        setTables(rows)
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
      .catch(() => setTables([]))
      .finally(() => setLoading(false))
  }, [tenant?.tenantId, branch?.branchId])

  // ── Supabase Realtime — tabla "tables" ───────────────────────
  useEffect(() => {
    if (!tenant?.tenantId) return

    const channel = supabase
      .channel('tables-realtime')
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'tables',
          filter: `tenant_id=eq.${tenant.tenantId}`,
        },
        payload => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TableRow
            setTables(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
            // Si el panel tiene esa mesa abierta, actualizarla también
            setSelectedTable(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev)
          } else if (payload.eventType === 'INSERT') {
            // Nueva mesa creada desde otro dispositivo — poco frecuente, recargar
            if (tenant?.tenantId && branch?.branchId) {
              getTables(tenant.tenantId, branch.branchId).then(setTables).catch(() => {})
            }
          } else if (payload.eventType === 'DELETE') {
            setTables(prev => prev.filter(t => t.id !== (payload.old as any).id))
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tenant?.tenantId, branch?.branchId])

  // ── Drag & drop ──────────────────────────────────────────────
  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    setPositions(prev => {
      const next = { ...prev, [id]: { x, y } }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const handleTableCreated = (table: TableRow, pos: { x: number; y: number }) => {
    setTables(prev => [...prev, table])
    setPositions(prev => {
      const next = { ...prev, [table.id]: pos }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setAddOpen(false)
    setEditMode(true)
  }

  const resetLayout = () => {
    const merged: Record<string, { x: number; y: number }> = {}
    tables.forEach((t, i) => { merged[t.id] = defaultPos(i) })
    setPositions(merged)
    localStorage.removeItem(STORAGE_KEY)
  }

  // ── Actualización desde el panel ─────────────────────────────
  const handleTableUpdated = useCallback((updated: TableRow) => {
    setTables(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTable(updated)
  }, [])

  const legend = Object.entries(STATUS_MAP).map(([k, v]) => ({ key: k, ...v }))

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-grafito-50 dark:bg-grafito-950">
      {addOpen && (
        <AddTableModal
          onClose={() => setAddOpen(false)}
          onSaved={handleTableCreated}
        />
      )}

      {selectedTable && (
        <TableOrderPanel
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onTableUpdated={handleTableUpdated}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/restaurant')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-grafito-900 dark:text-white">Mapa de Mesas</h1>
            <p className="text-xs text-grafito-500 dark:text-grafito-400">
              {editMode
                ? 'Arrastra las mesas para posicionarlas en el espacio físico.'
                : 'Haz clic en una mesa para gestionar su pedido.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Leyenda */}
          <div className="hidden md:flex items-center gap-3 mr-4">
            {legend.map(l => (
              <div key={l.key} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', l.dot)} />
                <span className="text-xs text-grafito-500 dark:text-grafito-400">{l.label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva Mesa
          </button>

          {editMode && (
            <button
              onClick={resetLayout}
              className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/10 px-3 py-2 text-xs text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resetear
            </button>
          )}

          <button
            onClick={() => setEditMode(v => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              editMode
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'border border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5',
            )}
          >
            {editMode
              ? <><Lock className="h-3.5 w-3.5" /> Guardar layout</>
              : <><Unlock className="h-3.5 w-3.5" /> Editar layout</>
            }
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-grafito-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando mesas...</span>
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-grafito-400">No hay mesas configuradas.</p>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Crear primera mesa
            </button>
          </div>
        ) : (
          <div
            className="relative rounded-2xl border-2 border-dashed border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 overflow-hidden"
            style={{ width: CANVAS_W, height: CANVAS_H, minWidth: CANVAS_W }}
          >
            {/* Grid de fondo */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={CANVAS_W}
              height={CANVAS_H}
            >
              <defs>
                <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="currentColor" strokeWidth="0.4" className="text-grafito-200 dark:text-white/5" />
                </pattern>
                <pattern id="grid-lg" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                  <rect width={GRID * 5} height={GRID * 5} fill="url(#grid)" />
                  <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="currentColor" strokeWidth="0.8" className="text-grafito-200 dark:text-white/5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-lg)" />
            </svg>

            {/* Etiqueta "Salón" */}
            <span className="absolute bottom-3 right-4 text-xs font-semibold text-grafito-300 dark:text-white/10 uppercase tracking-widest pointer-events-none select-none">
              Salón
            </span>

            {/* Mesas */}
            {tables.map(t => (
              <TableCard
                key={t.id}
                table={t}
                pos={positions[t.id] ?? defaultPos(tables.indexOf(t))}
                editMode={editMode}
                onDragEnd={handleDragEnd}
                onClick={handleTableClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
