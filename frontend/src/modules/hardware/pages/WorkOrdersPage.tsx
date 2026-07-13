import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Wrench, Plus, Loader2, X, Trash2 } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getWorkOrders, createWorkOrder, updateWorkOrderStatus, invoiceWorkOrder, getCustomers, getProducts,
  type WorkOrderRow, type WorkOrderStatus, type WorkOrderPriority, type WorkOrderItemInput,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

const STATUS: Record<WorkOrderStatus, { label: string; cls: string }> = {
  OPEN:        { label: 'Abierta',     cls: 'bg-grafito-200 dark:bg-white/10 text-grafito-500' },
  IN_PROGRESS: { label: 'En proceso',  cls: 'bg-blue-500/10 text-blue-500' },
  DONE:        { label: 'Terminada',   cls: 'bg-amber-400/10 text-amber-600 dark:text-amber-400' },
  DELIVERED:   { label: 'Entregada',   cls: 'bg-emerald-500/10 text-emerald-500' },
  CANCELLED:   { label: 'Cancelada',   cls: 'bg-red-500/10 text-red-500' },
}
const STATUSES = Object.keys(STATUS) as WorkOrderStatus[]
const PRIORITY: Record<WorkOrderPriority, { label: string; cls: string }> = {
  LOW:    { label: 'Baja',   cls: 'text-grafito-400' },
  NORMAL: { label: 'Normal', cls: 'text-blue-500' },
  HIGH:   { label: 'Alta',   cls: 'text-red-500' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

type Draft = WorkOrderItemInput & { key: number }

function CreateModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [priority, setPriority] = useState<WorkOrderPriority>('NORMAL')
  const [due, setDue] = useState('')
  const [items, setItems] = useState<Draft[]>([{ key: 1, kind: 'LABOR', description: '', quantity: 1, unit_price: 0, product_id: null }])

  const { data: customers = [] } = useQuery({ queryKey: ['customers', tenantId], queryFn: () => getCustomers(tenantId), enabled: !!tenantId })
  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId), enabled: !!tenantId })

  const setItem = (key: number, patch: Partial<Draft>) => setItems((a) => a.map((i) => i.key === key ? { ...i, ...patch } : i))
  const addRow = () => setItems((a) => [...a, { key: Date.now(), kind: 'PART', description: '', quantity: 1, unit_price: 0, product_id: null }])
  const delRow = (key: number) => setItems((a) => a.filter((i) => i.key !== key))
  const onPick = (key: number, pid: string) => { const p = products.find((x) => x.id === pid); setItem(key, { product_id: pid || null, description: p?.name ?? '', unit_price: p ? Number(p.price ?? 0) : 0, kind: 'PART' }) }
  const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)

  const save = useMutation({
    mutationFn: () => createWorkOrder(
      tenantId,
      { title: title.trim(), description: desc.trim() || null, customer_id: customerId || null, priority, due_date: due || null },
      items.filter((i) => i.description.trim()).map(({ kind, description, quantity, unit_price, product_id }) => ({ kind, description: description.trim(), quantity: Number(quantity), unit_price: Number(unit_price), product_id })),
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-orders', tenantId] }); toast.success('Orden creada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Nueva orden de trabajo</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Título / servicio"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reparación de taladro" className={inputCls} /></Field></div>
          <Field label="Cliente">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
              <option value="">— Sin cliente —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </Field>
          <Field label="Prioridad">
            <select value={priority} onChange={(e) => setPriority(e.target.value as WorkOrderPriority)} className={inputCls}>
              {(Object.keys(PRIORITY) as WorkOrderPriority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
            </select>
          </Field>
          <Field label="Fecha límite"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></Field>
          <div className="sm:col-span-2"><Field label="Descripción del trabajo"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className={inputCls} /></Field></div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-grafito-400">Repuestos y mano de obra</p>
            <button onClick={addRow} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600"><Plus className="h-3.5 w-3.5" /> Agregar</button>
          </div>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.key} className="grid grid-cols-1 sm:grid-cols-[0.8fr_1.6fr_1.4fr_0.6fr_0.8fr_auto] gap-2 items-center">
                <select value={it.kind} onChange={(e) => setItem(it.key, { kind: e.target.value as 'PART' | 'LABOR' })} className={inputCls}>
                  <option value="LABOR">Mano obra</option>
                  <option value="PART">Repuesto</option>
                </select>
                <select value={it.product_id ?? ''} onChange={(e) => onPick(it.key, e.target.value)} className={inputCls}>
                  <option value="">Producto / libre…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={it.description} onChange={(e) => setItem(it.key, { description: e.target.value })} placeholder="Descripción" className={inputCls} />
                <input type="number" min={0} value={it.quantity} onChange={(e) => setItem(it.key, { quantity: Number(e.target.value) })} placeholder="Cant." className={inputCls} />
                <input type="number" min={0} value={it.unit_price} onChange={(e) => setItem(it.key, { unit_price: Number(e.target.value) })} placeholder="Precio" className={inputCls} />
                <button onClick={() => delRow(it.key)} className="rounded-lg p-2 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-3 text-sm"><span className="text-grafito-500">Total:&nbsp;</span><span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(total, 'COP')}</span></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!title.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WorkOrdersPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [create, setCreate] = useState(false)

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['work-orders', tenantId], queryFn: () => getWorkOrders(tenantId!), enabled: !!tenantId })
  const openCount = useMemo(() => orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length, [orders])

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkOrderStatus }) => updateWorkOrderStatus(tenantId!, id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-orders', tenantId] }); toast.success('Estado actualizado') },
  })

  // Facturar: crea la venta PENDING en el POS y marca DELIVERED (migración 043)
  const invoice = useMutation({
    mutationFn: (id: string) => invoiceWorkOrder(tenantId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders', tenantId] })
      toast.success('Orden facturada: la venta quedó pendiente de cobro en el POS')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo facturar'),
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Wrench className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Órdenes de Trabajo</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Trabajos, servicios técnicos y reparaciones.</p>
          </div>
        </div>
        <button onClick={() => setCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nueva orden
        </button>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 max-w-xs"><p className="text-xs text-grafito-500">Órdenes activas</p><p className="text-2xl font-black text-grafito-900 dark:text-white mt-1">{openCount}</p></div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Wrench className="h-8 w-8" /><p className="text-sm">Aún no hay órdenes de trabajo.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[880px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Trabajo</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Prioridad</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Estado</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono font-semibold text-grafito-900 dark:text-white">{o.code}</td>
                  <td className="px-4 py-3 text-grafito-800 dark:text-grafito-100">{o.title}</td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{o.customers?.full_name ?? '—'}</td>
                  <td className="px-4 py-3"><span className={cn('text-xs font-semibold', PRIORITY[o.priority].cls)}>{PRIORITY[o.priority].label}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-grafito-900 dark:text-white whitespace-nowrap">{formatCurrency(Number(o.total), o.currency)}</td>
                  <td className="px-4 py-3">
                    {o.status === 'DELIVERED' || o.status === 'CANCELLED' ? (
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', STATUS[o.status].cls)}>{STATUS[o.status].label}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select value={o.status} onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value as WorkOrderStatus })} className="text-xs px-2 py-1 rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 text-grafito-700 dark:text-grafito-200">
                          {STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                        </select>
                        {o.status === 'DONE' && (
                          <button onClick={() => invoice.mutate(o.id)} disabled={invoice.isPending} className="rounded-lg px-2.5 py-1 text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 whitespace-nowrap">Facturar</button>
                        )}
                      </div>
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
