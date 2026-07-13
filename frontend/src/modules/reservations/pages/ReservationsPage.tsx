import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarClock, Plus, Loader2, X, Users, Phone, MessageCircle, Check,
  Armchair, XCircle, UserX, Pencil, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import {
  getReservations, saveReservation, setReservationStatus, deleteReservation, getTables,
  type ReservationRow, type ReservationStatus, type TableRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '')
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const toLocalInput = (isoStr: string) => { const d = new Date(isoStr); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

const STATUS: Record<ReservationStatus, { label: string; cls: string }> = {
  PENDING:   { label: 'Pendiente', cls: 'bg-amber-400/10 text-amber-600 dark:text-amber-400' },
  CONFIRMED: { label: 'Confirmada', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  SEATED:    { label: 'Sentada',   cls: 'bg-brand-500/10 text-brand-600 dark:text-brand-400' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  NO_SHOW:   { label: 'No llegó',  cls: 'bg-grafito-300/20 text-grafito-500' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function ReservationModal({ tenantId, tables, editing, defaultDate, onClose }: {
  tenantId: string; tables: TableRow[]; editing: ReservationRow | null; defaultDate: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName]   = useState(editing?.customer_name ?? '')
  const [phone, setPhone] = useState(editing?.customer_phone ?? '')
  const [size, setSize]   = useState(String(editing?.party_size ?? 2))
  const [when, setWhen]   = useState(editing ? toLocalInput(editing.reserved_at) : `${defaultDate}T19:00`)
  const [tableId, setTableId] = useState(editing?.table_id ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')

  const save = useMutation({
    mutationFn: () => saveReservation(tenantId, {
      customer_name: name.trim(), customer_phone: phone.trim() || null,
      party_size: Number(size) || 1, reserved_at: new Date(when).toISOString(),
      table_id: tableId || null, notes: notes.trim() || null,
    }, editing?.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations', tenantId] }); toast.success(editing ? 'Reserva actualizada' : 'Reserva creada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar reserva' : 'Nueva reserva'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Cliente"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+57…" /></Field>
            <Field label="Personas"><input value={size} onChange={(e) => setSize(e.target.value.replace(/\D/g, ''))} className={inputCls} inputMode="numeric" /></Field>
          </div>
          <Field label="Fecha y hora"><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} /></Field>
          <Field label="Mesa (opcional)">
            <select value={tableId} onChange={(e) => setTableId(e.target.value)} className={inputCls}>
              <option value="">Sin asignar</option>
              {tables.map((t) => <option key={t.id} value={t.id}>Mesa {t.number}{t.name ? ` · ${t.name}` : ''} ({t.capacity}p)</option>)}
            </select>
          </Field>
          <Field label="Notas"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReservationsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)
  const tenantName = useAuthStore((s) => s.tenant?.tenantName)
  const qc = useQueryClient()
  const [day, setDay] = useState(iso(new Date()))
  const [modal, setModal] = useState<{ editing: ReservationRow | null } | null>(null)

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations', tenantId, day],
    queryFn: () => getReservations(tenantId!, { from: day, to: day }),
    enabled: !!tenantId,
  })
  const { data: tables = [] } = useQuery({
    queryKey: ['tables', tenantId, branchId], queryFn: () => getTables(tenantId!, branchId!), enabled: !!tenantId && !!branchId,
  })
  const tableLabel = (id: string | null) => { const t = tables.find((x) => x.id === id); return t ? `Mesa ${t.number}` : null }

  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: ReservationStatus }) => setReservationStatus(tenantId!, id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations', tenantId] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteReservation(tenantId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations', tenantId] }); toast.success('Reserva eliminada') },
  })

  const metrics = useMemo(() => {
    const active = reservations.filter((r) => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW')
    return {
      total: active.length,
      confirmed: reservations.filter((r) => r.status === 'CONFIRMED').length,
      covers: active.reduce((s, r) => s + r.party_size, 0),
    }
  }, [reservations])

  const waLink = (r: ReservationRow) => {
    const msg = `Hola ${r.customer_name}, confirmamos tu reserva en ${tenantName ?? 'nuestro restaurante'} para ${r.party_size} personas el ${new Date(r.reserved_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}. ¡Te esperamos!`
    return `https://wa.me/${digits(r.customer_phone)}?text=${encodeURIComponent(msg)}`
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><CalendarClock className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Reservas</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Agenda del día con confirmación y recordatorios.</p>
          </div>
        </div>
        <button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Nueva reserva</button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setDay(iso(addDays(new Date(day + 'T12:00'), -1)))} className="rounded-lg p-1.5 border border-grafito-200 dark:border-white/10 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5"><ChevronLeft className="h-4 w-4" /></button>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={cn(inputCls, 'w-auto')} />
          <button onClick={() => setDay(iso(addDays(new Date(day + 'T12:00'), 1)))} className="rounded-lg p-1.5 border border-grafito-200 dark:border-white/10 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-3 text-sm">
          <Metric label="Reservas" value={metrics.total} />
          <Metric label="Confirmadas" value={metrics.confirmed} />
          <Metric label="Cubiertos" value={metrics.covers} />
        </div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : reservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><CalendarClock className="h-8 w-8" /><p className="text-sm">Sin reservas para este día.</p></div>
        ) : (
          <div className="divide-y divide-grafito-100 dark:divide-white/5">
            {reservations.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="text-center w-14 shrink-0">
                  <p className="text-base font-black text-grafito-900 dark:text-white">{fmtTime(r.reserved_at)}</p>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <p className="font-semibold text-grafito-900 dark:text-white">{r.customer_name}</p>
                  <div className="flex items-center gap-3 text-xs text-grafito-400 mt-0.5">
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{r.party_size}</span>
                    {tableLabel(r.table_id) && <span>{tableLabel(r.table_id)}</span>}
                    {r.customer_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.customer_phone}</span>}
                  </div>
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0', STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {r.status === 'PENDING' && <button onClick={() => status.mutate({ id: r.id, s: 'CONFIRMED' })} title="Confirmar" className="rounded-lg p-1.5 text-grafito-400 hover:text-emerald-500 hover:bg-emerald-500/10"><Check className="h-4 w-4" /></button>}
                  {(r.status === 'PENDING' || r.status === 'CONFIRMED') && <button onClick={() => status.mutate({ id: r.id, s: 'SEATED' })} title="Sentar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Armchair className="h-4 w-4" /></button>}
                  {r.customer_phone && <a href={waLink(r)} target="_blank" rel="noreferrer" title="Recordar por WhatsApp" className="rounded-lg p-1.5 text-grafito-400 hover:text-emerald-500 hover:bg-emerald-500/10"><MessageCircle className="h-4 w-4" /></a>}
                  {r.status !== 'CANCELLED' && <button onClick={() => status.mutate({ id: r.id, s: 'CANCELLED' })} title="Cancelar" className="rounded-lg p-1.5 text-grafito-400 hover:text-rose-500 hover:bg-rose-500/10"><XCircle className="h-4 w-4" /></button>}
                  {r.status !== 'NO_SHOW' && <button onClick={() => status.mutate({ id: r.id, s: 'NO_SHOW' })} title="No llegó" className="rounded-lg p-1.5 text-grafito-400 hover:text-grafito-600 hover:bg-grafito-200/40"><UserX className="h-4 w-4" /></button>}
                  <button onClick={() => setModal({ editing: r })} title="Editar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { if (confirm('¿Eliminar reserva?')) remove.mutate(r.id) }} title="Eliminar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && tenantId && <ReservationModal tenantId={tenantId} tables={tables} editing={modal.editing} defaultDate={day} onClose={() => setModal(null)} />}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 px-3 py-1.5 text-center">
      <p className="text-lg font-bold text-grafito-900 dark:text-white leading-none">{value}</p>
      <p className="text-[10px] text-grafito-400 uppercase font-semibold mt-0.5">{label}</p>
    </div>
  )
}
