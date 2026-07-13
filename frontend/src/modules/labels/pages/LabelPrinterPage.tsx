import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer, Search, Loader2, Tags, Minus, Plus, X } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import { getProducts, type ProductRow } from '@lib/db'
import { code128, code128SvgString } from '../barcode'

// Código de barras en SVG para la vista previa.
function Barcode({ value, height = 44 }: { value: string; height?: number }) {
  const bc = useMemo(() => code128(value, { height }), [value, height])
  return (
    <svg width={bc.width} height={bc.height} viewBox={`0 0 ${bc.width} ${bc.height}`} className="max-w-full">
      {bc.bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={bc.height} fill="currentColor" />)}
    </svg>
  )
}

export default function LabelPrinterPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const businessName = useAuthStore((s) => s.tenant?.tenantName)
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState<Record<string, number>>({})   // productId → nº etiquetas
  const [showName, setShowName] = useState(true)

  const { data: products = [], isLoading } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId!, { status: 'ACTIVE' }), enabled: !!tenantId })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) : products
  }, [products, search])

  const setQ = (id: string, n: number) => setQty((m) => ({ ...m, [id]: Math.max(0, n) }))
  const selected = useMemo(() => products.filter((p) => (qty[p.id] ?? 0) > 0), [products, qty])
  const labels = useMemo(() => {
    const out: ProductRow[] = []
    selected.forEach((p) => { for (let i = 0; i < (qty[p.id] ?? 0); i++) out.push(p) })
    return out
  }, [selected, qty])
  const codeOf = (p: ProductRow) => p.barcode || p.sku || p.id.slice(0, 12)

  const print = () => {
    if (labels.length === 0) return
    const html = labels.map((p) => `
      <div class="label">
        ${showName ? `<div class="biz">${businessName ?? ''}</div>` : ''}
        <div class="name">${p.name}</div>
        <div class="price">${formatCurrency(p.price, 'COP')}</div>
        ${code128SvgString(codeOf(p), { height: 40 })}
        <div class="code">${codeOf(p)}</div>
      </div>`).join('')
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w) { alert('Permite las ventanas emergentes para imprimir.'); return }
    w.document.write(`<!doctype html><html><head><title>Etiquetas</title><style>
      *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;margin:0}
      body{padding:8px;display:flex;flex-wrap:wrap;gap:6px}
      .label{width:180px;border:1px solid #ddd;border-radius:6px;padding:8px;text-align:center;page-break-inside:avoid}
      .biz{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.05em}
      .name{font-size:12px;font-weight:600;margin:2px 0;min-height:28px;display:flex;align-items:center;justify-content:center}
      .price{font-size:18px;font-weight:800;margin-bottom:4px}
      .label svg{max-width:100%;height:40px}
      .code{font-size:9px;letter-spacing:.08em;color:#333;margin-top:2px}
      @media print{.label{border-color:#eee}}
    </style></head><body>${html}<script>window.onload=function(){window.print()}</script></body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Tags className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Impresora de Etiquetas</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Etiquetas de precio con código de barras.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-grafito-600 dark:text-grafito-300 cursor-pointer"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="rounded border-grafito-300" /> Nombre del negocio</label>
          <button onClick={print} disabled={labels.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"><Printer className="h-4 w-4" /> Imprimir ({labels.length})</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Selección */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-grafito-100 dark:border-white/5 flex items-center gap-2">
            <Search className="h-4 w-4 text-grafito-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto o SKU…" className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400" />
          </div>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
          ) : (
            <div className="divide-y divide-grafito-100 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
              {filtered.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-grafito-900 dark:text-white truncate">{p.name}</p>
                    <p className="text-xs text-grafito-400">{p.sku} · {formatCurrency(p.price, 'COP')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setQ(p.id, (qty[p.id] ?? 0) - 1)} className="rounded-lg p-1.5 border border-grafito-200 dark:border-white/10 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5"><Minus className="h-3.5 w-3.5" /></button>
                    <input value={qty[p.id] ?? 0} onChange={(e) => setQ(p.id, Number(e.target.value.replace(/\D/g, '')) || 0)} className="w-10 text-center text-sm rounded-lg border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 py-1 text-grafito-900 dark:text-white" />
                    <button onClick={() => setQ(p.id, (qty[p.id] ?? 0) + 1)} className="rounded-lg p-1.5 border border-grafito-200 dark:border-white/10 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-sm text-grafito-400 text-center py-10">Sin productos.</p>}
            </div>
          )}
        </div>

        {/* Vista previa */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wide text-grafito-500">Vista previa</p>
            {selected.length > 0 && <button onClick={() => setQty({})} className="text-xs text-grafito-400 hover:text-red-500 inline-flex items-center gap-1"><X className="h-3 w-3" /> Limpiar</button>}
          </div>
          {selected.length === 0 ? (
            <p className="text-sm text-grafito-400 text-center py-10">Elige productos y cantidades para generar etiquetas.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto text-grafito-900 dark:text-grafito-900">
              {selected.map((p) => (
                <div key={p.id} className="rounded-lg border border-grafito-200 bg-white p-2.5 text-center">
                  {showName && <p className="text-[8px] uppercase tracking-wide text-grafito-400">{businessName}</p>}
                  <p className="text-[11px] font-semibold leading-tight line-clamp-2 min-h-[26px] flex items-center justify-center">{p.name}</p>
                  <p className="text-base font-black">{formatCurrency(p.price, 'COP')}</p>
                  <div className="flex justify-center text-black"><Barcode value={codeOf(p)} /></div>
                  <p className="text-[8px] tracking-widest text-grafito-500 mt-0.5">{codeOf(p)}</p>
                  <p className="text-[9px] text-brand-600 font-semibold mt-1">×{qty[p.id]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
