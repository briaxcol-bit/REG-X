import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Beer, Plus, Loader2, X, Trash2, Minus, Receipt, CheckCircle2, Search,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getBarTabs, openBarTab, closeBarTab, deleteBarTab, getBarTabItems, addBarTabItem,
  removeBarTabItem, getTables, getProducts,
  type BarTabRow, type TableRow, type ProductRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none'

function OpenTabModal({ tenantId, tables, branchId, userId, onClose, onOpened }: {
  tenantId: string; tables: TableRow[]; branchId: string | null; userId: string | null; onClose: () => void; onOpened: (t: BarTabRow) => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [tableId, setTableId] = useState('')
  const save = useMutation({
    mutationFn: () => openBarTab(tenantId, { name: name.trim(), table_id: tableId || null, branch_id: branchId, opened_by: userId }),
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ['bar-tabs', tenantId] }); toast.success('Cuenta abierta'); onOpened(t); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo abrir'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Abrir cuenta</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Nombre / cliente</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Mesa 4 · Juan" /></div>
          <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Mesa (opcional)</label>
            <select value={tableId} onChange={(e) => setTableId(e.target.value)} className={inputCls}>
              <option value="">Sin mesa</option>
              {tables.map((t) => <option key={t.id} value={t.id}>Mesa {t.number}{t.name ? ` · ${t.name}` : ''}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Abrir
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BarTabsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)
  const userId   = useAuthStore((s) => s.profile?.id)
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [prodSearch, setProdSearch] = useState('')

  const { data: tabs = [], isLoading } = useQuery({
    queryKey: ['bar-tabs', tenantId], queryFn: () => getBarTabs(tenantId!, { status: 'OPEN' }), enabled: !!tenantId,
  })
  const { data: tables = [] } = useQuery({ queryKey: ['tables', tenantId, branchId], queryFn: () => getTables(tenantId!, branchId!), enabled: !!tenantId && !!branchId })
  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId!, { status: 'ACTIVE' }), enabled: !!tenantId })

  const selected = tabs.find((t) => t.id === selectedId) ?? null
  const { data: items = [] } = useQuery({
    queryKey: ['bar-tab-items', tenantId, selectedId],
    queryFn: () => getBarTabItems(tenantId!, selectedId!),
    enabled: !!tenantId && !!selectedId,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bar-tabs', tenantId] })
    qc.invalidateQueries({ queryKey: ['bar-tab-items', tenantId, selectedId] })
  }
  const addItem = useMutation({
    mutationFn: (p: ProductRow) => addBarTabItem(tenantId!, selectedId!, { product_id: p.id, name: p.name, quantity: 1, unit_price: p.price }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? 'Error'),
  })
  const delItem = useMutation({ mutationFn: (itemId: string) => removeBarTabItem(tenantId!, selectedId!, itemId), onSuccess: invalidate })
  const close = useMutation({
    mutationFn: () => closeBarTab(tenantId!, selectedId!),
    onSuccess: () => { invalidate(); setSelectedId(null); toast.success('Cuenta cerrada') },
  })
  const del = useMutation({
    mutationFn: () => deleteBarTab(tenantId!, selectedId!),
    onSuccess: () => { invalidate(); setSelectedId(null); toast.success('Cuenta eliminada') },
  })

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase()
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products
  }, [products, prodSearch])

  const tableLabel = (id: string | null) => { const t = tables.find((x) => x.id === id); return t ? `Mesa ${t.number}` : null }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Beer className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Comandas de Bar</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Cuentas abiertas por mesa o cliente.</p>
          </div>
        </div>
        <button onClick={() => setModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><Plus className="h-4 w-4" /> Abrir cuenta</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Cuentas abiertas */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-grafito-100 dark:border-white/5"><p className="text-xs font-bold uppercase tracking-wider text-grafito-500">Abiertas ({tabs.length})</p></div>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-grafito-400" /></div>
          ) : tabs.length === 0 ? (
            <p className="text-sm text-grafito-400 text-center py-10">Sin cuentas abiertas.</p>
          ) : (
            <div className="divide-y divide-grafito-100 dark:divide-white/5">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setSelectedId(t.id)} className={cn('w-full flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors', selectedId === t.id ? 'bg-brand-500/10' : 'hover:bg-grafito-50 dark:hover:bg-white/5')}>
                  <div className="min-w-0">
                    <p className="font-semibold text-grafito-900 dark:text-white truncate">{t.name}</p>
                    {tableLabel(t.table_id) && <p className="text-xs text-grafito-400">{tableLabel(t.table_id)}</p>}
                  </div>
                  <span className="text-sm font-bold text-grafito-800 dark:text-grafito-100 shrink-0">{formatCurrency(Number(t.total), 'COP')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalle de la cuenta */}
        {!selected ? (
          <div className="rounded-2xl border border-dashed border-grafito-200 dark:border-white/10 flex flex-col items-center justify-center gap-2 py-20 text-grafito-400">
            <Receipt className="h-8 w-8" /><p className="text-sm">Selecciona o abre una cuenta para agregar consumos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-grafito-900 dark:text-white">{selected.name}</h2>
                  {tableLabel(selected.table_id) && <p className="text-xs text-grafito-400">{tableLabel(selected.table_id)}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-grafito-400 uppercase font-semibold">Total</p>
                  <p className="text-2xl font-black text-brand-600 dark:text-brand-400">{formatCurrency(Number(selected.total), 'COP')}</p>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-grafito-400 text-center py-6">Aún no hay consumos. Agrega productos abajo.</p>
              ) : (
                <div className="divide-y divide-grafito-100 dark:divide-white/5">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 py-2">
                      <span className="text-xs font-mono text-grafito-400 w-8">{Number(it.quantity)}×</span>
                      <span className="flex-1 text-sm text-grafito-800 dark:text-grafito-100">{it.name}</span>
                      <span className="text-sm text-grafito-600 dark:text-grafito-300">{formatCurrency(Number(it.total), 'COP')}</span>
                      <button onClick={() => delItem.mutate(it.id)} className="rounded-lg p-1 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Minus className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-5">
                <button onClick={() => { if (confirm('¿Eliminar la cuenta y sus consumos?')) del.mutate() }} className="rounded-xl border border-red-200 dark:border-red-500/30 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                <button onClick={() => close.mutate()} disabled={close.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                  {close.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Cerrar cuenta
                </button>
              </div>
            </div>

            {/* Agregar productos */}
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
              <div className="flex items-center gap-2 rounded-xl bg-grafito-50 dark:bg-white/5 px-3 py-2 mb-3">
                <Search className="h-4 w-4 text-grafito-400" />
                <input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Buscar producto…" className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => addItem.mutate(p)} className="rounded-xl border border-grafito-200 dark:border-white/10 p-2.5 text-left hover:border-brand-500 hover:bg-brand-500/5 transition-colors">
                    <p className="text-sm font-medium text-grafito-800 dark:text-grafito-100 line-clamp-2">{p.name}</p>
                    <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold mt-1">{formatCurrency(p.price, 'COP')}</p>
                  </button>
                ))}
                {filteredProducts.length === 0 && <p className="text-xs text-grafito-400 col-span-full text-center py-4">Sin productos.</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {modal && tenantId && <OpenTabModal tenantId={tenantId} tables={tables} branchId={branchId ?? null} userId={userId ?? null} onClose={() => setModal(false)} onOpened={(t) => setSelectedId(t.id)} />}
    </div>
  )
}
