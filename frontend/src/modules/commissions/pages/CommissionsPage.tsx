import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Percent, BarChart3, SlidersHorizontal, Loader2, Plus, X, Save, Coins,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getEmployees, getCategories, getCommissionRules, upsertCommissionRule,
  deleteCommissionRule, getCommissionReport,
  type EmployeeRow, type CategoryRow, type CommissionRuleRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)) }

// ─── Tarjeta de reglas por empleado ───────────────────────────────────────────
function EmployeeRuleCard({ tenantId, employee, base, overrides, categories }: {
  tenantId: string; employee: EmployeeRow; base?: CommissionRuleRow
  overrides: CommissionRuleRow[]; categories: CategoryRow[]
}) {
  const qc = useQueryClient()
  const [basePct, setBasePct] = useState(base ? String(base.percent) : '')
  const [ovCat, setOvCat] = useState('')
  const [ovPct, setOvPct] = useState('')
  const invalidate = () => qc.invalidateQueries({ queryKey: ['commission-rules', tenantId] })

  const saveBase = useMutation({
    mutationFn: () => upsertCommissionRule(tenantId, employee.userId, null, Number(basePct) || 0),
    onSuccess: () => { invalidate(); toast.success('% base guardado') },
    onError: (e: any) => toast.error(e?.message ?? 'Error'),
  })
  const addOverride = useMutation({
    mutationFn: () => upsertCommissionRule(tenantId, employee.userId, ovCat, Number(ovPct) || 0),
    onSuccess: () => { invalidate(); setOvCat(''); setOvPct(''); toast.success('Override agregado') },
    onError: (e: any) => toast.error(e?.message ?? 'Error'),
  })
  const removeOverride = useMutation({
    mutationFn: (id: string) => deleteCommissionRule(tenantId, id),
    onSuccess: () => invalidate(),
  })

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'
  const usedCatIds = new Set(overrides.map((o) => o.category_id))
  const availableCats = categories.filter((c) => !usedCatIds.has(c.id))

  return (
    <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-grafito-900 dark:text-white">{employee.fullName ?? employee.email}</p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input value={basePct} onChange={(e) => setBasePct(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" className={cn(inputCls, 'w-20 text-right pr-6')} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-grafito-400 text-xs">%</span>
          </div>
          <button onClick={() => saveBase.mutate()} disabled={saveBase.isPending} className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {saveBase.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-grafito-400 -mt-1">% base aplicado a todas sus ventas (salvo overrides por categoría).</p>

      {/* Overrides */}
      {overrides.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {overrides.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 text-xs font-semibold">
              {catName(o.category_id)}: {o.percent}%
              <button onClick={() => removeOverride.mutate(o.id)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      {availableCats.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <select value={ovCat} onChange={(e) => setOvCat(e.target.value)} className={cn(inputCls, 'flex-1')}>
            <option value="">Override por categoría…</option>
            {availableCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative">
            <input value={ovPct} onChange={(e) => setOvPct(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" className={cn(inputCls, 'w-20 text-right pr-6')} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-grafito-400 text-xs">%</span>
          </div>
          <button onClick={() => addOverride.mutate()} disabled={!ovCat || addOverride.isPending} className="inline-flex items-center gap-1 rounded-lg border border-grafito-200 dark:border-white/10 px-2.5 py-2 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function CommissionsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const [tab, setTab] = useState<'report' | 'rules'>('report')
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo]     = useState(iso(new Date()))

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', tenantId], queryFn: () => getEmployees(tenantId!), enabled: !!tenantId,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', tenantId], queryFn: () => getCategories(tenantId!), enabled: !!tenantId,
  })
  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ['commission-rules', tenantId], queryFn: () => getCommissionRules(tenantId!), enabled: !!tenantId,
  })
  const { data: report = [], isLoading: loadingReport } = useQuery({
    queryKey: ['commission-report', tenantId, from, to],
    queryFn: () => getCommissionReport(tenantId!, from, to),
    enabled: !!tenantId && tab === 'report',
  })

  const nameOf = (id: string) => employees.find((e) => e.userId === id)?.fullName
    ?? employees.find((e) => e.userId === id)?.email ?? `Usuario ${id.slice(0, 6)}`

  const baseOf = (userId: string) => rules.find((r) => r.user_id === userId && r.category_id === null)
  const overridesOf = (userId: string) => rules.filter((r) => r.user_id === userId && r.category_id !== null)

  const totalCommission = useMemo(() => report.reduce((s, r) => s + r.commission, 0), [report])
  const totalSales = useMemo(() => report.reduce((s, r) => s + r.sales_base, 0), [report])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><Percent className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Comisiones</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Reglas por empleado y cálculo de comisiones por venta.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([['report', 'Reporte', BarChart3], ['rules', 'Reglas', SlidersHorizontal]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={cn('inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-colors', tab === key ? 'bg-brand-500 text-white border-brand-500' : 'border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5')}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'report' ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-2">
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Desde</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></div>
              <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Hasta</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></div>
            </div>
            <div className="flex gap-3">
              <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 px-4 py-2.5 text-right">
                <p className="text-[11px] text-grafito-400 uppercase font-semibold">Ventas base</p>
                <p className="text-lg font-bold text-grafito-900 dark:text-white">{formatCurrency(totalSales, 'COP')}</p>
              </div>
              <div className="rounded-2xl border border-brand-200 dark:border-brand-500/30 bg-brand-500/5 px-4 py-2.5 text-right">
                <p className="text-[11px] text-brand-400 uppercase font-semibold">Comisión total</p>
                <p className="text-lg font-black text-brand-600 dark:text-brand-400">{formatCurrency(totalCommission, 'COP')}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
            {loadingReport ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
            ) : report.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Coins className="h-8 w-8" /><p className="text-sm">Sin ventas con comisión en este periodo.</p><p className="text-xs">Verifica que los empleados tengan un % base asignado en la pestaña Reglas.</p></div>
            ) : (
              <table className="w-full text-left text-sm min-w-[560px]">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
                    <th className="px-4 py-3">Empleado</th>
                    <th className="px-4 py-3 text-right">Ventas (base comisión)</th>
                    <th className="px-4 py-3 text-right">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                  {report.slice().sort((a, b) => b.commission - a.commission).map((r) => (
                    <tr key={r.user_id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-grafito-900 dark:text-white">{nameOf(r.user_id)}</td>
                      <td className="px-4 py-3 text-right text-grafito-600 dark:text-grafito-300">{formatCurrency(r.sales_base, 'COP')}</td>
                      <td className="px-4 py-3 text-right font-bold text-brand-600 dark:text-brand-400">{formatCurrency(r.commission, 'COP')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          {loadingRules ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><SlidersHorizontal className="h-8 w-8" /><p className="text-sm">Agrega empleados para configurar comisiones.</p></div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {employees.map((emp) => (
                <EmployeeRuleCard
                  key={emp.userId}
                  tenantId={tenantId!}
                  employee={emp}
                  base={baseOf(emp.userId)}
                  overrides={overridesOf(emp.userId)}
                  categories={categories}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
