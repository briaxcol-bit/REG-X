import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bike, Plus, Loader2, X, MapPin, Phone, MessageCircle, ChevronRight, XCircle,
  Users, Power, Trash2,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getDeliveries, saveDelivery, setDeliveryStatus, deleteDelivery,
  getCouriers, saveCourier, toggleCourier,
  type DeliveryRow, type DeliveryStatus, type CourierRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none'
const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '')

const COLS: { key: DeliveryStatus; label: string; accent: string }[] = [
  { key: 'PENDING',   label: 'Pendiente',  accent: 'text-amber-500' },
  { key: 'PREPARING', label: 'Preparando', accent: 'text-blue-500' },
  { key: 'ON_WAY',    label: 'En camino',  accent: 'text-brand-500' },
  { key: 'DELIVERED', label: 'Entregado',  accent: 'text-emerald-500' },
]
const NEXT: Partial<Record<DeliveryStatus, DeliveryStatus>> = { PENDING: 'PREPARING', PREPARING: 'ON_WAY', ON_WAY: 'DELIVERED' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function DeliveryModal({ tenantId, couriers, branchId, onClose }: { tenantId: string; couriers: CourierRow[]; branchId: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  const [addr, setAddr]   = useState('')
  const [total, setTotal] = useState('')
  const [fee, setFee]     = useState('')
  const [courier, setCourier] = useState('')
  const [notes, setNotes] = useState('')
  const save = useMutation({
    mutationFn: () => saveDelivery(tenantId, {
      customer_name: name.trim(), customer_phone: phone.trim() || null, address: addr.trim(),
      total: Number(total) || 0, fee: Number(fee) || 0, courier_id: courier || null, branch_id: branchId, notes: notes.trim() || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries', tenantId] }); toast.success('Pedido creado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Nuevo pedido a domicilio</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Cliente"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Teléfono"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+57…" /></Field>
          <Field label="Dirección"><textarea value={addr} onChange={(e) => setAddr(e.target.value)} rows={2} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total pedido"><input value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))} className={inputCls} inputMode="numeric" /></Field>
            <Field label="Domicilio"><input value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))} className={inputCls} inputMode="numeric" /></Field>
          </div>
          <Field label="Repartidor (opcional)">
            <select value={courier} onChange={(e) => setCourier(e.target.value)} className={inputCls}>
              <option value="">Sin asignar</option>
              {couriers.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Notas"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!name.trim() || !addr.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear
          </button>
        </div>
      </div>
    </div>
  )
}

function CouriersModal({ tenantId, couriers, onClose }: { tenantId: string; couriers: CourierRow[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const invalidate = () => qc.invalidateQueries({ queryKey: ['couriers', tenantId] })
  const add = useMutation({ mutationFn: () => saveCourier(tenantId, { name: name.trim(), phone: phone.trim() || null }), onSuccess: () => { invalidate(); setName(''); setPhone(''); toast.success('Repartidor agregado') } })
  const toggle = useMutation({ mutationFn: (c: CourierRow) => toggleCourier(tenantId, c.id, !c.is_active), onSuccess: invalidate })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white flex items-center gap-2"><Users className="h-4 w-4" /> Repartidores</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className={inputCls} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" className={cn(inputCls, 'w-36')} />
          <button onClick={() => add.mutate()} disabled={!name.trim() || add.isPending} className="rounded-xl bg-brand-500 px-3 text-white hover:bg-brand-600 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="divide-y divide-grafito-100 dark:divide-white/5 max-h-72 overflow-y-auto">
          {couriers.length === 0 ? <p className="text-sm text-grafito-400 text-center py-6">Sin repartidores.</p> : couriers.map((c) => (
            <div key={c.id} className={cn('flex items-center justify-between gap-2 py-2.5', !c.is_active && 'opacity-50')}>
              <div><p className="text-sm font-medium text-grafito-900 dark:text-white">{c.name}</p>{c.phone && <p className="text-xs text-grafito-400">{c.phone}</p>}</div>
              <button onClick={() => toggle.mutate(c)} title={c.is_active ? 'Desactivar' : 'Activar'} className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Power className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DeliveryPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [couriersModal, setCouriersModal] = useState(false)

  const { data: deliveries = [], isLoading } = useQuery({ queryKey: ['deliveries', tenantId], queryFn: () => getDeliveries(tenantId!), enabled: !!tenantId })
  const { data: couriers = [] } = useQuery({ queryKey: ['couriers', tenantId], queryFn: () => getCouriers(tenantId!), enabled: !!tenantId })
  const courierName = (id: string | null) => couriers.find((c) => c.id === id)?.name ?? null

  const advance = useMutation({
    mutationFn: ({ id, s }: { id: string; s: DeliveryStatus }) => setDeliveryStatus(tenantId!, id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deliveries', tenantId] }),
  })
  const assign = useMutation({
    mutationFn: ({ d, courierId }: { d: DeliveryRow; courierId: string }) => setDeliveryStatus(tenantId!, d.id, d.status, courierId || null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deliveries', tenantId] }),
  })
  const remove = useMutation({ mutationFn: (id: string) => deleteDelivery(tenantId!, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries', tenantId] }); toast.success('Pedido eliminado') } })

  const byStatus = (s: DeliveryStatus) => deliveries.filter((d) => d.status === s)
  const today = new Date().toISOString().slice(0, 10)
  const metrics = useMemo(() => ({
    active: deliveries.filter((d) => ['PENDING', 'PREPARING', 'ON_WAY'].includes(d.status)).length,
    onWay: byStatus('ON_WAY').length,
    deliveredToday: deliveries.filter((d) => d.status === 'DELIVERED' && (d.delivered_at ?? '').slice(0, 10) === today).length,
  }), [deliveries])

  const waLink = (d: DeliveryRow) => `https://wa.me/${digits(d.customer_phone)}?text=${encodeURIComponent(`Hola ${d.customer_name}, tu pedido va en camino 🛵`)}`

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Bike className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Delivery</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Pedidos a domicilio y repartidores.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCouriersModal(true)} className="inline-flex items-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 px-3 py-2 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5"><Users className="h-4 w-4" /> Repartidores</button>
          <button onClick={() => setModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Nuevo pedido</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Activos', metrics.active], ['En camino', metrics.onWay], ['Entregados hoy', metrics.deliveredToday]].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 text-center">
            <p className="text-2xl font-black text-grafito-900 dark:text-white">{v as number}</p>
            <p className="text-xs text-grafito-500 mt-0.5">{l as string}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLS.map((col) => {
            const list = byStatus(col.key)
            return (
              <div key={col.key} className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-grafito-50/50 dark:bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className={cn('text-xs font-bold uppercase tracking-wider', col.accent)}>{col.label}</p>
                  <span className="text-xs font-semibold text-grafito-400">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((d) => (
                    <div key={d.id} className="rounded-xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-grafito-900 dark:text-white">{d.customer_name}</p>
                        <span className="text-sm font-bold text-grafito-800 dark:text-grafito-100 shrink-0">{formatCurrency(Number(d.total) + Number(d.fee), 'COP')}</span>
                      </div>
                      <p className="text-xs text-grafito-500 flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5 shrink-0" />{d.address}</p>
                      <select value={d.courier_id ?? ''} onChange={(e) => assign.mutate({ d, courierId: e.target.value })} className="w-full text-xs px-2 py-1 rounded-lg border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-700 dark:text-grafito-200">
                        <option value="">Sin repartidor</option>
                        {couriers.filter((c) => c.is_active || c.id === d.courier_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        {d.customer_phone && <a href={waLink(d)} target="_blank" rel="noreferrer" title="WhatsApp" className="rounded-lg p-1.5 text-grafito-400 hover:text-emerald-500 hover:bg-emerald-500/10"><MessageCircle className="h-3.5 w-3.5" /></a>}
                        {d.customer_phone && <a href={`tel:${d.customer_phone}`} title="Llamar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Phone className="h-3.5 w-3.5" /></a>}
                        <div className="flex-1" />
                        {d.status !== 'CANCELLED' && d.status !== 'DELIVERED' && <button onClick={() => advance.mutate({ id: d.id, s: 'CANCELLED' })} title="Cancelar" className="rounded-lg p-1.5 text-grafito-400 hover:text-rose-500 hover:bg-rose-500/10"><XCircle className="h-3.5 w-3.5" /></button>}
                        {NEXT[d.status] && <button onClick={() => advance.mutate({ id: d.id, s: NEXT[d.status]! })} className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-600">{COLS.find((c) => c.key === NEXT[d.status])?.label}<ChevronRight className="h-3 w-3" /></button>}
                        {d.status === 'DELIVERED' && <button onClick={() => remove.mutate(d.id)} title="Eliminar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && <p className="text-xs text-grafito-300 dark:text-grafito-600 text-center py-6">—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && tenantId && <DeliveryModal tenantId={tenantId} couriers={couriers} branchId={branchId ?? null} onClose={() => setModal(false)} />}
      {couriersModal && tenantId && <CouriersModal tenantId={tenantId} couriers={couriers} onClose={() => setCouriersModal(false)} />}
    </div>
  )
}
