import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Lock, Unlock, RotateCcw, Loader2,
  Plus, X, ImageIcon, Trash2,
} from 'lucide-react'
import { createTable, updateTable, deleteTable, type TableRow } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { TableOrderPanel } from '../components/TableOrderPanel'
import {
  CANVAS_W, CANVAS_H, TABLE_W, TABLE_H, STORAGE_KEY, STATUS_MAP,
  snap, defaultPos, TableMapCanvas, useTableMap,
} from '../components/TableMapCanvas'
import { toast } from 'sonner'
import { cn } from '@shared/utils/cn'

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

// ── Modal editar / eliminar mesa ───────────────────────────────

interface EditTableModalProps {
  table: TableRow
  onClose: () => void
  onSaved: (table: TableRow) => void
  onDeleted: (tableId: string) => void
}

function EditTableModal({ table, onClose, onSaved, onDeleted }: EditTableModalProps) {
  const { tenant } = useAuthStore()
  const [number,   setNumber]   = useState(table.number)
  const [name,     setName]     = useState(table.name ?? '')
  const [capacity, setCapacity] = useState(String(table.capacity))
  const [saving,   setSaving]   = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isOccupied = table.status === 'OCCUPIED'
  const inputCls = 'w-full rounded-xl bg-grafito-50 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 px-3 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 transition-colors'

  const handleSave = async () => {
    if (!number.trim()) { toast.warning('El número de mesa es requerido.'); return }
    if (!tenant?.tenantId) return
    setSaving(true)
    try {
      const row = await updateTable(tenant.tenantId, table.id, {
        number:   number.trim(),
        name:     name.trim() || null,
        capacity: Math.max(1, parseInt(capacity) || 4),
      })
      toast.success(`Mesa "${row.number}" actualizada.`)
      onSaved({ ...table, ...row })
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al actualizar la mesa.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tenant?.tenantId) return
    setDeleting(true)
    try {
      await deleteTable(tenant.tenantId, table.id)
      toast.success(`Mesa "${table.number}" eliminada.`)
      onDeleted(table.id)
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al eliminar la mesa.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-grafito-100 dark:border-white/5">
          <h2 className="text-sm font-bold text-grafito-900 dark:text-white">Editar Mesa {table.number}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Número / ID <span className="text-red-400">*</span>
            </label>
            <input value={number} onChange={e => setNumber(e.target.value)} autoFocus className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Nombre descriptivo <span className="text-grafito-400 font-normal">(opcional)</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Terraza, VIP..." className={inputCls} />
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
                type="number" min={1} max={20} value={capacity}
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

          {/* Eliminar */}
          {confirmingDelete ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                ¿Eliminar la mesa "{table.number}"? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="flex-1 rounded-lg border border-grafito-200 dark:border-white/10 py-2 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-white dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-500 py-2 text-xs font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {deleting ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                if (isOccupied) { toast.error('La mesa está ocupada: cobra o elimina su orden antes de eliminarla.'); return }
                setConfirmingDelete(true)
              }}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-colors',
                isOccupied
                  ? 'border-grafito-200 dark:border-white/10 text-grafito-400 cursor-not-allowed'
                  : 'border-red-200 dark:border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10',
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar mesa
            </button>
          )}
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────

export default function TablesPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const canManageTables = hasPermission('restaurant.tables.manage')

  const [editMode,       setEditMode]       = useState(false)
  const [addOpen,        setAddOpen]        = useState(false)
  const [selectedTable,  setSelectedTable]  = useState<TableRow | null>(null)
  const [editingTable,   setEditingTable]   = useState<TableRow | null>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)

  // ── Shared hook (SST) ────────────────────────────────────────
  const {
    tables, setTables, loading, positions, orderInfoMap,
    zoom, changeZoom, fitToScreen,
    bgImage, setBgImage, saveCfg,
    scrollRef,
    handleDragEnd,
    handleTableUpdated: updateTableInStore,
    handleTableCreated: addTableToStore,
  } = useTableMap()

  // Sync selectedTable when realtime updates come in via hook
  useEffect(() => {
    if (!selectedTable) return
    const updated = tables.find(t => t.id === selectedTable.id)
    if (updated) setSelectedTable(updated)
  }, [tables]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers locales ─────────────────────────────────────────

  const handleTableClick = useCallback((table: TableRow) => {
    if (editMode) {
      // En modo edición, clic en la mesa abre editar/eliminar
      if (canManageTables) setEditingTable(table)
      return
    }
    setSelectedTable(table)
  }, [editMode, canManageTables])

  const handleTableUpdated = useCallback((updated: TableRow) => {
    updateTableInStore(updated)
    setSelectedTable(updated)
  }, [updateTableInStore])

  const handleTableCreated = (table: TableRow, pos: { x: number; y: number }) => {
    addTableToStore(table, pos)
    setAddOpen(false)
    setEditMode(true)
  }

  const resetLayout = () => {
    const merged: Record<string, { x: number; y: number }> = {}
    tables.forEach((t, i) => { merged[t.id] = defaultPos(i) })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    // Force re-read by temporarily clearing and re-setting positions
    // useTableMap handles positions, so trigger re-load
    window.location.reload()
  }

  // ── Background image ─────────────────────────────────────────
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { toast.error('La imagen no puede superar 8 MB.'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setBgImage(url)
      saveCfg(zoom, url)
      toast.success('Imagen de fondo aplicada.')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeBg = () => {
    setBgImage(null)
    saveCfg(zoom, null)
  }

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

      {editingTable && (
        <EditTableModal
          table={editingTable}
          onClose={() => setEditingTable(null)}
          onSaved={updateTableInStore}
          onDeleted={(id) => setTables(prev => prev.filter(t => t.id !== id))}
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
                ? 'Arrastra para posicionar · clic en una mesa para editarla o eliminarla.'
                : 'Haz clic en una mesa para gestionar su pedido.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-3 mr-4">
            {legend.map(l => (
              <div key={l.key} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', l.dot)} />
                <span className="text-xs text-grafito-500 dark:text-grafito-400">{l.label}</span>
              </div>
            ))}
          </div>

          {canManageTables && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva Mesa
            </button>
          )}

          {canManageTables && editMode && (
            <button
              onClick={resetLayout}
              className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/10 px-3 py-2 text-xs text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resetear
            </button>
          )}

          {canManageTables && (
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
          )}
        </div>
      </div>

      {/* Barra de fondo (solo en edit mode) */}
      {editMode && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5 border-b border-brand-200 dark:border-brand-500/20 bg-brand-50 dark:bg-brand-500/5 shrink-0">
          <ImageIcon className="h-3.5 w-3.5 text-brand-500 shrink-0" />
          <span className="text-xs font-semibold text-grafito-700 dark:text-grafito-300">Fondo del mapa:</span>
          <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
          <button
            onClick={() => bgInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 px-2.5 py-1 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors"
          >
            {bgImage ? 'Cambiar imagen' : 'Subir plano / imagen'}
          </button>
          {bgImage && (
            <>
              <div className="h-6 w-10 rounded border border-grafito-200 dark:border-white/10 overflow-hidden shrink-0">
                <img src={bgImage} alt="fondo" className="h-full w-full object-cover" />
              </div>
              <button
                onClick={removeBg}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Quitar
              </button>
            </>
          )}
          <span className="ml-auto text-[10px] text-grafito-400 dark:text-grafito-500 hidden lg:block">
            PNG, JPG, WebP · máx 8 MB
          </span>
        </div>
      )}

      {/* Canvas — componente compartido */}
      <TableMapCanvas
        tables={tables}
        positions={positions}
        zoom={zoom}
        bgImage={bgImage}
        editMode={editMode}
        loading={loading}
        scrollRef={scrollRef}
        orderInfoMap={orderInfoMap}
        onTableClick={handleTableClick}
        onDragEnd={handleDragEnd}
        changeZoom={changeZoom}
        fitToScreen={fitToScreen}
        emptySlot={
          canManageTables ? (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Crear primera mesa
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
