import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Boxes, Plus, Loader2, X, Trash2, Layers } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getAssemblies, createAssembly, deleteAssembly, getProducts,
  type AssemblyRow, type AssemblyComponentInput,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

type Draft = AssemblyComponentInput & { key: number }

function CreateModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [comps, setComps] = useState<Draft[]>([{ key: 1, component_product_id: null, description: '', quantity: 1 }])

  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId), enabled: !!tenantId })

  const setComp = (key: number, patch: Partial<Draft>) => setComps((a) => a.map((c) => c.key === key ? { ...c, ...patch } : c))
  const addRow = () => setComps((a) => [...a, { key: Date.now(), component_product_id: null, description: '', quantity: 1 }])
  const delRow = (key: number) => setComps((a) => a.filter((c) => c.key !== key))
  const onPick = (key: number, pid: string) => { const p = products.find((x) => x.id === pid); setComp(key, { component_product_id: pid || null, description: p?.name ?? '' }) }
  const valid = name.trim() && comps.some((c) => c.component_product_id || c.description?.trim())

  const save = useMutation({
    mutationFn: () => createAssembly(
      tenantId,
      { name: name.trim(), sale_price: Number(price) || 0, notes: notes.trim() || null },
      comps.filter((c) => c.component_product_id || c.description?.trim()).map(({ component_product_id, description, quantity }) => ({ component_product_id, description: description?.trim() || null, quantity: Number(quantity) })),
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assemblies', tenantId] }); toast.success('Kit creado'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Nuevo ensamble / kit</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nombre del kit"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kit instalación baño" className={inputCls} /></Field></div>
          <Field label="Precio de venta"><input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} /></Field>
          <Field label="Notas"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-grafito-400">Componentes</p>
            <button onClick={addRow} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600"><Plus className="h-3.5 w-3.5" /> Agregar</button>
          </div>
          <div className="space-y-2">
            {comps.map((c) => (
              <div key={c.key} className="grid grid-cols-1 sm:grid-cols-[2fr_1.4fr_0.7fr_auto] gap-2 items-center">
                <select value={c.component_product_id ?? ''} onChange={(e) => onPick(c.key, e.target.value)} className={inputCls}>
                  <option value="">Producto / libre…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={c.description ?? ''} onChange={(e) => setComp(c.key, { description: e.target.value })} placeholder="Descripción" className={inputCls} />
                <input type="number" min={0} value={c.quantity} onChange={(e) => setComp(c.key, { quantity: Number(e.target.value) })} placeholder="Cant." className={inputCls} />
                <button onClick={() => delRow(c.key)} className="rounded-lg p-2 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!valid || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AssembliesPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [create, setCreate] = useState(false)

  const { data: kits = [], isLoading } = useQuery({ queryKey: ['assemblies', tenantId], queryFn: () => getAssemblies(tenantId!), enabled: !!tenantId })

  const del = useMutation({
    mutationFn: (id: string) => deleteAssembly(tenantId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assemblies', tenantId] }); toast.success('Kit eliminado') },
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Layers className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Ensambles y Kits</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Arma productos desde componentes.</p>
          </div>
        </div>
        <button onClick={() => setCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nuevo kit
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
      ) : kits.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400 rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60"><Boxes className="h-8 w-8" /><p className="text-sm">Aún no hay kits definidos.</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((k) => (
            <div key={k.id} className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-grafito-900 dark:text-white">{k.name}</h3>
                  <p className="text-lg font-black text-brand-500 mt-1">{formatCurrency(Number(k.sale_price), 'COP')}</p>
                </div>
                <button onClick={() => { if (confirm(`¿Eliminar "${k.name}"?`)) del.mutate(k.id) }} className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-grafito-400">{k.assembly_components?.length ?? 0} componentes</p>
                {(k.assembly_components ?? []).slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs text-grafito-600 dark:text-grafito-300">
                    <span className="truncate">{c.products?.name ?? c.description ?? '—'}</span>
                    <span className="text-grafito-400 shrink-0">× {Number(c.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {create && tenantId && <CreateModal tenantId={tenantId} onClose={() => setCreate(false)} />}
    </div>
  )
}
