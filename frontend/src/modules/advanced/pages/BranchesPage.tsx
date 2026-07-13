import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, Plus, Pencil, Trash2, Loader2, X, Power, Star } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { getBranches, createBranch, updateBranch, toggleBranchActive, deleteBranch, type BranchAdminRow, type BranchInput } from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function BranchModal({ tenantId, editing, onClose }: { tenantId: string; editing: BranchAdminRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(editing?.name ?? '')
  const [code, setCode] = useState(editing?.code ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')
  const [email, setEmail] = useState(editing?.email ?? '')
  const [city, setCity] = useState(editing?.address?.city ?? '')
  const [dept, setDept] = useState(editing?.address?.department ?? '')
  const [street, setStreet] = useState(editing?.address?.street ?? '')

  const save = useMutation({
    mutationFn: () => {
      const addr = { street: street.trim(), city: city.trim(), department: dept.trim() }
      const hasAddr = addr.street || addr.city || addr.department
      const input: BranchInput = { name: name.trim(), code: code.trim().toUpperCase(), phone: phone.trim() || null, email: email.trim() || null, address: hasAddr ? addr : null }
      return editing ? updateBranch(tenantId, editing.id, input) : createBranch(tenantId, input)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches', tenantId] }); toast.success(editing ? 'Sucursal actualizada' : 'Sucursal creada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar (¿código repetido?)'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar sucursal' : 'Nueva sucursal'}</h3><button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sucursal Norte" className={inputCls} /></Field>
          <Field label="Código"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="NORTE" className={cn(inputCls, 'font-mono uppercase')} /></Field>
          <Field label="Teléfono"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Field>
          <Field label="Correo"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
          <Field label="Ciudad"><input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} /></Field>
          <Field label="Departamento"><input value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls} /></Field>
          <div className="sm:col-span-2"><Field label="Dirección"><input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} /></Field></div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!name.trim() || !code.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar</button>
        </div>
      </div>
    </div>
  )
}

export default function BranchesPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ editing: BranchAdminRow | null } | null>(null)

  const { data: branches = [], isLoading } = useQuery({ queryKey: ['branches', tenantId], queryFn: () => getBranches(tenantId!), enabled: !!tenantId })
  const toggle = useMutation({ mutationFn: (b: BranchAdminRow) => toggleBranchActive(tenantId!, b.id, !b.is_active), onSuccess: () => qc.invalidateQueries({ queryKey: ['branches', tenantId] }) })
  const remove = useMutation({ mutationFn: (id: string) => deleteBranch(tenantId!, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches', tenantId] }); toast.success('Sucursal eliminada') } })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Building2 className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Multi-Sucursal</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Gestión centralizada de tus sucursales.</p>
          </div>
        </div>
        <button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Nueva sucursal</button>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5"><th className="px-4 py-3">Sucursal</th><th className="px-4 py-3">Código</th><th className="px-4 py-3">Ciudad</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {branches.map((b) => (
                <tr key={b.id} className={cn('hover:bg-grafito-50 dark:hover:bg-white/5', !b.is_active && 'opacity-50')}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-grafito-900 dark:text-white flex items-center gap-1.5">{b.name}{b.is_main && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-400 font-bold"><Star className="h-2.5 w-2.5" /> Principal</span>}</p>
                    {(b.phone || b.email) && <p className="text-xs text-grafito-400">{[b.phone, b.email].filter(Boolean).join(' · ')}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-grafito-500">{b.code}</td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{b.address?.city ?? '—'}</td>
                  <td className="px-4 py-3"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', b.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-grafito-200 dark:bg-white/10 text-grafito-500')}>{b.is_active ? 'Activa' : 'Inactiva'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggle.mutate(b)} disabled={b.is_main} title={b.is_active ? 'Desactivar' : 'Activar'} className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10 disabled:opacity-30"><Power className="h-4 w-4" /></button>
                      <button onClick={() => setModal({ editing: b })} title="Editar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`¿Eliminar "${b.name}"?`)) remove.mutate(b.id) }} disabled={b.is_main} title={b.is_main ? 'No puedes eliminar la principal' : 'Eliminar'} className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && tenantId && <BranchModal tenantId={tenantId} editing={modal.editing} onClose={() => setModal(null)} />}
    </div>
  )
}
