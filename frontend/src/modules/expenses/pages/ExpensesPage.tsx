import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Wallet, Plus, Pencil, Trash2, Loader2, X, TrendingDown,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import {
  getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary, getSuppliers,
  getActiveCashRegister,
  type ExpenseRow, type ExpenseInput, type ExpensePaymentMethod,
} from '@lib/db'

const CATEGORIES = [
  'Arriendo', 'Servicios públicos', 'Nómina', 'Insumos', 'Mercancía',
  'Transporte', 'Mantenimiento', 'Impuestos', 'Marketing', 'Comisiones', 'Otros',
]

const PAY_METHODS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otro' },
]

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

function money(v: number, currency = 'COP') {
  try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v) }
  catch { return `${currency} ${v.toLocaleString('es')}` }
}
const payLabel = (m: string) => PAY_METHODS.find((p) => p.value === m)?.label ?? m

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ExpenseModal({ tenantId, editing, onClose }: { tenantId: string; editing: ExpenseRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const branchId = useAuthStore((s) => s.branch?.branchId)
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', tenantId, 'active'],
    queryFn: () => getSuppliers(tenantId),
    enabled: !!tenantId,
  })

  // Caja abierta: los gastos en efectivo se vinculan a ella para el cierre del día
  const { data: activeRegister } = useQuery({
    queryKey: ['cash-register-active', tenantId, branchId],
    queryFn: () => getActiveCashRegister(tenantId, branchId!),
    enabled: !!tenantId && !!branchId,
    staleTime: 10_000,
  })

  const [category, setCategory] = useState(editing?.category ?? 'Otros')
  const [amount, setAmount]     = useState(editing ? String(editing.amount) : '')

  const amountDisplay = amount ? `$ ${Number(amount).toLocaleString('es-CO')}` : ''
  const [date, setDate]         = useState(editing?.expense_date ?? new Date().toISOString().slice(0, 10))
  const [method, setMethod]     = useState<ExpensePaymentMethod>(editing?.payment_method ?? 'CASH')
  const [supplierId, setSupplierId] = useState(editing?.supplier_id ?? '')
  const [reference, setReference]   = useState(editing?.reference ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')

  const save = useMutation({
    mutationFn: () => {
      const input: ExpenseInput = {
        category,
        amount: Number(amount) || 0,
        expense_date: date,
        payment_method: method,
        supplier_id: supplierId || null,
        reference: reference.trim() || null,
        description: description.trim() || null,
        branch_id: editing ? undefined : (branchId ?? null),
        // Efectivo con caja abierta → ligado a esa sesión para el cierre
        cash_register_id: editing
          ? undefined
          : (method === 'CASH' && activeRegister ? activeRegister.id : null),
      }
      return editing ? updateExpense(tenantId, editing.id, input) : createExpense(tenantId, input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', tenantId] })
      qc.invalidateQueries({ queryKey: ['expense-summary', tenantId] })
      toast.success(editing ? 'Gasto actualizado' : 'Gasto registrado')
      onClose()
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar gasto' : 'Registrar gasto'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Monto">
            <input
              type="text"
              inputMode="numeric"
              value={amountDisplay}
              placeholder="$ 0"
              className={inputCls}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '')
                setAmount(raw)
              }}
            />
          </Field>
          <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
          <Field label="Método de pago">
            <select value={method} onChange={(e) => setMethod(e.target.value as ExpensePaymentMethod)} className={inputCls}>
              {PAY_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Proveedor (opcional)">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Ninguno —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="N° factura / nota (opcional)"><input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} /></Field>
          <div className="sm:col-span-2"><Field label="Descripción (opcional)"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></Field></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!amount || Number(amount) <= 0 || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editing ? 'Guardar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function monthStart(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function ExpensesPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo]     = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState('')
  const [modal, setModal] = useState<{ editing: ExpenseRow | null } | null>(null)

  const filters = useMemo(() => ({ from, to, category: category || undefined }), [from, to, category])

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', tenantId, filters],
    queryFn: () => getExpenses(tenantId!, filters),
    enabled: !!tenantId,
  })
  const { data: summary } = useQuery({
    queryKey: ['expense-summary', tenantId, filters],
    queryFn: () => getExpenseSummary(tenantId!, filters),
    enabled: !!tenantId,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(tenantId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', tenantId] })
      qc.invalidateQueries({ queryKey: ['expense-summary', tenantId] })
      toast.success('Gasto eliminado')
    },
  })

  const topCat = summary?.byCategory?.[0]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Wallet className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Gastos Operativos</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Registra y categoriza los gastos del negocio.</p>
          </div>
        </div>
        <button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Registrar gasto
        </button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
          <div className="flex items-center gap-2 text-grafito-500"><TrendingDown className="h-4 w-4" /><p className="text-xs font-medium">Total del período</p></div>
          <p className="text-2xl font-black text-grafito-900 dark:text-white mt-1">{money(summary?.total ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
          <p className="text-xs font-medium text-grafito-500">N° de gastos</p>
          <p className="text-2xl font-black text-grafito-900 dark:text-white mt-1">{summary?.count ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
          <p className="text-xs font-medium text-grafito-500">Categoría mayor</p>
          <p className="text-lg font-bold text-grafito-900 dark:text-white mt-1 truncate">{topCat ? topCat.category : '—'}</p>
          {topCat && <p className="text-xs text-grafito-400">{money(topCat.total)}</p>}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400">
            <Wallet className="h-8 w-8" />
            <p className="text-sm">No hay gastos en este período.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm min-w-[760px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Detalle</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300 whitespace-nowrap">
                    {new Date(e.expense_date + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500">{e.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-grafito-800 dark:text-grafito-100">{e.description ?? '—'}</p>
                    <div className="text-xs text-grafito-400">
                      {e.suppliers?.name && <span>{e.suppliers.name}</span>}
                      {e.suppliers?.name && e.reference && <span> · </span>}
                      {e.reference && <span>#{e.reference}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{payLabel(e.payment_method)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-grafito-900 dark:text-white whitespace-nowrap">{money(Number(e.amount), e.currency)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setModal({ editing: e })} title="Editar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm('¿Eliminar este gasto?')) remove.mutate(e.id) }} title="Eliminar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && tenantId && <ExpenseModal tenantId={tenantId} editing={modal.editing} onClose={() => setModal(null)} />}
    </div>
  )
}
