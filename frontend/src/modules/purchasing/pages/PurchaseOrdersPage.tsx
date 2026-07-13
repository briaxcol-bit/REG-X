import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ClipboardList, Plus, Loader2, X, Trash2 } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getPurchaseOrders, createPurchaseOrder, updatePurchaseOrderStatus, receivePurchaseOrder,
  getSuppliers, getProducts,
  type PurchaseOrderRow, type PurchaseOrderStatus, type PurchaseOrderItemInput,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

const STATUS: Record<PurchaseOrderStatus, { label: string; cls: string }> = {
  DRAFT:     { label: 'Borrador',  cls: 'bg-grafito-200 dark:bg-white/10 text-grafito-500' },
  SENT:      { label: 'Enviada',   cls: 'bg-blue-500/10 text-blue-500' },
  RECEIVED:  { label: 'Recibida',  cls: 'bg-emerald-500/10 text-emerald-500' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-red-500/10 text-red-500' },
}
const STATUSES = Object.keys(STATUS) as PurchaseOrderStatus[]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

type Draft = PurchaseOrderItemInput & { key: number }

function CreateModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [expected, setExpected] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Draft[]>([{ key: 1, description: '', quantity: 1, unit_cost: 0, product_id: null }])

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers', tenantId], queryFn: () => getSuppliers(tenantId), enabled: !!tenantId })
  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId), enabled: !!tenantId })

  const setItem = (key: number, patch: Partial<Draft>) => setItems((arr) => arr.map((i) => i.key === key ? { ...i, ...patch } : i))
  const addRow = () => setItems((arr) => [...arr, { key: Date.now(), description: '', quantity: 1, unit_cost: 0, product_id: null }])
  const delRow = (key: number) => setItems((arr) => arr.filter((i) => i.key !== key))
  const onPickProduct = (key: number, pid: string) => {
    const p = products.find((x) => x.id === pid)
    setItem(key, { product_id: pid || null, description: p?.name ?? '', unit_cost: p ? Number(p.cost_price ?? 0) : 0 })
  }
  const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0)
  const valid = items.some((i) => i.description.trim() && Number(i.quantity) > 0)

  const save = useMutation({
    mutationFn: () => createPurchaseOrder(
      tenantId,
      { supplier_id: supplierId || null, order_date: orderDate, expected_date: expected || null, notes: notes.trim() || null },
      items.filter((i) => i.description.trim()).map(({ description, quantity, unit_cost, product_id }) => ({ description: description.trim(), quantity: Number(quantity), unit_cost: Number(unit_cost), product_id })),
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders', tenantId] }); toast.success('Orden creada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Nueva orden de compra</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Proveedor">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Sin proveedor —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Fecha"><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={inputCls} /></Field>
          <Field label="Fecha esperada (opcional)"><input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={inputCls} /></Field>
          <Field label="Notas (opcional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
        </div>

        {/* Ítems */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-grafito-400">Productos a pedir</p>
            <button onClick={addRow} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600"><Plus className="h-3.5 w-3.5" /> Agregar</button>
          </div>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.key} className="grid grid-cols-1 sm:grid-cols-[2fr_1.4fr_0.7fr_0.9fr_auto] gap-2 items-center">
                <select value={it.product_id ?? ''} onChange={(e) => onPickProduct(it.key, e.target.value)} className={inputCls}>
                  <option value="">Producto / libre…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={it.description} onChange={(e) => setItem(it.key, { description: e.target.value })} placeholder="Descripción" className={inputCls} />
                <input type="number" min={0} value={it.quantity} onChange={(e) => setItem(it.key, { quantity: Number(e.target.value) })} placeholder="Cant." className={inputCls} />
                <input type="number" min={0} value={it.unit_cost} onChange={(e) => setItem(it.key, { unit_cost: Number(e.target.value) })} placeholder="Costo" className={inputCls} />
                <button onClick={() => delRow(it.key)} className="rounded-lg p-2 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-3 text-sm">
            <span className="text-grafito-500">Total:&nbsp;</span><span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(total, 'COP')}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!valid || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear orden
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PurchaseOrdersPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [create, setCreate] = useState(false)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', tenantId],
    queryFn: () => getPurchaseOrders(tenantId!),
    enabled: !!tenantId,
  })

  const metrics = useMemo(() => ({
    open: orders.filter((o) => o.status === 'DRAFT' || o.status === 'SENT').length,
    pending: orders.filter((o) => o.status === 'SENT').reduce((s, o) => s + Number(o.total), 0),
  }), [orders])

  const setStatus = useMutation({
    // RECIBIDA no es un cambio de texto: entra stock, se crea la cuenta por
    // pagar y los lotes vía RPC transaccional (migración 040).
    mutationFn: ({ id, status }: { id: string; status: PurchaseOrderStatus }) =>
      status === 'RECEIVED'
        ? receivePurchaseOrder(tenantId!, id)
        : updatePurchaseOrderStatus(tenantId!, id, status),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', tenantId] })
      if (vars.status === 'RECEIVED') {
        qc.invalidateQueries({ queryKey: ['inventory'] })
        qc.invalidateQueries({ queryKey: ['payables'] })
        toast.success('Orden recibida: stock actualizado y cuenta por pagar creada')
      } else {
        toast.success('Estado actualizado')
      }
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo actualizar'),
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><ClipboardList className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Órdenes de Compra</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Pedidos a proveedores con seguimiento.</p>
          </div>
        </div>
        <button onClick={() => setCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nueva orden
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4"><p className="text-xs text-grafito-500">Órdenes abiertas</p><p className="text-2xl font-black text-grafito-900 dark:text-white mt-1">{metrics.open}</p></div>
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4"><p className="text-xs text-grafito-500">Enviado sin recibir</p><p className="text-2xl font-black text-brand-500 mt-1">{formatCurrency(metrics.pending, 'COP')}</p></div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><ClipboardList className="h-8 w-8" /><p className="text-sm">Aún no hay órdenes de compra.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[760px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Estado</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono font-semibold text-grafito-900 dark:text-white">{o.code}</td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{o.suppliers?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300 whitespace-nowrap">{new Date(o.order_date + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-right font-semibold text-grafito-900 dark:text-white whitespace-nowrap">{formatCurrency(Number(o.total), o.currency)}</td>
                  <td className="px-4 py-3">
                    {o.status === 'RECEIVED' || o.status === 'CANCELLED' ? (
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', STATUS[o.status].cls)}>{STATUS[o.status].label}</span>
                    ) : (
                      <select
                        value={o.status}
                        onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value as PurchaseOrderStatus })}
                        className="text-xs px-2 py-1 rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 text-grafito-700 dark:text-grafito-200"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {create && tenantId && <CreateModal tenantId={tenantId} onClose={() => setCreate(false)} />}
    </div>
  )
}
