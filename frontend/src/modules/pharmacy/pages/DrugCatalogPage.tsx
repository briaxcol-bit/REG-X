import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pill, Search, Plus, Pencil, Trash2, Loader2, X, ShieldCheck } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import {
  getDrugs, createDrug, updateDrug, deleteDrug, toggleDrugActive,
  type DrugRow, type DrugInput,
} from '@lib/db'

const FORMS = ['Tableta', 'Cápsula', 'Jarabe', 'Suspensión', 'Inyectable', 'Crema/Ungüento', 'Gotas', 'Otro']
const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function DrugModal({ tenantId, editing, onClose }: { tenantId: string; editing: DrugRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(editing?.name ?? '')
  const [ingredient, setIngredient] = useState(editing?.active_ingredient ?? '')
  const [conc, setConc] = useState(editing?.concentration ?? '')
  const [form, setForm] = useState(editing?.pharma_form ?? '')
  const [invima, setInvima] = useState(editing?.invima_reg ?? '')
  const [atc, setAtc] = useState(editing?.atc_code ?? '')
  const [rx, setRx] = useState(editing?.requires_prescription ?? false)
  const [notes, setNotes] = useState(editing?.notes ?? '')

  const save = useMutation({
    mutationFn: () => {
      const input: DrugInput = {
        name: name.trim(), active_ingredient: ingredient.trim() || null, concentration: conc.trim() || null,
        pharma_form: form || null, invima_reg: invima.trim() || null, atc_code: atc.trim() || null,
        requires_prescription: rx, notes: notes.trim() || null,
      }
      return editing ? updateDrug(tenantId, editing.id, input) : createDrug(tenantId, input)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drugs', tenantId] }); toast.success(editing ? 'Medicamento actualizado' : 'Medicamento creado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar medicamento' : 'Nuevo medicamento'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nombre comercial"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dolex Forte" className={inputCls} /></Field></div>
          <Field label="Principio activo"><input value={ingredient} onChange={(e) => setIngredient(e.target.value)} placeholder="Acetaminofén" className={inputCls} /></Field>
          <Field label="Concentración"><input value={conc} onChange={(e) => setConc(e.target.value)} placeholder="500 mg" className={inputCls} /></Field>
          <Field label="Forma farmacéutica">
            <select value={form} onChange={(e) => setForm(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Registro INVIMA"><input value={invima} onChange={(e) => setInvima(e.target.value)} placeholder="INVIMA 2020M-000000" className={inputCls} /></Field>
          <Field label="Código ATC"><input value={atc} onChange={(e) => setAtc(e.target.value)} placeholder="N02BE01" className={inputCls} /></Field>
          <div className="flex items-end">
            <button type="button" onClick={() => setRx(!rx)} className="flex items-center gap-2 text-sm font-semibold text-grafito-700 dark:text-grafito-200">
              <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', rx ? 'bg-brand-500' : 'bg-grafito-300 dark:bg-white/10')}>
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', rx ? 'left-[22px]' : 'left-0.5')} />
              </span>
              Requiere receta
            </button>
          </div>
          <div className="sm:col-span-2"><Field label="Notas"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {editing ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DrugCatalogPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ editing: DrugRow | null } | null>(null)

  const { data: drugs = [], isLoading } = useQuery({
    queryKey: ['drugs', tenantId],
    queryFn: () => getDrugs(tenantId!, { includeInactive: true }),
    enabled: !!tenantId,
  })
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return drugs
    return drugs.filter((d) => d.name.toLowerCase().includes(q) || d.active_ingredient?.toLowerCase().includes(q) || d.invima_reg?.toLowerCase().includes(q))
  }, [drugs, search])

  const toggle = useMutation({ mutationFn: (d: DrugRow) => toggleDrugActive(tenantId!, d.id, !d.is_active), onSuccess: () => qc.invalidateQueries({ queryKey: ['drugs', tenantId] }) })
  const remove = useMutation({ mutationFn: (id: string) => deleteDrug(tenantId!, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['drugs', tenantId] }); toast.success('Medicamento eliminado') } })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Pill className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Catálogo de Medicamentos</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Principios activos y registros INVIMA.</p>
          </div>
        </div>
        <button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nuevo medicamento
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-grafito-900/60 border border-grafito-200 dark:border-white/5 px-3 py-2.5 max-w-md">
        <Search className="h-4 w-4 text-grafito-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, principio activo o INVIMA…" className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400" />
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Pill className="h-8 w-8" /><p className="text-sm">Aún no hay medicamentos en el catálogo.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[820px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Medicamento</th><th className="px-4 py-3">Concentración</th><th className="px-4 py-3">INVIMA</th><th className="px-4 py-3">Receta</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {filtered.map((d) => (
                <tr key={d.id} className={cn('hover:bg-grafito-50 dark:hover:bg-white/5', !d.is_active && 'opacity-50')}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-grafito-900 dark:text-white">{d.name}</p>
                    <p className="text-xs text-grafito-400">{d.active_ingredient ?? '—'}{d.pharma_form ? ` · ${d.pharma_form}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{d.concentration ?? '—'}</td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300 font-mono text-xs">{d.invima_reg ?? '—'}</td>
                  <td className="px-4 py-3">{d.requires_prescription ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400/10 text-amber-600 dark:text-amber-400"><ShieldCheck className="h-3 w-3" /> Sí</span> : <span className="text-grafito-400 text-xs">Libre</span>}</td>
                  <td className="px-4 py-3"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', d.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-grafito-200 dark:bg-white/10 text-grafito-500')}>{d.is_active ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggle.mutate(d)} title={d.is_active ? 'Desactivar' : 'Activar'} className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><ShieldCheck className="h-4 w-4" /></button>
                      <button onClick={() => setModal({ editing: d })} title="Editar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`¿Eliminar "${d.name}"?`)) remove.mutate(d.id) }} title="Eliminar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && tenantId && <DrugModal tenantId={tenantId} editing={modal.editing} onClose={() => setModal(null)} />}
    </div>
  )
}
