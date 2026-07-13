import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Coins, Wallet, Plus, Trash2, Loader2, X, Users, Clock, TrendingUp,
  Scale, CheckCircle2, History,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getEmployees, getTips, createTip, deleteTip, getAttendance, getSalesByEmployee,
  getTipPayouts, saveTipPayout,
  type TipRow, type EmployeeRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const todayISO = () => iso(new Date())
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const fmtDate = (s: string) => new Date(`${s}T00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
function hoursBetween(a: string, b: string | null): number { return b ? Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000) : 0 }

type Method = 'EQUAL' | 'HOURS' | 'SALES'
const METHODS: { key: Method; label: string; Icon: any; hint: string }[] = [
  { key: 'EQUAL', label: 'Partes iguales', Icon: Scale,      hint: 'El bote se divide en partes iguales entre los participantes.' },
  { key: 'HOURS', label: 'Por horas',      Icon: Clock,      hint: 'Proporcional a las horas trabajadas (módulo Asistencia).' },
  { key: 'SALES', label: 'Por ventas',     Icon: TrendingUp, hint: 'Proporcional a las ventas de cada empleado en el periodo.' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

// ─── Modal registrar propina ──────────────────────────────────────────────────
function TipModal({ tenantId, employees, onClose }: { tenantId: string; employees: EmployeeRow[]; onClose: () => void }) {
  const qc = useQueryClient()
  const branchId = useAuthStore((s) => s.branch?.branchId)
  const [amount, setAmount] = useState('')
  const [waiter, setWaiter] = useState('')
  const [date, setDate]     = useState(todayISO())

  const save = useMutation({
    mutationFn: () => createTip(tenantId, {
      amount: Number(amount) || 0, waiter_id: waiter || null, tip_date: date, branch_id: branchId ?? null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tips', tenantId] }); toast.success('Propina registrada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Registrar propina</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Monto"><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} className={inputCls} placeholder="0" inputMode="numeric" /></Field>
          <Field label="Mesero / empleado (opcional)">
            <select value={waiter} onChange={(e) => setWaiter(e.target.value)} className={inputCls}>
              <option value="">Sin atribuir (va al bote)</option>
              {employees.map((e) => <option key={e.userId} value={e.userId}>{e.fullName ?? e.email}</option>)}
            </select>
          </Field>
          <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!amount || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function TipsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'pool' | 'split'>('pool')
  const [from, setFrom] = useState(iso(addDays(new Date(), -6)))
  const [to, setTo]     = useState(todayISO())
  const [modal, setModal] = useState(false)
  const [method, setMethod] = useState<Method>('EQUAL')
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const { data: employees = [] } = useQuery({ queryKey: ['employees', tenantId], queryFn: () => getEmployees(tenantId!), enabled: !!tenantId })
  const nameOf = (id: string | null) => id ? (employees.find((e) => e.userId === id)?.fullName ?? employees.find((e) => e.userId === id)?.email ?? `Usuario ${id.slice(0, 6)}`) : 'Sin atribuir'

  const { data: tips = [], isLoading: loadingTips } = useQuery({
    queryKey: ['tips', tenantId, from, to], queryFn: () => getTips(tenantId!, { from, to }), enabled: !!tenantId,
  })
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', tenantId, from, to], queryFn: () => getAttendance(tenantId!, { from, to }), enabled: !!tenantId && tab === 'split',
  })
  const { data: salesByEmp = {} } = useQuery({
    queryKey: ['sales-by-emp', tenantId, from, to], queryFn: () => getSalesByEmployee(tenantId!, from, to), enabled: !!tenantId && tab === 'split',
  })
  const { data: payouts = [] } = useQuery({ queryKey: ['tip-payouts', tenantId], queryFn: () => getTipPayouts(tenantId!), enabled: !!tenantId })

  const pool = useMemo(() => tips.reduce((s, t) => s + Number(t.amount), 0), [tips])
  const undistributed = useMemo(() => tips.filter((t) => !t.distributed_at).reduce((s, t) => s + Number(t.amount), 0), [tips])

  const removeTip = useMutation({
    mutationFn: (id: string) => deleteTip(tenantId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tips', tenantId] }); toast.success('Propina eliminada') },
  })

  // Participantes (por defecto todos los empleados).
  const participants = useMemo(() => {
    if (selected) return employees.filter((e) => selected.has(e.userId))
    return employees
  }, [employees, selected])
  const isOn = (id: string) => (selected ? selected.has(id) : true)
  const toggleParticipant = (id: string) => {
    const base = selected ?? new Set(employees.map((e) => e.userId))
    const next = new Set(base)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  // Cálculo del reparto.
  const distribution = useMemo(() => {
    const base = undistributed
    if (participants.length === 0 || base <= 0) return [] as { userId: string; weight: number; amount: number }[]
    const hoursOf = (uid: string) => attendance.filter((a) => a.user_id === uid).reduce((s, a) => s + hoursBetween(a.check_in, a.check_out), 0)
    let weights: Record<string, number> = {}
    if (method === 'EQUAL') participants.forEach((p) => { weights[p.userId] = 1 })
    else if (method === 'HOURS') participants.forEach((p) => { weights[p.userId] = hoursOf(p.userId) })
    else participants.forEach((p) => { weights[p.userId] = salesByEmp[p.userId] ?? 0 })
    let totalW = Object.values(weights).reduce((s, w) => s + w, 0)
    // Si el método no tiene datos (0 horas / 0 ventas), cae a partes iguales.
    if (totalW <= 0) { participants.forEach((p) => { weights[p.userId] = 1 }); totalW = participants.length }
    return participants.map((p) => ({
      userId: p.userId,
      weight: weights[p.userId] ?? 0,
      amount: Math.round((base * (weights[p.userId] ?? 0)) / totalW),
    }))
  }, [participants, undistributed, method, attendance, salesByEmp])

  const saveSplit = useMutation({
    mutationFn: () => saveTipPayout(tenantId!, { from, to, method, lines: distribution.map((d) => ({ user_id: d.userId, amount: d.amount })) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tips', tenantId] })
      qc.invalidateQueries({ queryKey: ['tip-payouts', tenantId] })
      toast.success('Reparto registrado')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar el reparto'),
  })

  const weightLabel = (w: number) => method === 'HOURS' ? `${w.toFixed(1)} h` : method === 'SALES' ? formatCurrency(w, 'COP') : '—'

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Coins className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Propinas</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Bote acumulado, atribución y reparto entre el equipo.</p>
          </div>
        </div>
        <button onClick={() => setModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Registrar propina</button>
      </div>

      {/* Rango + métricas */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
          <Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 px-4 py-2.5 text-right">
            <p className="text-[11px] text-grafito-400 uppercase font-semibold">Bote del periodo</p>
            <p className="text-lg font-bold text-grafito-900 dark:text-white">{formatCurrency(pool, 'COP')}</p>
          </div>
          <div className="rounded-2xl border border-brand-200 dark:border-brand-500/30 bg-brand-500/5 px-4 py-2.5 text-right">
            <p className="text-[11px] text-brand-400 uppercase font-semibold">Sin repartir</p>
            <p className="text-lg font-black text-brand-600 dark:text-brand-400">{formatCurrency(undistributed, 'COP')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([['pool', 'Bote', Coins], ['split', 'Reparto', Wallet]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={cn('inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-colors', tab === key ? 'bg-brand-500 text-white border-brand-500' : 'border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5')}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'pool' ? (
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
          {loadingTips ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
          ) : tips.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Coins className="h-8 w-8" /><p className="text-sm">Sin propinas en este periodo.</p><p className="text-xs">Se registran solas al cobrar con propina en el POS, o manualmente aquí.</p></div>
          ) : (
            <table className="w-full text-left text-sm min-w-[560px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
                  <th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Mesero / empleado</th>
                  <th className="px-4 py-3 text-right">Monto</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                {tips.map((t) => (
                  <tr key={t.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-grafito-600 dark:text-grafito-300">{fmtDate(t.tip_date)}</td>
                    <td className="px-4 py-3 font-medium text-grafito-900 dark:text-white">{nameOf(t.waiter_id)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-grafito-900 dark:text-white">{formatCurrency(Number(t.amount), 'COP')}</td>
                    <td className="px-4 py-3">{t.distributed_at ? <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-grafito-200 dark:bg-white/10 text-grafito-500">Repartida</span> : <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500">En bote</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button onClick={() => { if (confirm('¿Eliminar propina?')) removeTip.mutate(t.id) }} title="Eliminar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Configuración del reparto */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-grafito-500">Método</p>
              {METHODS.map((m) => (
                <button key={m.key} onClick={() => setMethod(m.key)} className={cn('w-full flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors', method === m.key ? 'border-brand-500 bg-brand-500/5' : 'border-grafito-200 dark:border-white/10 hover:bg-grafito-50 dark:hover:bg-white/5')}>
                  <m.Icon className={cn('h-4 w-4 mt-0.5 shrink-0', method === m.key ? 'text-brand-500' : 'text-grafito-400')} />
                  <div>
                    <p className={cn('text-sm font-semibold', method === m.key ? 'text-brand-600 dark:text-brand-300' : 'text-grafito-800 dark:text-grafito-100')}>{m.label}</p>
                    <p className="text-[11px] text-grafito-500">{m.hint}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-grafito-500 mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Participantes</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {employees.map((e) => (
                  <label key={e.userId} className="flex items-center gap-2 text-sm text-grafito-700 dark:text-grafito-200 cursor-pointer">
                    <input type="checkbox" checked={isOn(e.userId)} onChange={() => toggleParticipant(e.userId)} className="rounded border-grafito-300" />
                    {e.fullName ?? e.email}
                  </label>
                ))}
                {employees.length === 0 && <p className="text-xs text-grafito-400">Agrega empleados para repartir.</p>}
              </div>
            </div>
          </div>

          {/* Resultado del reparto */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-grafito-100 dark:border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-grafito-900 dark:text-white">Reparto de {formatCurrency(undistributed, 'COP')}</h3>
                <button onClick={() => saveSplit.mutate()} disabled={distribution.length === 0 || undistributed <= 0 || saveSplit.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40">
                  {saveSplit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Registrar reparto
                </button>
              </div>
              {distribution.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-14 text-grafito-400"><Wallet className="h-7 w-7" /><p className="text-sm">Nada que repartir en este periodo.</p></div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-100 dark:border-white/5">
                      <th className="px-5 py-2.5">Empleado</th><th className="px-5 py-2.5 text-right">Base</th><th className="px-5 py-2.5 text-right">Le toca</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                    {distribution.map((d) => (
                      <tr key={d.userId}>
                        <td className="px-5 py-2.5 font-medium text-grafito-900 dark:text-white">{nameOf(d.userId)}</td>
                        <td className="px-5 py-2.5 text-right text-grafito-500">{weightLabel(d.weight)}</td>
                        <td className="px-5 py-2.5 text-right font-bold text-brand-600 dark:text-brand-400">{formatCurrency(d.amount, 'COP')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Historial de repartos */}
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
              <div className="px-5 py-3 border-b border-grafito-100 dark:border-white/5 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-grafito-400" />
                <h3 className="text-sm font-bold text-grafito-900 dark:text-white">Historial de repartos</h3>
              </div>
              {payouts.length === 0 ? (
                <p className="text-xs text-grafito-400 py-6 text-center">Aún no has registrado repartos.</p>
              ) : (
                <div className="divide-y divide-grafito-100 dark:divide-white/5 max-h-64 overflow-y-auto">
                  {payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-grafito-800 dark:text-grafito-100 truncate">{nameOf(p.user_id)}</p>
                        <p className="text-[11px] text-grafito-400">{fmtDate(p.from_date)}–{fmtDate(p.to_date)} · {METHODS.find((m) => m.key === p.method)?.label ?? p.method}</p>
                      </div>
                      <span className="text-sm font-semibold text-grafito-800 dark:text-grafito-100 shrink-0">{formatCurrency(Number(p.amount), 'COP')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modal && tenantId && <TipModal tenantId={tenantId} employees={employees} onClose={() => setModal(false)} />}
    </div>
  )
}
