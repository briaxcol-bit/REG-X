import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ScanBarcode, Plus, Loader2, X, Trash2, Search } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import {
  getSerials, createSerial, updateSerialStatus, deleteSerial, getProducts, getSuppliers,
  type SerialRow, type SerialStatus,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

const STATUS: Record<SerialStatus, { label: string; cls: string }> = {
  IN_STOCK:  { label: 'En stock',  cls: 'bg-emerald-500/10 text-emerald-500' },
  SOLD:      { label: 'Vendido',   cls: 'bg-blue-500/10 text-blue-500' },
  RETURNED:  { label: 'Devuelto',  cls: 'bg-amber-400/10 text-amber-600 dark:text-amber-400' },
  DEFECTIVE: { label: 'Defectuoso',cls: 'bg-red-500/10 text-red-500' },
}
const STATUSES = Object.keys(STATUS) as SerialStatus[]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function AddModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [productId, setProductId] = useState('')
  const [serial, setSerial] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [received, setReceived] = useState(new Date().toISOString().slice(0, 10))

  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId), enabled: !!tenantId })
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers', tenantId], queryFn: () => getSuppliers(tenantId), enabled: !!tenantId })

  const save = useMutation({
    mutationFn: () => createSerial(tenantId, { product_id: productId, serial_number: serial.trim(), supplier_id: supplierId || null, received_at: received }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['serials', tenantId] }); toast.success('Serial registrado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar (¿serial duplicado?)'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Registrar serial</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Producto">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
              <option value="">Selecciona…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Número de serie"><input value={serial} onChange={(e) => setSerial(e.target.value)} className={cn(inputCls, 'font-mono')} /></Field>
          <Field label="Proveedor (opcional)">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Ninguno —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Fecha de ingreso"><input type="date" value={received} onChange={(e) => setReceived(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!productId || !serial.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SerialTrackingPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [add, setAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<SerialStatus | ''>('')

  const filters = { search: search || undefined, status: status || undefined }
  const { data: serials = [], isLoading } = useQuery({
    queryKey: ['serials', tenantId, filters],
    queryFn: () => getSerials(tenantId!, filters),
    enabled: !!tenantId,
  })

  const setStatusM = useMutation({
    mutationFn: ({ id, s }: { id: string; s: SerialStatus }) => updateSerialStatus(tenantId!, id, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['serials', tenantId] }); toast.success('Estado actualizado') },
  })
  const del = useMutation({ mutationFn: (id: string) => deleteSerial(tenantId!, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['serials', tenantId] }); toast.success('Serial eliminado') } })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><ScanBarcode className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Seguimiento por Serial</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Rastrea productos por número de serie.</p>
          </div>
        </div>
        <button onClick={() => setAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Registrar serial
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-grafito-900/60 border border-grafito-200 dark:border-white/5 px-3 py-2.5 flex-1 min-w-[200px] max-w-md">
          <Search className="h-4 w-4 text-grafito-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número de serie…" className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as SerialStatus | '')} className="text-sm px-3 py-2.5 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 text-grafito-700 dark:text-grafito-200">
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : serials.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><ScanBarcode className="h-8 w-8" /><p className="text-sm">Sin seriales registrados.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[820px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Serial</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {serials.map((s) => (
                <tr key={s.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono font-semibold text-grafito-900 dark:text-white">{s.serial_number}</td>
                  <td className="px-4 py-3 text-grafito-700 dark:text-grafito-200">{s.products?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{s.suppliers?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select value={s.status} onChange={(e) => setStatusM.mutate({ id: s.id, s: e.target.value as SerialStatus })} className={cn('text-xs px-2 py-1 rounded-lg border-0 font-bold', STATUS[s.status].cls)}>
                      {STATUSES.map((st) => <option key={st} value={st}>{STATUS[st].label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right"><button onClick={() => { if (confirm('¿Eliminar este serial?')) del.mutate(s.id) }} className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {add && tenantId && <AddModal tenantId={tenantId} onClose={() => setAdd(false)} />}
    </div>
  )
}
