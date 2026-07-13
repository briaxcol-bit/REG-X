import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Receipt, Plus, Loader2, X, CircleDollarSign } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import { getPayables, createPayable, addPayablePayment, getSuppliers, type PayableRow } from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'
const METHODS = [{ value: 'CASH', label: 'Efectivo' }, { value: 'TRANSFER', label: 'Transferencia' }, { value: 'CARD', label: 'Tarjeta' }, { value: 'OTHER', label: 'Otro' }]
const STATUS = { OPEN: { label: 'Pendiente', cls: 'bg-amber-400/10 text-amber-600 dark:text-amber-400' }, PAID: { label: 'Pagada', cls: 'bg-emerald-500/10 text-emerald-500' }, CANCELLED: { label: 'Anulada', cls: 'bg-red-500/10 text-red-500' } }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function CreateModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState('')
  const [desc, setDesc] = useState('')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')
  const [due, setDue] = useState('')
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers', tenantId], queryFn: () => getSuppliers(tenantId), enabled: !!tenantId })

  const save = useMutation({
    mutationFn: () => createPayable(tenantId, { supplier_id: supplierId || null, description: desc.trim() || null, reference: reference.trim() || null, amount: Number(amount) || 0, due_date: due || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payables', tenantId] }); toast.success('Cuenta creada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Nueva cuenta por pagar</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Proveedor">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Sin proveedor —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Descripción"><input value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto"><input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>
            <Field label="Vence"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Referencia (factura)"><input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!amount || Number(amount) <= 0 || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear
          </button>
        </div>
      </div>
    </div>
  )
}

function PayModal({ tenantId, row, onClose }: { tenantId: string; row: PayableRow; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const balance = Number(row.amount) - Number(row.paid)
  const pay = useMutation({
    mutationFn: () => addPayablePayment(tenantId, row.id, { amount: Number(amount) || 0, method }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payables', tenantId] }); toast.success('Pago registrado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Registrar pago</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-grafito-500 mb-4">Saldo: <span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(balance, row.currency)}</span></p>
        <div className="space-y-4">
          <Field label="Monto"><input type="number" min={0} max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>
          <Field label="Método"><select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => pay.mutate()} disabled={!amount || Number(amount) <= 0 || pay.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />} Pagar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PayablesPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const [create, setCreate] = useState(false)
  const [pay, setPay] = useState<PayableRow | null>(null)

  const { data: rows = [], isLoading } = useQuery({ queryKey: ['payables', tenantId], queryFn: () => getPayables(tenantId!), enabled: !!tenantId })
  const outstanding = useMemo(() => rows.filter((r) => r.status === 'OPEN').reduce((s, r) => s + (Number(r.amount) - Number(r.paid)), 0), [rows])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Receipt className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Cuentas por Pagar</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Deudas a proveedores y pagos.</p>
          </div>
        </div>
        <button onClick={() => setCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nueva cuenta
        </button>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 max-w-xs"><p className="text-xs text-grafito-500">Total por pagar</p><p className="text-2xl font-black text-red-500 mt-1">{formatCurrency(outstanding, 'COP')}</p></div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Receipt className="h-8 w-8" /><p className="text-sm">Sin cuentas por pagar.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[820px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3 text-right">Monto</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acción</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {rows.map((r) => {
                const balance = Number(r.amount) - Number(r.paid)
                return (
                  <tr key={r.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-grafito-900 dark:text-white">{r.suppliers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{r.description ?? '—'}{r.reference ? ` · #${r.reference}` : ''}</td>
                    <td className="px-4 py-3 text-right text-grafito-700 dark:text-grafito-200">{formatCurrency(Number(r.amount), r.currency)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-grafito-900 dark:text-white">{formatCurrency(balance, r.currency)}</td>
                    <td className="px-4 py-3"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', STATUS[r.status].cls)}>{STATUS[r.status].label}</span></td>
                    <td className="px-4 py-3 text-right">{r.status === 'OPEN' && <button onClick={() => setPay(r)} className="rounded-lg px-2.5 py-1 text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600">Pagar</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {create && tenantId && <CreateModal tenantId={tenantId} onClose={() => setCreate(false)} />}
      {pay && tenantId && <PayModal tenantId={tenantId} row={pay} onClose={() => setPay(null)} />}
    </div>
  )
}
