import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ruler, Plus, Loader2, Trash2, Search } from 'lucide-react'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getProducts, getProductUnits, upsertProductUnit, deleteProductUnit,
  type ProductRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

function UnitsPanel({ tenantId, product }: { tenantId: string; product: ProductRow }) {
  const qc = useQueryClient()
  const [unitName, setUnitName] = useState('')
  const [factor, setFactor] = useState('1')
  const [price, setPrice] = useState('')

  const { data: units = [], isLoading } = useQuery({ queryKey: ['product-units', product.id], queryFn: () => getProductUnits(tenantId, product.id), enabled: !!tenantId })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['product-units', product.id] })

  const add = useMutation({
    mutationFn: () => upsertProductUnit(tenantId, product.id, { unit_name: unitName.trim(), factor: Number(factor) || 1, price: price ? Number(price) : null }),
    onSuccess: () => { invalidate(); setUnitName(''); setFactor('1'); setPrice(''); toast.success('Unidad guardada') },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })
  const del = useMutation({ mutationFn: (id: string) => deleteProductUnit(tenantId, id), onSuccess: invalidate })

  return (
    <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5">
      <div className="mb-3">
        <h3 className="font-bold text-grafito-900 dark:text-white">{product.name}</h3>
        <p className="text-xs text-grafito-400">Precio base: {formatCurrency(Number(product.price ?? 0), 'COP')} · Define unidades de venta (metro, bulto, docena…)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_auto] gap-2 items-end rounded-xl bg-grafito-50 dark:bg-white/5 p-3">
        <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Unidad</label><input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="Metro, Bulto…" className={inputCls} /></div>
        <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Factor (× base)</label><input type="number" min={0} step="0.0001" value={factor} onChange={(e) => setFactor(e.target.value)} className={inputCls} /></div>
        <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Precio (opcional)</label><input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} /></div>
        <button onClick={() => add.mutate()} disabled={!unitName.trim() || add.isPending} className="inline-flex items-center justify-center gap-1 rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-grafito-200 dark:border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-grafito-400" /></div>
        ) : units.length === 0 ? (
          <p className="text-sm text-grafito-400 text-center py-8">Sin unidades. La base es la unidad del producto.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-2">Unidad</th><th className="px-4 py-2 text-right">Factor</th><th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium text-grafito-800 dark:text-grafito-100">{u.unit_name}</td>
                  <td className="px-4 py-2 text-right text-grafito-500">{Number(u.factor)}</td>
                  <td className="px-4 py-2 text-right text-grafito-700 dark:text-grafito-200">{u.price != null ? formatCurrency(Number(u.price), 'COP') : '—'}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => del.mutate(u.id)} className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function UnitConversionPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ProductRow | null>(null)

  const { data: products = [], isLoading } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId!), enabled: !!tenantId })
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)) : products
  }, [products, search])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><Ruler className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Conversión de Unidades</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Vende por metro, vara, bulto o fracción.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-grafito-100 dark:border-white/5 px-3 py-2.5">
            <Search className="h-4 w-4 text-grafito-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…" className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400" />
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-grafito-100 dark:divide-white/5">
            {isLoading ? (
              <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-grafito-400" /></div>
            ) : filtered.map((p) => (
              <button key={p.id} onClick={() => setSelected(p)} className={`w-full text-left px-4 py-3 text-sm hover:bg-grafito-50 dark:hover:bg-white/5 ${selected?.id === p.id ? 'bg-brand-500/10 text-brand-500 font-semibold' : 'text-grafito-700 dark:text-grafito-200'}`}>
                {p.name}<span className="block text-[11px] text-grafito-400 font-mono">{p.sku}</span>
              </button>
            ))}
          </div>
        </div>

        {selected && tenantId
          ? <UnitsPanel tenantId={tenantId} product={selected} />
          : <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400 rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60"><Ruler className="h-8 w-8" /><p className="text-sm">Selecciona un producto para definir sus unidades.</p></div>}
      </div>
    </div>
  )
}
