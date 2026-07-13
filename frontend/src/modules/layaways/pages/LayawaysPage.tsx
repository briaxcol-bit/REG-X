import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PiggyBank, Plus, Loader2, X, Trash2, CircleDollarSign, Ban } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getLayaways, createLayaway, addLayawayPayment, updateLayawayStatus, completeLayaway,
  getCustomers, getProducts,
  type LayawayRow, type LayawayStatus, type LayawayItemInput,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

const STATUS: Record<LayawayStatus, { label: string; cls: string }> = {
  OPEN:      { label: 'Abierto',    cls: 'bg-blue-500/10 text-blue-500' },
  COMPLETED: { label: 'Pagado',     cls: 'bg-emerald-500/10 text-emerald-500' },
  CANCELLED: { label: 'Cancelado',  cls: 'bg-red-500/10 text-red-500' },
}
const METHODS = [
  { value: 'CASH', label: 'Efectivo' }, { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CARD', label: 'Tarjeta' }, { value: 'OTHER', label: 'Otro' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

type Draft = LayawayItemInput & { key: number }

function CreateModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [customerId, setCustomerId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [initial, setInitial] = useState('')
  const [items, setItems] = useState<Draft[]>([{ key: 1, description: '', quantity: 1, unit_price: 0, product_id: null }])

  const { data: customers = [] } = useQuery({ queryKey: ['customers', tenantId], queryFn: () => getCustomers(tenantId), enabled: !!tenantId })
  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId), enabled: !!tenantId })

  const setItem = (key: number, patch: Partial<Draft>) => setItems((arr) => arr.map((i) => i.key === key ? { ...i, ...patch } : i))
  const addRow = () => setItems((arr) => [...arr, { key: Date.now(), description: '', quantity: 1, unit_price: 0, product_id: null }])
  const delRow = (key: number) => setItems((arr) => arr.filter((i) => i.key !== key))
  const onPickProduct = (key: number, pid: string) => {
    const p = products.find((x) => x.id === pid)
    setItem(key, { product_id: pid || null, description: p?.name ?? '', unit_price: p ? Number(p.price ?? 0) : 0 })
  }
  const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0)
  const valid = items.some((i) => i.description.trim() && Number(i.quantity) > 0) && total > 0

  const save = useMutation({
    mutationFn: () => createLayaway(
      tenantId,
      { customer_id: customerId || null, due_date: dueDate || null, notes: notes.trim() || null },
      items.filter((i) => i.description.trim()).map(({ description, quantity, unit_price, product_id }) => ({ description: description.trim(), quantity: Number(quantity), unit_price: Number(unit_price), product_id })),
      Number(initial) > 0 ? { amount: Number(initial), method: 'CASH' } : undefined,
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['layaways', tenantId] }); toast.success('Apartado creado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Nuevo apartado</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
              <option value="">— Sin cliente —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </Field>
          <Field label="Fecha límite (opcional)"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></Field>
          <div className="sm:col-span-2"><Field label="Notas (opcional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field></div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-grafito-400">Productos</p>
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
                <input type="number" min={0} value={it.unit_price} onChange={(e) => setItem(it.key, { unit_price: Number(e.target.value) })} placeholder="Precio" className={inputCls} />
                <button onClick={() => delRow(it.key)} className="rounded-lg p-2 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-4 items-end">
          <Field label="Abono inicial (opcional)"><input type="number" min={0} value={initial} onChange={(e) => setInitial(e.target.value)} className={inputCls} /></Field>
          <div className="flex justify-end text-sm"><span className="text-grafito-500">Total:&nbsp;</span><span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(total, 'COP')}</span></div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!valid || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear apartado
          </button>
        </div>
      </div>
    </div>
  )
}

function PayModal({ tenantId, layaway, onClose }: { tenantId: string; layaway: LayawayRow; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const balance = Number(layaway.total) - Number(layaway.paid)
  const pay = useMutation({
    mutationFn: () => addLayawayPayment(tenantId, layaway.id, { amount: Number(amount) || 0, method }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['layaways', tenantId] }); toast.success('Abono registrado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Abonar a {layaway.code}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-grafito-500 mb-4">Saldo pendiente: <span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(balance, layaway.currency)}</span></p>
        <div className="space-y-4">
          <Field label="Monto del abono"><input type="number" min={0} max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>
          <Field label="Método"><select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => pay.mutate()} disabled={!amount || Number(amount) <= 0 || pay.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />} Abonar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LayawaysPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [create, setCreate] = useState(false)
  const [pay, setPay] = useState<LayawayRow | null>(null)

  const { data: layaways = [], isLoading } = useQuery({
    queryKey: ['layaways', tenantId],
    queryFn: () => getLayaways(tenantId!),
    enabled: !!tenantId,
  })

  const metrics = useMemo(() => {
    const open = layaways.filter((l) => l.status === 'OPEN')
    return { open: open.length, outstanding: open.reduce((s, l) => s + (Number(l.total) - Number(l.paid)), 0) }
  }, [layaways])

  const cancel = useMutation({
    mutationFn: (id: string) => updateLayawayStatus(tenantId!, id, 'CANCELLED'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['layaways', tenantId] }); toast.success('Apartado cancelado') },
  })

  // Entrega real: crea la venta COMPLETED y descuenta stock (migración 043)
  const deliver = useMutation({
    mutationFn: (id: string) => completeLayaway(tenantId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layaways', tenantId] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Apartado entregado: venta registrada y stock descontado')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo entregar'),
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><PiggyBank className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Apartados</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Ventas con abonos parciales.</p>
          </div>
        </div>
        <button onClick={() => setCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nuevo apartado
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4"><p className="text-xs text-grafito-500">Apartados abiertos</p><p className="text-2xl font-black text-grafito-900 dark:text-white mt-1">{metrics.open}</p></div>
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4"><p className="text-xs text-grafito-500">Por cobrar</p><p className="text-2xl font-black text-brand-500 mt-1">{formatCurrency(metrics.outstanding, 'COP')}</p></div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : layaways.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><PiggyBank className="h-8 w-8" /><p className="text-sm">Aún no hay apartados.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[820px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Abonado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {layaways.map((l) => {
                const balance = Number(l.total) - Number(l.paid)
                return (
                  <tr key={l.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-mono font-semibold text-grafito-900 dark:text-white">{l.code}</td>
                    <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{l.customers?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-grafito-700 dark:text-grafito-200 whitespace-nowrap">{formatCurrency(Number(l.total), l.currency)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatCurrency(Number(l.paid), l.currency)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-grafito-900 dark:text-white whitespace-nowrap">{formatCurrency(balance, l.currency)}</td>
                    <td className="px-4 py-3"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', STATUS[l.status].cls)}>{STATUS[l.status].label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {l.status === 'OPEN' && balance <= 0 && (
                          <button onClick={() => deliver.mutate(l.id)} disabled={deliver.isPending} className="rounded-lg px-2.5 py-1 text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 whitespace-nowrap">Entregar y facturar</button>
                        )}
                        <button disabled={l.status !== 'OPEN'} onClick={() => setPay(l)} title="Abonar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10 disabled:opacity-30"><CircleDollarSign className="h-4 w-4" /></button>
                        <button disabled={l.status !== 'OPEN'} onClick={() => { if (confirm(`¿Cancelar el apartado ${l.code}?`)) cancel.mutate(l.id) }} title="Cancelar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30"><Ban className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {create && tenantId && <CreateModal tenantId={tenantId} onClose={() => setCreate(false)} />}
      {pay && tenantId && <PayModal tenantId={tenantId} layaway={pay} onClose={() => setPay(null)} />}
    </div>
  )
}
