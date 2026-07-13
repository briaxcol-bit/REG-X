import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Tag, Plus, Loader2, X, Pencil, Trash2, Power, Percent, BadgeDollarSign, Copy, Boxes } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getPromotions, savePromotion, togglePromotion, deletePromotion, getCategories, getProducts,
  type PromotionRow, type PromotionType, type PromotionScope, type CategoryRow, type ProductRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none'

const TYPES: { key: PromotionType; label: string; Icon: any }[] = [
  { key: 'PERCENT', label: 'Descuento %', Icon: Percent },
  { key: 'FIXED',   label: 'Monto fijo',  Icon: BadgeDollarSign },
  { key: 'BOGO',    label: '2x1',         Icon: Copy },
  { key: 'COMBO',   label: 'Combo',       Icon: Boxes },
]
const typeLabel = (t: PromotionType) => TYPES.find((x) => x.key === t)?.label ?? t

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function PromoModal({ tenantId, categories, products, editing, onClose }: {
  tenantId: string; categories: CategoryRow[]; products: ProductRow[]; editing: PromotionRow | null; onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName]   = useState(editing?.name ?? '')
  const [type, setType]   = useState<PromotionType>(editing?.type ?? 'PERCENT')
  const [value, setValue] = useState(editing ? String(editing.value) : '')
  const [scope, setScope] = useState<PromotionScope>(editing?.scope ?? 'ALL')
  const [catId, setCatId] = useState(editing?.category_id ?? '')
  const [prodId, setProdId] = useState(editing?.product_id ?? '')
  const [minQty, setMinQty] = useState(String(editing?.min_qty ?? 2))
  const [starts, setStarts] = useState(editing?.starts_at ?? '')
  const [ends, setEnds]     = useState(editing?.ends_at ?? '')

  const needsValue = type === 'PERCENT' || type === 'FIXED' || type === 'COMBO'
  const needsQty = type === 'BOGO' || type === 'COMBO'
  const valueLabel = type === 'PERCENT' ? 'Porcentaje (%)' : type === 'COMBO' ? 'Precio del combo' : 'Monto de descuento'

  const save = useMutation({
    mutationFn: () => savePromotion(tenantId, {
      name: name.trim(), type, value: Number(value) || 0, scope,
      category_id: scope === 'CATEGORY' ? (catId || null) : null,
      product_id: scope === 'PRODUCT' ? (prodId || null) : null,
      min_qty: needsQty ? (Number(minQty) || 2) : 1,
      starts_at: starts || null, ends_at: ends || null,
    }, editing?.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions', tenantId] }); toast.success(editing ? 'Promoción actualizada' : 'Promoción creada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar promoción' : 'Nueva promoción'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Happy hour, 2x1 cervezas…" /></Field>

          <Field label="Tipo">
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map((t) => (
                <button key={t.key} onClick={() => setType(t.key)} className={cn('flex flex-col items-center gap-1 rounded-xl border py-2 text-xs font-semibold transition-colors', type === t.key ? 'border-brand-500 bg-brand-500/5 text-brand-600 dark:text-brand-300' : 'border-grafito-200 dark:border-white/10 text-grafito-500 hover:bg-grafito-50 dark:hover:bg-white/5')}>
                  <t.Icon className="h-4 w-4" /> {t.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {needsValue && <Field label={valueLabel}><input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} className={inputCls} inputMode="numeric" /></Field>}
            {needsQty && <Field label={type === 'BOGO' ? 'Lleva N (paga N-1)' : 'Cantidad del combo'}><input value={minQty} onChange={(e) => setMinQty(e.target.value.replace(/\D/g, ''))} className={inputCls} inputMode="numeric" /></Field>}
          </div>

          <Field label="Aplica a">
            <select value={scope} onChange={(e) => setScope(e.target.value as PromotionScope)} className={inputCls}>
              <option value="ALL">Todo el catálogo</option>
              <option value="CATEGORY">Una categoría</option>
              <option value="PRODUCT">Un producto</option>
            </select>
          </Field>
          {scope === 'CATEGORY' && <Field label="Categoría"><select value={catId} onChange={(e) => setCatId(e.target.value)} className={inputCls}><option value="">Selecciona…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
          {scope === 'PRODUCT' && <Field label="Producto"><select value={prodId} onChange={(e) => setProdId(e.target.value)} className={inputCls}><option value="">Selecciona…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde (opcional)"><input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} className={inputCls} /></Field>
            <Field label="Hasta (opcional)"><input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className={inputCls} /></Field>
          </div>
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

export default function PromotionsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ editing: PromotionRow | null } | null>(null)

  const { data: promos = [], isLoading } = useQuery({ queryKey: ['promotions', tenantId], queryFn: () => getPromotions(tenantId!), enabled: !!tenantId })
  const { data: categories = [] } = useQuery({ queryKey: ['categories', tenantId], queryFn: () => getCategories(tenantId!), enabled: !!tenantId })
  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId!, { status: 'ACTIVE' }), enabled: !!tenantId })

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name
  const prodName = (id: string | null) => products.find((p) => p.id === id)?.name

  const toggle = useMutation({ mutationFn: (p: PromotionRow) => togglePromotion(tenantId!, p.id, !p.is_active), onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions', tenantId] }) })
  const remove = useMutation({ mutationFn: (id: string) => deletePromotion(tenantId!, id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions', tenantId] }); toast.success('Promoción eliminada') } })

  const active = useMemo(() => promos.filter((p) => p.is_active).length, [promos])

  const valueText = (p: PromotionRow) =>
    p.type === 'PERCENT' ? `${p.value}%` :
    p.type === 'FIXED'   ? `- ${formatCurrency(Number(p.value), 'COP')}` :
    p.type === 'BOGO'    ? `${p.min_qty}x${p.min_qty - 1}` :
    formatCurrency(Number(p.value), 'COP')

  const scopeText = (p: PromotionRow) =>
    p.scope === 'ALL' ? 'Todo el catálogo' :
    p.scope === 'CATEGORY' ? (catName(p.category_id) ?? 'Categoría') :
    (prodName(p.product_id) ?? 'Producto')

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Tag className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Promociones y Descuentos</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Combos, 2x1 y descuentos. {active} activa{active !== 1 ? 's' : ''}.</p>
          </div>
        </div>
        <button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Nueva promoción</button>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : promos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Tag className="h-8 w-8" /><p className="text-sm">Aún no hay promociones. Crea la primera.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
                <th className="px-4 py-3">Promoción</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Aplica a</th><th className="px-4 py-3">Vigencia</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {promos.map((p) => (
                <tr key={p.id} className={cn('hover:bg-grafito-50 dark:hover:bg-white/5', !p.is_active && 'opacity-50')}>
                  <td className="px-4 py-3 font-semibold text-grafito-900 dark:text-white">{p.name}</td>
                  <td className="px-4 py-3"><span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-grafito-100 dark:bg-white/10 text-grafito-600 dark:text-grafito-300">{typeLabel(p.type)}</span></td>
                  <td className="px-4 py-3 font-medium text-brand-600 dark:text-brand-400">{valueText(p)}</td>
                  <td className="px-4 py-3 text-grafito-600 dark:text-grafito-300">{scopeText(p)}</td>
                  <td className="px-4 py-3 text-xs text-grafito-400">{p.starts_at || p.ends_at ? `${p.starts_at ?? '…'} → ${p.ends_at ?? '…'}` : 'Siempre'}</td>
                  <td className="px-4 py-3"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', p.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-grafito-200 dark:bg-white/10 text-grafito-500')}>{p.is_active ? 'Activa' : 'Inactiva'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggle.mutate(p)} title={p.is_active ? 'Desactivar' : 'Activar'} className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Power className="h-4 w-4" /></button>
                      <button onClick={() => setModal({ editing: p })} title="Editar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`¿Eliminar "${p.name}"?`)) remove.mutate(p.id) }} title="Eliminar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && tenantId && <PromoModal tenantId={tenantId} categories={categories} products={products} editing={modal.editing} onClose={() => setModal(null)} />}
    </div>
  )
}
