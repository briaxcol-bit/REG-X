import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Boxes, Plus, Trash2, Loader2, X, Search } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getBatches, createBatch, deleteBatch, getProducts, getSuppliers,
  type BatchRow, type BatchInput,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function daysTo(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
}
function expiryBadge(date: string | null) {
  const d = daysTo(date)
  if (d === null) return { label: 'Sin fecha', cls: 'bg-grafito-200 dark:bg-white/10 text-grafito-500' }
  if (d < 0) return { label: `Vencido`, cls: 'bg-red-500/10 text-red-500' }
  if (d <= 30) return { label: `${d}d`, cls: 'bg-amber-400/10 text-amber-600 dark:text-amber-400' }
  return { label: `${d}d`, cls: 'bg-emerald-500/10 text-emerald-500' }
}

function BatchModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [productId, setProductId] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [qty, setQty] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [cost, setCost] = useState('')
  const [received, setReceived] = useState(new Date().toISOString().slice(0, 10))

  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId), enabled: !!tenantId })
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers', tenantId], queryFn: () => getSuppliers(tenantId), enabled: !!tenantId })

  const save = useMutation({
    mutationFn: () => {
      const input: BatchInput = {
        product_id: productId, batch_number: batchNumber.trim(), expiry_date: expiry || null,
        quantity: Number(qty) || 0, supplier_id: supplierId || null,
        cost: cost ? Number(cost) : null, received_at: received,
      }
      return createBatch(tenantId, input)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['batches', tenantId] }); toast.success('Lote registrado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Registrar lote</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Producto">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
              <option value="">Selecciona…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field></div>
          <Field label="N° de lote"><input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="L-2026-001" className={inputCls} /></Field>
          <Field label="Vencimiento"><input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputCls} /></Field>
          <Field label="Cantidad"><input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} /></Field>
          <Field label="Costo unitario (opcional)"><input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} /></Field>
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
          <button onClick={() => save.mutate()} disabled={!productId || !batchNumber.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BatchTrackingPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [add, setAdd] = useState(false)
  const [search, setSearch] = useState('')

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['batches', tenantId],
    queryFn: () => getBatches(tenantId!),
    enabled: !!tenantId,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return batches
    return batches.filter((b) => b.products?.name?.toLowerCase().includes(q) || b.batch_number.toLowerCase().includes(q))
  }, [batches, search])

  const remove = useMutation({ mutationFn: (id: string) => deleteBatch(tenantId!, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['batches', tenantId] }); toast.success('Lote eliminado') } })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Boxes className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Trazabilidad por Lotes</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Seguimiento de lotes: proveedor → vencimiento → venta.</p>
          </div>
        </div>
        <button onClick={() => setAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Registrar lote
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-grafito-900/60 border border-grafito-200 dark:border-white/5 px-3 py-2.5 max-w-md">
        <Search className="h-4 w-4 text-grafito-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por producto o lote…" className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400" />
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Boxes className="h-8 w-8" /><p className="text-sm">Aún no hay lotes registrados.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[860px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Producto</th><th className="px-4 py-3">Lote</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3 text-right">Cant.</th><th className="px-4 py-3">Vence</th><th className="px-4 py-3 text-right">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {filtered.map((b) => {
                const badge = expiryBadge(b.expiry_date)
                return (
                  <tr key={b.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-grafito-900 dark:text-white">{b.products?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-grafito-600 dark:text-grafito-300">{b.batch_number}</td>
                    <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{b.suppliers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-grafito-700 dark:text-grafito-200">{Number(b.quantity)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-grafito-500 dark:text-grafito-300 text-xs">{b.expiry_date ? new Date(b.expiry_date + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', badge.cls)}>{badge.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right"><button onClick={() => { if (confirm('¿Eliminar este lote?')) remove.mutate(b.id) }} className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {add && tenantId && <BatchModal tenantId={tenantId} onClose={() => setAdd(false)} />}
    </div>
  )
}
