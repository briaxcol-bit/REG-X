import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Clock, CalendarDays, Plus, Trash2, Pencil, Loader2, X, LogIn, LogOut,
  ChevronLeft, ChevronRight, Timer,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import {
  getEmployees, getAttendance, checkInAttendance, checkOutAttendance,
  saveAttendance, deleteAttendance, getShifts, saveShift, deleteShift,
  type AttendanceRow, type ShiftRow, type EmployeeRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none'

// ── Helpers de fecha ──────────────────────────────────────────────────────────
const iso = (d: Date) => d.toISOString().slice(0, 10)
const todayISO = () => iso(new Date())
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd) } // lunes
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const fmtTime = (t: string | null) => (t ? new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—')
const fmtHM = (hhmm: string) => hhmm?.slice(0, 5)

function hoursBetween(a: string, b: string | null): number | null {
  if (!b) return null
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─── Modal de asistencia manual ───────────────────────────────────────────────
function AttendanceModal({ tenantId, employees, editing, onClose }: {
  tenantId: string; employees: EmployeeRow[]; editing: AttendanceRow | null; onClose: () => void
}) {
  const qc = useQueryClient()
  const [userId, setUserId] = useState(editing?.user_id ?? employees[0]?.userId ?? '')
  const [date, setDate]     = useState(editing?.work_date ?? todayISO())
  const [tIn, setTIn]       = useState(editing?.check_in ? new Date(editing.check_in).toTimeString().slice(0, 5) : '08:00')
  const [tOut, setTOut]     = useState(editing?.check_out ? new Date(editing.check_out).toTimeString().slice(0, 5) : '')
  const [notes, setNotes]   = useState(editing?.notes ?? '')

  const save = useMutation({
    mutationFn: () => saveAttendance(tenantId, {
      user_id: userId,
      work_date: date,
      check_in: new Date(`${date}T${tIn}`).toISOString(),
      check_out: tOut ? new Date(`${date}T${tOut}`).toISOString() : null,
      notes: notes.trim() || null,
    }, editing?.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance', tenantId] }); toast.success('Registro guardado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar registro' : 'Registrar asistencia'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Empleado">
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls} disabled={!!editing}>
              {employees.map((e) => <option key={e.userId} value={e.userId}>{e.fullName ?? e.email ?? e.userId.slice(0, 8)}</option>)}
            </select>
          </Field>
          <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entrada"><input type="time" value={tIn} onChange={(e) => setTIn(e.target.value)} className={inputCls} /></Field>
            <Field label="Salida"><input type="time" value={tOut} onChange={(e) => setTOut(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Notas"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!userId || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de turno ───────────────────────────────────────────────────────────
function ShiftModal({ tenantId, employee, date, editing, onClose }: {
  tenantId: string; employee: EmployeeRow; date: string; editing: ShiftRow | null; onClose: () => void
}) {
  const qc = useQueryClient()
  const [start, setStart] = useState(editing ? fmtHM(editing.start_time) : '08:00')
  const [end, setEnd]     = useState(editing ? fmtHM(editing.end_time) : '17:00')
  const [notes, setNotes] = useState(editing?.notes ?? '')

  const save = useMutation({
    mutationFn: () => saveShift(tenantId, {
      user_id: employee.userId, shift_date: date, start_time: start, end_time: end, notes: notes.trim() || null,
    }, editing?.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts', tenantId] }); toast.success('Turno guardado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })
  const del = useMutation({
    mutationFn: () => deleteShift(tenantId, editing!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts', tenantId] }); toast.success('Turno eliminado'); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar turno' : 'Nuevo turno'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-grafito-500 mb-4">{employee.fullName ?? employee.email} · {new Date(`${date}T00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} /></Field>
          <Field label="Fin"><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-3"><Field label="Notas"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field></div>
        <div className="flex gap-2 mt-6">
          {editing && <button onClick={() => del.mutate()} className="rounded-xl border border-red-200 dark:border-red-500/30 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>}
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)
  const profile  = useAuthStore((s) => s.profile)
  const qc = useQueryClient()

  const [tab, setTab] = useState<'log' | 'shifts'>('log')
  const [from, setFrom] = useState(iso(addDays(new Date(), -6)))
  const [to, setTo]     = useState(todayISO())
  const [attModal, setAttModal] = useState<{ editing: AttendanceRow | null } | null>(null)
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()))
  const [shiftModal, setShiftModal] = useState<{ employee: EmployeeRow; date: string; editing: ShiftRow | null } | null>(null)

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', tenantId], queryFn: () => getEmployees(tenantId!), enabled: !!tenantId,
  })
  const nameOf = useMemo(() => {
    const m = new Map<string, string>()
    employees.forEach((e) => m.set(e.userId, e.fullName ?? e.email ?? e.userId.slice(0, 8)))
    if (profile) m.set(profile.id, profile.fullName ?? profile.email ?? 'Yo')
    return (id: string) => m.get(id) ?? `Usuario ${id.slice(0, 6)}`
  }, [employees, profile])

  const { data: attendance = [], isLoading: loadingAtt } = useQuery({
    queryKey: ['attendance', tenantId, from, to],
    queryFn: () => getAttendance(tenantId!, { from, to }),
    enabled: !!tenantId,
  })

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => iso(addDays(weekStart, i))), [weekStart])
  const weekFrom = iso(weekStart)
  const weekTo   = iso(addDays(weekStart, 6))
  const { data: shifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ['shifts', tenantId, weekFrom, weekTo],
    queryFn: () => getShifts(tenantId!, { from: weekFrom, to: weekTo }),
    enabled: !!tenantId,
  })

  // Registro abierto del usuario actual hoy (para fichar salida).
  const myOpen = useMemo(
    () => attendance.find((a) => a.user_id === profile?.id && a.work_date === todayISO() && !a.check_out),
    [attendance, profile],
  )

  const checkIn = useMutation({
    mutationFn: () => checkInAttendance(tenantId!, profile!.id, branchId ?? null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance', tenantId] }); toast.success('Entrada registrada') },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo fichar'),
  })
  const checkOut = useMutation({
    mutationFn: (id: string) => checkOutAttendance(tenantId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance', tenantId] }); toast.success('Salida registrada') },
  })
  const removeAtt = useMutation({
    mutationFn: (id: string) => deleteAttendance(tenantId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance', tenantId] }); toast.success('Registro eliminado') },
  })

  const totalHours = useMemo(
    () => attendance.reduce((s, a) => s + (hoursBetween(a.check_in, a.check_out) ?? 0), 0),
    [attendance],
  )

  const shiftAt = (userId: string, date: string) => shifts.find((s) => s.user_id === userId && s.shift_date === date)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Clock className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Asistencia y Turnos</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Control de entrada/salida y programación del equipo.</p>
          </div>
        </div>
        {profile && (
          myOpen
            ? <button onClick={() => checkOut.mutate(myOpen.id)} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"><LogOut className="h-4 w-4" /> Fichar mi salida</button>
            : <button onClick={() => checkIn.mutate()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"><LogIn className="h-4 w-4" /> Fichar mi entrada</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([['log', 'Asistencia', Clock], ['shifts', 'Turnos', CalendarDays]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={cn('inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-colors', tab === key ? 'bg-brand-500 text-white border-brand-500' : 'border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5')}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'log' ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-2">
              <Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
              <Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[11px] text-grafito-400 uppercase font-semibold">Horas del periodo</p>
                <p className="text-lg font-bold text-grafito-900 dark:text-white">{totalHours.toFixed(1)} h</p>
              </div>
              <button onClick={() => setAttModal({ editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Registrar</button>
            </div>
          </div>

          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
            {loadingAtt ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
            ) : attendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Clock className="h-8 w-8" /><p className="text-sm">Sin registros en este periodo.</p></div>
            ) : (
              <table className="w-full text-left text-sm min-w-[680px]">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
                    <th className="px-4 py-3">Empleado</th><th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th>
                    <th className="px-4 py-3">Horas</th><th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                  {attendance.map((a) => {
                    const h = hoursBetween(a.check_in, a.check_out)
                    return (
                      <tr key={a.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                        <td className="px-4 py-3 font-semibold text-grafito-900 dark:text-white">{nameOf(a.user_id)}</td>
                        <td className="px-4 py-3 text-grafito-600 dark:text-grafito-300">{new Date(`${a.work_date}T00:00`).toLocaleDateString('es-CO')}</td>
                        <td className="px-4 py-3 text-grafito-600 dark:text-grafito-300">{fmtTime(a.check_in)}</td>
                        <td className="px-4 py-3">{a.check_out ? <span className="text-grafito-600 dark:text-grafito-300">{fmtTime(a.check_out)}</span> : <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500">En curso</span>}</td>
                        <td className="px-4 py-3">{h != null ? <span className="inline-flex items-center gap-1 font-medium text-grafito-800 dark:text-grafito-100"><Timer className="h-3.5 w-3.5 text-grafito-400" />{h.toFixed(1)} h</span> : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {!a.check_out && <button onClick={() => checkOut.mutate(a.id)} title="Marcar salida" className="rounded-lg p-1.5 text-grafito-400 hover:text-amber-500 hover:bg-amber-500/10"><LogOut className="h-4 w-4" /></button>}
                            <button onClick={() => setAttModal({ editing: a })} title="Editar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => { if (confirm('¿Eliminar registro?')) removeAtt.mutate(a.id) }} title="Eliminar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-lg p-1.5 border border-grafito-200 dark:border-white/10 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-sm font-semibold text-grafito-600 dark:text-grafito-300 px-2">Semana del {new Date(`${weekFrom}T00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</button>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-lg p-1.5 border border-grafito-200 dark:border-white/10 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
            {loadingShifts ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><CalendarDays className="h-8 w-8" /><p className="text-sm">Agrega empleados para programar turnos.</p></div>
            ) : (
              <table className="w-full text-left text-sm min-w-[820px]">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
                    <th className="px-4 py-3 sticky left-0 bg-white dark:bg-grafito-900/60">Empleado</th>
                    {weekDays.map((d, i) => <th key={d} className="px-3 py-3 text-center">{DAY_NAMES[i]}<span className="block text-grafito-400 font-normal">{new Date(`${d}T00:00`).getDate()}</span></th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                  {employees.map((emp) => (
                    <tr key={emp.userId}>
                      <td className="px-4 py-3 font-semibold text-grafito-900 dark:text-white sticky left-0 bg-white dark:bg-grafito-900/60 whitespace-nowrap">{emp.fullName ?? emp.email}</td>
                      {weekDays.map((d) => {
                        const sh = shiftAt(emp.userId, d)
                        return (
                          <td key={d} className="px-2 py-2 text-center">
                            <button
                              onClick={() => setShiftModal({ employee: emp, date: d, editing: sh ?? null })}
                              className={cn('w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-colors', sh ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300 hover:bg-brand-500/20' : 'text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 border border-dashed border-grafito-200 dark:border-white/10')}
                            >
                              {sh ? `${fmtHM(sh.start_time)}–${fmtHM(sh.end_time)}` : <Plus className="h-3.5 w-3.5 mx-auto" />}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {attModal && tenantId && <AttendanceModal tenantId={tenantId} employees={employees} editing={attModal.editing} onClose={() => setAttModal(null)} />}
      {shiftModal && tenantId && <ShiftModal tenantId={tenantId} employee={shiftModal.employee} date={shiftModal.date} editing={shiftModal.editing} onClose={() => setShiftModal(null)} />}
    </div>
  )
}
