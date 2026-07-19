import { useState, useEffect, useRef } from 'react'
import { Package, Loader2, Search, Tag, X, Pencil, Plus, Minus, CheckCircle2, Trash2, AlertTriangle, LayoutGrid, Table2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { getInventory, updateStock, deleteProduct, createProduct, getCategories, getProducts, bulkImportProducts, type CategoryRow, type BulkProductRow } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { usePOSTerminal } from '@modules/pos/hooks/usePOSTerminal'
import { cn } from '@shared/utils/cn'
import { toast } from 'sonner'
import type { InventoryRow } from '@lib/db'
// ── Modal edición de stock ──────────────────────────────────────
interface EditStockModalProps {
  row: InventoryRow
  onClose: () => void
  onSaved: () => void
}

function EditStockModal({ row, onClose, onSaved }: EditStockModalProps) {
  const { tenant, branch, user } = useAuthStore()
  const p    = row.products as any
  const prev = Number(row.quantity)

  const [qtyStr, setQtyStr] = useState(String(Math.max(0, prev)))
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  const qty   = Math.max(0, parseInt(qtyStr) || 0)
  const delta = qty - prev

  const handleSave = async () => {
    if (!tenant?.tenantId || !branch?.branchId || !user?.id) return
    if (qty === prev) { onClose(); return }
    setSaving(true)
    try {
      await updateStock(
        tenant.tenantId,
        branch.branchId,
        user.id,
        row.id,
        row.product_id,
        qty,
        prev,
        notes.trim() || undefined,
      )
      toast.success(`Stock de "${p?.name}" actualizado a ${qty} uds.`)
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al actualizar el stock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div>
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Editar stock</h3>
          <p className="text-sm text-grafito-500 dark:text-grafito-400 mt-0.5 line-clamp-1">{p?.name ?? '—'}</p>
        </div>

        {/* Cantidad actual */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setQtyStr(String(Math.max(0, qty - 1)))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            <Minus className="h-4 w-4 text-grafito-600 dark:text-grafito-300" />
          </button>

          <div className="text-center">
            <input
              type="number"
              min={0}
              value={qtyStr}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '')
                setQtyStr(raw === '' ? '' : String(parseInt(raw)))
              }}
              onBlur={() => setQtyStr(String(qty))}
              className="w-24 text-center text-3xl font-black text-grafito-900 dark:text-white bg-transparent outline-none border-b-2 border-brand-500 pb-1"
            />
            <p className="text-xs text-grafito-400 mt-1">unidades</p>
          </div>

          <button
            onClick={() => setQtyStr(String(qty + 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            <Plus className="h-4 w-4 text-grafito-600 dark:text-grafito-300" />
          </button>
        </div>

        {/* Delta */}
        {qty !== Math.max(0, prev) && (
          <p className="text-center text-sm font-semibold text-emerald-500">
            Stock: {qty} unidades
          </p>
        )}

        {/* Nota */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-grafito-500 dark:text-grafito-400">
            Motivo del ajuste <span className="text-grafito-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ej: Conteo físico, devolución..."
            className="w-full rounded-xl bg-grafito-100 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 px-3 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || qty === prev}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal confirmación eliminar ────────────────────────────────
interface DeleteConfirmProps {
  name: string
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}
function DeleteConfirmModal({ name, onConfirm, onCancel, deleting }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-red-200 dark:border-red-500/20 bg-white dark:bg-grafito-900 shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/10 shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-grafito-900 dark:text-white">Eliminar producto</h3>
            <p className="text-sm text-grafito-500 dark:text-grafito-400 mt-0.5 line-clamp-2">¿Eliminar <span className="font-semibold text-grafito-700 dark:text-grafito-200">"{name}"</span>? Esta acción no se puede deshacer.</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} disabled={deleting} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-all disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-all disabled:opacity-50">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CSV: plantilla y parseo ────────────────────────────────────
const CSV_HEADER  = 'nombre;sku;categoria;codigo_barras;precio;costo;stock;stock_minimo;stock_maximo'
const CSV_EXAMPLE = 'Producto de ejemplo;;Bebidas;7702004003508;4500;3200;24;6;100'

/** Escapa un valor para CSV con separador ';' */
function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[";,\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/**
 * Exporta un valor como TEXTO forzado para Excel (formato ="1234567890").
 * Evita que códigos de barras largos se conviertan en 7,70219E+12.
 */
function csvAsText(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  if (!s) return ''
  return '"=""' + s.replace(/"/g, '') + '"""'
}

function downloadCsv(content: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = 'plantilla_productos_regx.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** Parser CSV simple: soporta comillas y detecta delimitador (';' o ','). */
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\ufeff/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let cell = '', row: string[] = [], inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++ } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      row.push(cell); cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(c => c.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some(c => c.trim() !== '')) rows.push(row)
  return rows
}

const normHeader = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const num = (s: string | undefined): number | undefined => {
  if (!s || !s.trim()) return undefined
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

/** Limpia una celda: quita el envoltorio de texto de Excel (="valor"). */
function cleanCell(s: string | undefined): string {
  let v = (s ?? '').trim()
  const m = v.match(/^="?(.*?)"?$/)
  if (m) v = m[1].trim()
  return v
}

/** Convierte filas CSV → BulkProductRow según encabezados flexibles. */
function csvToProducts(rawRows: string[][]): BulkProductRow[] {
  const rows = rawRows.map(r => r.map(cleanCell))
  const headers = (rows[0] ?? []).map(normHeader)
  const idx = (...names: string[]) => headers.findIndex(h => names.includes(h))
  const iName    = idx('nombre', 'producto', 'name')
  const iSku     = idx('sku', 'referencia', 'codigo')
  const iCat     = idx('categoria', 'category')
  const iBarcode = idx('codigodebarras', 'codigobarras', 'barcode')
  const iPrice   = idx('precio', 'price', 'precioventa')
  const iCost    = idx('costo', 'cost', 'preciocosto')
  const iStock   = idx('stock', 'cantidad', 'existencias')
  const iMin     = idx('stockminimo', 'minimo', 'minstock')
  const iMax     = idx('stockmaximo', 'maximo', 'maxstock')
  if (iName === -1) throw new Error('La plantilla debe tener una columna "nombre" (o "producto").')
  return rows.slice(1).map(r => ({
    name:     r[iName] ?? '',
    sku:      iSku     >= 0 ? r[iSku]?.trim()     || undefined : undefined,
    category: iCat     >= 0 ? r[iCat]?.trim()     || undefined : undefined,
    barcode:  iBarcode >= 0 ? r[iBarcode]?.trim() || undefined : undefined,
    price:    iPrice   >= 0 ? num(r[iPrice]) : undefined,
    cost:     iCost    >= 0 ? num(r[iCost])  : undefined,
    stock:    iStock   >= 0 ? num(r[iStock]) : undefined,
    minStock: iMin     >= 0 ? num(r[iMin])   : undefined,
    maxStock: iMax     >= 0 ? num(r[iMax])   : undefined,
  }))
}

// ── Celda de cantidad editable (vista tabla) ───────────────────
function QtyCell({ row, onSaved }: { row: InventoryRow; onSaved: () => void }) {
  const { tenant, branch, user } = useAuthStore()
  const prev = Number(row.quantity)
  const [val, setVal] = useState(String(prev))
  const [saving, setSaving] = useState(false)

  useEffect(() => { setVal(String(Number(row.quantity))) }, [row.quantity])

  const commit = async () => {
    const qty = Math.max(0, parseInt(val) || 0)
    if (qty === prev) { setVal(String(prev)); return }
    if (!tenant?.tenantId || !branch?.branchId || !user?.id) return
    setSaving(true)
    try {
      await updateStock(tenant.tenantId, branch.branchId, user.id, row.id, row.product_id, qty, prev, 'Edición rápida (tabla)')
      toast.success(`Stock actualizado a ${qty} uds.`)
      onSaved()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al actualizar el stock.')
      setVal(String(prev))
    } finally {
      setSaving(false)
    }
  }

  return (
    <input
      type="number"
      min={0}
      value={val}
      disabled={saving}
      onChange={e => setVal(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={cn(
        'w-20 rounded-lg border px-2 py-1.5 text-sm font-bold text-center outline-none transition-colors',
        'bg-white dark:bg-grafito-800 text-grafito-900 dark:text-white',
        Number(val) === 0
          ? 'border-red-400 dark:border-red-500/50'
          : 'border-grafito-200 dark:border-white/10 focus:border-brand-500',
        saving && 'opacity-50',
      )}
    />
  )
}

// ── Modal alta rápida de producto + stock ──────────────────────
interface QuickAddModalProps {
  categories: CategoryRow[]
  onClose: () => void
  onSaved: () => void
}
function QuickAddModal({ categories, onClose, onSaved }: QuickAddModalProps) {
  const { tenant, branch, user } = useAuthStore()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName]           = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [barcode, setBarcode]     = useState('')
  const [price, setPrice]         = useState('')
  const [qty, setQty]             = useState('')
  const [minStock, setMinStock]   = useState('')
  const [saving, setSaving]       = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('El nombre es obligatorio.'); return }
    if (!tenant?.tenantId || !branch?.branchId || !user?.id) return
    setSaving(true)
    try {
      await createProduct(tenant.tenantId, user.id, {
        name:         name.trim(),
        sku:          '',                              // se genera automático
        barcode:      barcode.trim() || undefined,
        category_id:  categoryId || undefined,
        price:        Number(price) || 0,
        min_stock:    Number(minStock) || 0,
        initialStock: Number(qty) || 0,
        branchId:     branch.branchId,
      })
      toast.success(`"${name.trim()}" creado con ${Number(qty) || 0} uds.`)
      onSaved()
      // Modo rápido: limpiar y seguir agregando
      setName(''); setBarcode(''); setPrice(''); setQty(''); setMinStock('')
      nameRef.current?.focus()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al crear el producto.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-xl bg-grafito-100 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 px-3 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors">
          <X className="h-4 w-4" />
        </button>

        <div>
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Agregar producto</h3>
          <p className="text-xs text-grafito-500 dark:text-grafito-400 mt-0.5">Se guarda y el formulario queda listo para el siguiente.</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-grafito-500 dark:text-grafito-400">Nombre *</label>
            <input ref={nameRef} autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Ej: Coca-Cola 350ml" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-grafito-500 dark:text-grafito-400">Categoría</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-grafito-500 dark:text-grafito-400">Código de barras</label>
              <input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Escanéalo aquí" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-grafito-500 dark:text-grafito-400">Precio</label>
              <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-grafito-500 dark:text-grafito-400">Stock inicial</label>
              <input type="number" min={0} value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-grafito-500 dark:text-grafito-400">Mínimo</label>
              <input type="number" min={0} value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={saving}
            className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-all disabled:opacity-50">
            Cerrar
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Guardando…' : 'Guardar y seguir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function InventoryPage() {
  const { tenant, branch, hasRole } = useAuthStore()
  const isOwner = hasRole('OWNER')
  // Categorías permitidas por la terminal asignada (null = todas)
  const { allowedCategories } = usePOSTerminal()
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [editing, setEditing]           = useState<InventoryRow | null>(null)
const [deletingRow, setDeletingRow]   = useState<InventoryRow | null>(null)
  const [deletingLoading, setDeletingLoading] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')

  // Vista tabla (edición rápida) vs tarjetas
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(
    () => (localStorage.getItem('regx-inv-view') as 'table' | 'cards') || 'table',
  )
  useEffect(() => { localStorage.setItem('regx-inv-view', viewMode) }, [viewMode])

  // Alta rápida + carga masiva
  const { user } = useAuthStore()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [cats, setCats] = useState<CategoryRow[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!tenant?.tenantId) return
    getCategories(tenant.tenantId).then(setCats).catch(() => setCats([]))
  }, [tenant?.tenantId])

  const [downloading, setDownloading] = useState(false)
  const handleDownloadTemplate = async () => {
    if (!tenant?.tenantId) return
    setDownloading(true)
    try {
      // Plantilla con TODO el catálogo actual: sirve de respaldo y de base
      // para agregar filas nuevas (las existentes se ignoran al re-subir).
      const prods = await getProducts(tenant.tenantId)
      const lines = prods.map(p => {
        const stock = (p.inventory ?? []).reduce((s, i) => s + Number(i.quantity), 0)
        const cat   = (p.categories as any)?.name ?? ''
        return [
          csvEscape(p.name),
          csvAsText(p.sku),          // texto forzado: evita notación científica en Excel
          csvEscape(cat),
          csvAsText(p.barcode),      // texto forzado: evita 7,70219E+12
          csvEscape(Number(p.price ?? 0)),
          csvEscape(p.cost_price ?? ''),
          csvEscape(stock),
          csvEscape(p.min_stock ?? 0),
          csvEscape(p.max_stock ?? ''),
        ].join(';')
      })
      const body = lines.length > 0 ? lines : [CSV_EXAMPLE]
      downloadCsv(CSV_HEADER + '\n' + body.join('\n') + '\n')
      toast.success(lines.length > 0
        ? `Plantilla descargada con ${lines.length} producto${lines.length !== 1 ? 's' : ''}. Agrega filas nuevas debajo y súbela.`
        : 'Plantilla descargada. Llénala y súbela con "Carga masiva".')
    } catch {
      toast.error('Error al generar la plantilla.')
    } finally {
      setDownloading(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''   // permitir re-subir el mismo archivo
    if (!file || !tenant?.tenantId || !branch?.branchId || !user?.id) return
    setImporting(true)
    try {
      const isExcel = /\.xlsx?$/i.test(file.name)
      let rawRows: string[][]
      if (isExcel) {
        // Excel: parsear con SheetJS (celdas como texto para no dañar códigos de barras)
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        rawRows = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][])
          .map(r => r.map(c => String(c ?? '')))
      } else {
        rawRows = parseCsv(await file.text())
      }
      const products = csvToProducts(rawRows)
      if (products.length === 0) { toast.error('El archivo no tiene filas de productos.'); return }
      const result = await bulkImportProducts(tenant.tenantId, user.id, branch.branchId, products)
      if (result.created > 0) toast.success(`${result.created} producto${result.created !== 1 ? 's' : ''} nuevo${result.created !== 1 ? 's' : ''} creado${result.created !== 1 ? 's' : ''}.`)
      if (result.updated > 0) toast.success(`${result.updated} producto${result.updated !== 1 ? 's' : ''} existente${result.updated !== 1 ? 's' : ''} actualizado${result.updated !== 1 ? 's' : ''} (solo los campos que cambiaron).`)
      if (result.skipped > 0) toast.info(`${result.skipped} fila${result.skipped !== 1 ? 's' : ''} sin cambios.`)
      if (result.created === 0 && result.updated === 0 && result.skipped === 0 && result.errors.length === 0) toast.info('No había nada para importar.')
      if (result.errors.length > 0) toast.error(`${result.errors.length} fila(s) con error: ${result.errors.slice(0, 3).map(er => `fila ${er.row} (${er.message})`).join(', ')}${result.errors.length > 3 ? '…' : ''}`, { duration: 8000 })
      load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al importar el archivo.')
    } finally {
      setImporting(false)
    }
  }

  const load = () => {
    if (!tenant?.tenantId || !branch?.branchId) return
    setLoading(true)
    getInventory(tenant.tenantId, branch.branchId)
      .then(setInventory)
      .catch(() => setInventory([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tenant?.tenantId, branch?.branchId])

  const handleDelete = async () => {
    if (!deletingRow || !tenant?.tenantId) return
    const p = deletingRow.products as any
    const productId = deletingRow.product_id
    const productName = p?.name ?? 'Producto'
    setDeletingLoading(true)
    try {
      await deleteProduct(tenant.tenantId, productId)
      toast.success(`"${productName}" eliminado del catálogo.`)
      setDeletingRow(null)
      load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al eliminar el producto.')
    } finally {
      setDeletingLoading(false)
    }
  }

  const filtered = inventory.filter(row => {
    const p = row.products as any
    // Categorías "sin stock" (platos preparados) no se listan en inventario
    if ((p?.categories as any)?.track_inventory === false) return false
    // Restricción por terminal: solo categorías permitidas (los sin categoría siguen visibles)
    if (allowedCategories && p?.category_id && !allowedCategories.includes(p.category_id)) return false
    if (categoryId && p?.category_id !== categoryId) return false
    if (!search) return true
    return p?.name?.toLowerCase().includes(search.toLowerCase()) ||
           p?.sku?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6 p-6">
      {/* Delete confirm modal */}
      {deletingRow && (
        <DeleteConfirmModal
          name={(deletingRow.products as any)?.name ?? ''}
          onConfirm={handleDelete}
          onCancel={() => setDeletingRow(null)}
          deleting={deletingLoading}
        />
      )}

      {/* Edit stock modal */}
      {editing && (
        <EditStockModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      {/* Alta rápida de producto */}
      {quickAddOpen && (
        <QuickAddModal
          categories={cats}
          onClose={() => setQuickAddOpen(false)}
          onSaved={load}
        />
      )}

{/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Inventario</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Control de stock de productos.</p>
      </div>

      {/* Tabla inventario */}
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-grafito-100 dark:border-white/5">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-grafito-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400"
            />
            {categoryId && (
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams)
                  newParams.delete('category')
                  setSearchParams(newParams)
                }}
                className="flex items-center gap-1 rounded-md bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-500 hover:bg-brand-500/20 transition-colors"
                title="Quitar filtro de categoría"
              >
                Categoría <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Insertar producto */}
            <button
              onClick={() => setQuickAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-600 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar producto
            </button>

            {/* Plantilla CSV */}
            <button
              onClick={handleDownloadTemplate}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-3.5 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all disabled:opacity-50"
              title="Descarga la plantilla CSV con tu catálogo actual"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Table2 className="h-3.5 w-3.5" />}
              Plantilla
            </button>

            {/* Carga masiva */}
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={handleImportFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-3.5 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all disabled:opacity-50"
              title="Sube la plantilla llena (CSV)"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
              {importing ? 'Importando…' : 'Carga masiva'}
            </button>

            {/* Vista tabla / tarjetas */}
            <button
              onClick={() => setViewMode(v => v === 'table' ? 'cards' : 'table')}
              className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-3.5 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all"
              title={viewMode === 'table' ? 'Ver tarjetas' : 'Ver tabla (edición rápida)'}
            >
              {viewMode === 'table' ? <LayoutGrid className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
              {viewMode === 'table' ? 'Tarjetas' : 'Tabla'}
            </button>

            <Link
              to="/products/categories?from=inventory"
              className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 px-3.5 py-2 text-xs text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-all"
            >
              <Tag className="h-3.5 w-3.5" />
              Categorías
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-grafito-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando inventario...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-grafito-400">
            <Package className="h-10 w-10 opacity-30" />
            <p className="text-sm">Sin productos en inventario.</p>
            <button onClick={() => setQuickAddOpen(true)} className="text-xs text-brand-400 hover:underline">Agregar producto</button>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grafito-100 dark:border-white/5 text-left text-xs uppercase tracking-wider text-grafito-400">
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 font-semibold text-right">Precio</th>
                  <th className="px-4 py-3 font-semibold text-center">Stock</th>
                  <th className="px-4 py-3 font-semibold text-center">Mínimo</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                {filtered.map(row => {
                  const p   = row.products as any
                  const cat = p?.categories as any
                  const qty = Number(row.quantity)
                  const min = Number(p?.min_stock ?? 0)
                  const isLow = min > 0 && qty > 0 && qty <= min
                  return (
                    <tr key={row.id} className={cn(
                      'hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors',
                      qty === 0 && 'bg-red-50/50 dark:bg-red-500/5',
                      isLow && 'bg-yellow-50/50 dark:bg-yellow-500/5',
                    )}>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-grafito-900 dark:text-white line-clamp-1">{p?.name ?? '—'}</p>
                        <p className="font-mono text-[11px] text-grafito-400">{p?.sku ?? ''}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {cat?.name ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-grafito-600 dark:text-grafito-300">
                            <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                            {cat.name}
                          </span>
                        ) : <span className="text-xs text-grafito-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-brand-500">
                        ${Number(p?.price ?? 0).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <QtyCell row={row} onSaved={load} />
                      </td>
                      <td className="px-4 py-2.5 text-center text-grafito-500 dark:text-grafito-400">
                        {min > 0 ? min : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/products/${row.product_id}/edit`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-grafito-50 dark:bg-white/5 text-grafito-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                            title="Editar producto"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          {isOwner && (
                            <button
                              onClick={() => setDeletingRow(row)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-grafito-50 dark:bg-white/5 text-grafito-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              title="Eliminar producto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
            {filtered.map((row) => {
              const p   = row.products as any
              const cat = p?.categories as any
              const qty = Number(row.quantity)
              const min = Number(p?.min_stock ?? 0)
              const isLow  = min > 0 && qty > 0 && qty <= min
              const isEmpty = qty === 0
              return (
                <div
                  key={row.id}
                  className={cn(
                    'group flex flex-col rounded-2xl bg-white dark:bg-grafito-900/80 border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300',
                    isEmpty ? 'border-red-300 dark:border-red-500/30' :
                    isLow   ? 'border-yellow-300 dark:border-yellow-500/30' :
                              'border-grafito-200 dark:border-white/5 hover:border-brand-500/30 hover:shadow-brand-500/5'
                  )}
                >
                  {/* Imagen & Badges */}
                  <div className="h-44 bg-white dark:bg-grafito-800/50 flex items-center justify-center relative overflow-hidden">
                    {p?.image_url ? (
                      <img src={p.image_url} alt={p?.name ?? 'Producto'} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <Package className="h-10 w-10 text-grafito-300 dark:text-grafito-600" />
                    )}

                    {/* Category Badge */}
                    {cat?.name && (
                      <span className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 dark:bg-grafito-900/95 backdrop-blur-sm text-[10px] font-bold shadow-sm border border-black/5 dark:border-white/10">
                        <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                        <span className="text-grafito-700 dark:text-grafito-200">{cat.name}</span>
                      </span>
                    )}

                    {/* Stock Badge */}
                    <span className={cn(
                      'absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-sm border',
                      isEmpty ? 'bg-red-500/95 text-white border-red-600/20' :
                      isLow   ? 'bg-yellow-400/95 text-yellow-900 border-yellow-500/20' :
                                'bg-white/95 dark:bg-grafito-900/95 text-grafito-700 dark:text-grafito-200 border-black/5 dark:border-white/10'
                    )}>
                      {qty} uds
                    </span>
                  </div>

                  {/* Info & Acciones */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-base text-grafito-900 dark:text-white line-clamp-1" title={p?.name ?? ''}>{p?.name ?? '—'}</h3>
                    <p className="font-mono text-xs text-grafito-500 dark:text-grafito-400 mt-1">{p?.sku ?? '—'}</p>

                    <div className="mt-4 pt-4 border-t border-grafito-100 dark:border-white/5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-lg font-black text-brand-500 block leading-tight">${Number(p?.price ?? 0).toLocaleString('es-CO')}</span>
                        {min > 0 && <span className="text-xs text-grafito-400">Mínimo: {min} uds</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setEditing(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-grafito-50 dark:bg-white/5 text-grafito-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                          title="Ajustar stock"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
{isOwner && (
                          <button
                            onClick={() => setDeletingRow(row)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-grafito-50 dark:bg-white/5 text-grafito-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
