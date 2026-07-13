import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Tags, Plus, Loader2, X, Pencil, Trash2, ListTree } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getPriceLists, createPriceList, updatePriceList, deletePriceList,
  getPriceListItems, upsertPriceListItem, deletePriceListItem, getProducts,
  type PriceListRow, type PriceListType,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

const TYPE_LABEL: Record<PriceListType, string> = { CUSTOMER: 'Por cliente', CHANNEL: 'Por canal', VOLUME: 'Por volumen' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function ListModal({ tenantId, editing, onClose }: { tenantId: string; editing: PriceListRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<PriceListType>(editing?.list_type ?? 'CUSTOMER')
  const [desc, setDesc] = useState(editing?.description ?? '')

  const save = useMutation({
    mutationFn: () => editing
      ? updatePriceList(tenantId, editing.id, { name: name.trim(), list_type: type, description: desc.trim() || null })
      : createPriceList(tenantId, { name: name.trim(), list_type: type, description: desc.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-lists', tenantId] }); toast.success(editing ? 'Lista actualizada' : 'Lista creada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar lista' : 'Nueva lista de precios'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mayoristas, VIP, Canal online…" className={inputCls} /></Field>
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value as PriceListType)} className={inputCls}>
              {(Object.keys(TYPE_LABEL) as PriceListType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Descripción (opcional)"><input value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} /></Field>
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

function ItemsModal({ tenantId, list, onClose }: { tenantId: string; list: PriceListRow; onClose: () => void }) {
  const qc = useQueryClient()
  const [productId, setProductId] = useState('')
  const [minQty, setMinQty] = useState('1')
  const [price, setPrice] = useState('')

  const { data: items = [] } = useQuery({ queryKey: ['price-list-items', list.id], queryFn: () => getPriceListItems(tenantId, list.id), enabled: !!tenantId })
  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId), enabled: !!tenantId })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['price-list-items', list.id] })
  const add = useMutation({
    mutationFn: () => upsertPriceListItem(tenantId, list.id, { product_id: productId, min_qty: Number(minQty) || 1, price: Number(price) || 0 }),
    onSuccess: () => { invalidate(); setProductId(''); setMinQty('1'); setPrice(''); toast.success('Precio guardado') },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })
  const del = useMutation({ mutationFn: (id: string) => deletePriceListItem(tenantId, id), onSuccess: invalidate })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-base font-bold text-grafito-900 dark:text-white">{list.name}</h3>
            <p className="text-xs text-grafito-400">{TYPE_LABEL[list.list_type]} · {items.length} precio{items.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        {/* Agregar precio */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end rounded-xl bg-grafito-50 dark:bg-white/5 p-3">
          <Field label="Producto">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
              <option value="">Selecciona…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          {list.list_type === 'VOLUME'
            ? <Field label="Cant. mín."><input type="number" min={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} className={inputCls} /></Field>
            : <div className="hidden sm:block" />}
          <Field label="Precio"><input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} /></Field>
          <button onClick={() => add.mutate()} disabled={!productId || !price || add.isPending} className="inline-flex items-center justify-center gap-1 rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>

        {/* Lista de precios */}
        <div className="mt-4 rounded-xl border border-grafito-200 dark:border-white/5 overflow-hidden">
          {items.length === 0 ? (
            <p className="text-sm text-grafito-400 text-center py-8">Sin precios definidos.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
                <th className="px-4 py-2">Producto</th>{list.list_type === 'VOLUME' && <th className="px-4 py-2">Desde</th>}<th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2" />
              </tr></thead>
              <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-2 text-grafito-800 dark:text-grafito-100">{it.products?.name ?? it.product_id}</td>
                    {list.list_type === 'VOLUME' && <td className="px-4 py-2 text-grafito-500">{it.min_qty}</td>}
                    <td className="px-4 py-2 text-right font-semibold text-grafito-900 dark:text-white">{formatCurrency(Number(it.price), 'COP')}</td>
                    <td className="px-4 py-2 text-right"><button onClick={() => del.mutate(it.id)} className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PriceListsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ editing: PriceListRow | null } | null>(null)
  const [items, setItems] = useState<PriceListRow | null>(null)

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['price-lists', tenantId],
    queryFn: () => getPriceLists(tenantId!),
    enabled: !!tenantId,
  })

  const del = useMutation({
    mutationFn: (id: string) => deletePriceList(tenantId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-lists', tenantId] }); toast.success('Lista eliminada') },
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Tags className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Listas de Precios</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Precios por cliente, canal o volumen.</p>
          </div>
        </div>
        <button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nueva lista
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400 rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60"><Tags className="h-8 w-8" /><p className="text-sm">Aún no hay listas de precios.</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <div key={l.id} className={cn('rounded-2xl border p-5 bg-white dark:bg-grafito-900/60', l.is_active ? 'border-grafito-200 dark:border-white/5' : 'border-dashed border-grafito-300 dark:border-white/10 opacity-60')}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-grafito-900 dark:text-white">{l.name}</h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-500">{TYPE_LABEL[l.list_type]}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModal({ editing: l })} title="Editar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm(`¿Eliminar "${l.name}"?`)) del.mutate(l.id) }} title="Eliminar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {l.description && <p className="text-xs text-grafito-500 mt-2">{l.description}</p>}
              <button onClick={() => setItems(l)} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 py-2 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">
                <ListTree className="h-4 w-4" /> Gestionar precios
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && tenantId && <ListModal tenantId={tenantId} editing={modal.editing} onClose={() => setModal(null)} />}
      {items && tenantId && <ItemsModal tenantId={tenantId} list={items} onClose={() => setItems(null)} />}
    </div>
  )
}
