import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Banknote, Plus, Loader2, X, CheckCircle2, Sparkles } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import { getPayrollEntries, createPayrollEntry, markPayrollPaid, generatePayrollDraft, getEmployees, type PayrollRow } from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function CreateModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = useState('')
  const [name, setName] = useState('')
  const [period, setPeriod] = useState('')
  const [salary, setSalary] = useState('')
  const [bonuses, setBonuses] = useState('')
  const [deductions, setDeductions] = useState('')

  const { data: employees = [] } = useQuery({ queryKey: ['employees', tenantId], queryFn: () => getEmployees(tenantId), enabled: !!tenantId })
  const net = (Number(salary) || 0) + (Number(bonuses) || 0) - (Number(deductions) || 0)

  const onPick = (id: string) => { setEmployeeId(id); const e = employees.find((x) => x.userId === id); if (e?.fullName) setName(e.fullName) }

  const save = useMutation({
    mutationFn: () => createPayrollEntry(tenantId, {
      employee_id: employeeId || null, employee_name: name.trim(), period_label: period.trim(),
      base_salary: Number(salary) || 0, bonuses: Number(bonuses) || 0, deductions: Number(deductions) || 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll', tenantId] }); toast.success('Nómina registrada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Registrar nómina</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Empleado">
            <select value={employeeId} onChange={(e) => onPick(e.target.value)} className={inputCls}>
              <option value="">Manual…</option>
              {employees.map((e) => <option key={e.userId} value={e.userId}>{e.fullName ?? e.email}</option>)}
            </select>
          </Field>
          <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Período"><input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Marzo 2026" className={inputCls} /></Field>
          <Field label="Salario base"><input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} className={inputCls} /></Field>
          <Field label="Bonificaciones"><input type="number" min={0} value={bonuses} onChange={(e) => setBonuses(e.target.value)} className={inputCls} /></Field>
          <Field label="Deducciones"><input type="number" min={0} value={deductions} onChange={(e) => setDeductions(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-grafito-50 dark:bg-white/5 px-4 py-3">
          <span className="text-sm font-semibold text-grafito-500">Neto a pagar</span>
          <span className="text-lg font-black text-brand-500">{formatCurrency(net, 'COP')}</span>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!name.trim() || !period.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar
          </button>
        </div>
      </div>
    </div>
  )
}

function GenerateModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const today = new Date()
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const iso   = (d: Date) => d.toISOString().slice(0, 10)
  const [from, setFrom]   = useState(iso(first))
  const [to, setTo]       = useState(iso(today))
  const [label, setLabel] = useState(today.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }))

  const gen = useMutation({
    mutationFn: () => generatePayrollDraft(tenantId, from, to, label.trim()),
    onSuccess: (rows) => {
      qc.invalidateQueries({ queryKey: ['payroll', tenantId] })
      toast.success(rows.length > 0
        ? `${rows.length} borrador${rows.length !== 1 ? 'es' : ''} generado${rows.length !== 1 ? 's' : ''} desde asistencia, comisiones y propinas`
        : 'No hay nada nuevo que generar para este período')
      onClose()
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo generar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Generar nómina automática</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-grafito-500 mb-5">
          Crea borradores por empleado con su salario base + comisiones del período + propinas asignadas. Las horas de asistencia quedan en las notas.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
          <Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-4"><Field label="Etiqueta del período"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Julio 2026" className={inputCls} /></Field></div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => gen.mutate()} disabled={!label.trim() || gen.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PayrollPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [create, setCreate] = useState(false)
  const [generate, setGenerate] = useState(false)

  const { data: rows = [], isLoading } = useQuery({ queryKey: ['payroll', tenantId], queryFn: () => getPayrollEntries(tenantId!), enabled: !!tenantId })
  const pending = useMemo(() => rows.filter((r) => r.status === 'DRAFT').reduce((s, r) => s + Number(r.net_pay), 0), [rows])

  const pay = useMutation({
    mutationFn: (id: string) => markPayrollPaid(tenantId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll', tenantId] }); toast.success('Marcada como pagada') },
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Banknote className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Nómina</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Salarios, bonificaciones y pagos.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setGenerate(true)} className="inline-flex items-center gap-2 rounded-xl border border-brand-500/40 px-4 py-2 text-sm font-semibold text-brand-500 hover:bg-brand-500/10">
            <Sparkles className="h-4 w-4" /> Generar automática
          </button>
          <button onClick={() => setCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            <Plus className="h-4 w-4" /> Registrar nómina
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 max-w-xs"><p className="text-xs text-grafito-500">Pendiente por pagar</p><p className="text-2xl font-black text-brand-500 mt-1">{formatCurrency(pending, 'COP')}</p></div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Banknote className="h-8 w-8" /><p className="text-sm">Aún no hay nóminas registradas.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[860px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Empleado</th><th className="px-4 py-3">Período</th><th className="px-4 py-3 text-right">Base</th><th className="px-4 py-3 text-right">Bonos</th><th className="px-4 py-3 text-right">Deduc.</th><th className="px-4 py-3 text-right">Neto</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acción</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-semibold text-grafito-900 dark:text-white">{r.employee_name}</td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{r.period_label}</td>
                  <td className="px-4 py-3 text-right text-grafito-500">{formatCurrency(Number(r.base_salary), 'COP')}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(r.bonuses), 'COP')}</td>
                  <td className="px-4 py-3 text-right text-red-500">{formatCurrency(Number(r.deductions), 'COP')}</td>
                  <td className="px-4 py-3 text-right font-bold text-grafito-900 dark:text-white">{formatCurrency(Number(r.net_pay), 'COP')}</td>
                  <td className="px-4 py-3"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', r.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-grafito-200 dark:bg-white/10 text-grafito-500')}>{r.status === 'PAID' ? 'Pagada' : 'Pendiente'}</span></td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'DRAFT' && <button onClick={() => pay.mutate(r.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600"><CheckCircle2 className="h-3.5 w-3.5" /> Pagar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {create && tenantId && <CreateModal tenantId={tenantId} onClose={() => setCreate(false)} />}
      {generate && tenantId && <GenerateModal tenantId={tenantId} onClose={() => setGenerate(false)} />}
    </div>
  )
}
