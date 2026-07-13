import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Stethoscope, Plus, Loader2, X, Trash2 } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import {
  getPrescriptions, createPrescription, updatePrescriptionStatus,
  getDrugs, getCustomers,
  type PrescriptionRow, type PrescriptionStatus, type PrescriptionItemInput,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

const STATUS: Record<PrescriptionStatus, { label: string; cls: string }> = {
  DRAFT:     { label: 'Registrada', cls: 'bg-grafito-200 dark:bg-white/10 text-grafito-500' },
  VALIDATED: { label: 'Validada',   cls: 'bg-blue-500/10 text-blue-500' },
  DISPENSED: { label: 'Dispensada', cls: 'bg-emerald-500/10 text-emerald-500' },
  CANCELLED: { label: 'Anulada',    cls: 'bg-red-500/10 text-red-500' },
}
const NEXT: Partial<Record<PrescriptionStatus, { to: PrescriptionStatus; label: string }>> = {
  DRAFT:     { to: 'VALIDATED', label: 'Validar' },
  VALIDATED: { to: 'DISPENSED', label: 'Dispensar' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

type Draft = PrescriptionItemInput & { key: number }

function CreateModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [patient, setPatient] = useState('')
  const [doctor, setDoctor] = useState('')
  const [license, setLicense] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [customerId, setCustomerId] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [items, setItems] = useState<Draft[]>([{ key: 1, description: '', dosage: '', quantity: 1, drug_id: null }])

  const { data: drugs = [] } = useQuery({ queryKey: ['drugs', tenantId], queryFn: () => getDrugs(tenantId), enabled: !!tenantId })
  const { data: customers = [] } = useQuery({ queryKey: ['customers', tenantId], queryFn: () => getCustomers(tenantId), enabled: !!tenantId })

  const setItem = (key: number, patch: Partial<Draft>) => setItems((arr) => arr.map((i) => i.key === key ? { ...i, ...patch } : i))
  const addRow = () => setItems((arr) => [...arr, { key: Date.now(), description: '', dosage: '', quantity: 1, drug_id: null }])
  const delRow = (key: number) => setItems((arr) => arr.filter((i) => i.key !== key))
  const onPickDrug = (key: number, id: string) => {
    const d = drugs.find((x) => x.id === id)
    setItem(key, { drug_id: id || null, description: d ? `${d.name}${d.concentration ? ' ' + d.concentration : ''}` : '' })
  }
  const valid = patient.trim() && items.some((i) => i.description.trim())

  const save = useMutation({
    mutationFn: () => createPrescription(
      tenantId,
      { patient_name: patient.trim(), doctor_name: doctor.trim() || null, doctor_license: license.trim() || null, prescription_date: date, customer_id: customerId || null, diagnosis: diagnosis.trim() || null },
      items.filter((i) => i.description.trim()).map(({ description, dosage, quantity, drug_id }) => ({ description: description.trim(), dosage: dosage?.trim() || null, quantity: Number(quantity), drug_id })),
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prescriptions', tenantId] }); toast.success('Receta registrada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Nueva receta médica</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paciente"><input value={patient} onChange={(e) => setPatient(e.target.value)} className={inputCls} /></Field>
          <Field label="Cliente asociado (opcional)">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
              <option value="">— Ninguno —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </Field>
          <Field label="Médico"><input value={doctor} onChange={(e) => setDoctor(e.target.value)} className={inputCls} /></Field>
          <Field label="Registro médico"><input value={license} onChange={(e) => setLicense(e.target.value)} className={inputCls} /></Field>
          <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
          <Field label="Diagnóstico (opcional)"><input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputCls} /></Field>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-grafito-400">Medicamentos</p>
            <button onClick={addRow} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600"><Plus className="h-3.5 w-3.5" /> Agregar</button>
          </div>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.key} className="grid grid-cols-1 sm:grid-cols-[1.6fr_1.6fr_1.4fr_0.6fr_auto] gap-2 items-center">
                <select value={it.drug_id ?? ''} onChange={(e) => onPickDrug(it.key, e.target.value)} className={inputCls}>
                  <option value="">Del catálogo / libre…</option>
                  {drugs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <input value={it.description} onChange={(e) => setItem(it.key, { description: e.target.value })} placeholder="Medicamento" className={inputCls} />
                <input value={it.dosage ?? ''} onChange={(e) => setItem(it.key, { dosage: e.target.value })} placeholder="Posología (1 c/8h)" className={inputCls} />
                <input type="number" min={1} value={it.quantity} onChange={(e) => setItem(it.key, { quantity: Number(e.target.value) })} placeholder="Cant." className={inputCls} />
                <button onClick={() => delRow(it.key)} className="rounded-lg p-2 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!valid || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PrescriptionsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [create, setCreate] = useState(false)

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ['prescriptions', tenantId],
    queryFn: () => getPrescriptions(tenantId!),
    enabled: !!tenantId,
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PrescriptionStatus }) => updatePrescriptionStatus(tenantId!, id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prescriptions', tenantId] }); toast.success('Estado actualizado') },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo actualizar'),
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Stethoscope className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Recetas Médicas</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Registro y validación de recetas.</p>
          </div>
        </div>
        <button onClick={() => setCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nueva receta
        </button>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : prescriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Stethoscope className="h-8 w-8" /><p className="text-sm">Aún no hay recetas registradas.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[820px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Médico</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {prescriptions.map((p) => {
                const next = NEXT[p.status]
                return (
                  <tr key={p.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-mono font-semibold text-grafito-900 dark:text-white">{p.code}</td>
                    <td className="px-4 py-3 text-grafito-800 dark:text-grafito-100">{p.patient_name}</td>
                    <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{p.doctor_name ?? '—'}{p.doctor_license ? ` · ${p.doctor_license}` : ''}</td>
                    <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300 whitespace-nowrap">{new Date(p.prescription_date + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', STATUS[p.status].cls)}>{STATUS[p.status].label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {next && (
                          <button onClick={() => setStatus.mutate({ id: p.id, status: next.to })} className="rounded-lg px-2.5 py-1 text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600">{next.label}</button>
                        )}
                        {(p.status === 'DRAFT' || p.status === 'VALIDATED') && (
                          <button onClick={() => { if (confirm(`¿Anular la receta ${p.code}?`)) setStatus.mutate({ id: p.id, status: 'CANCELLED' }) }} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10">Anular</button>
                        )}
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
    </div>
  )
}
