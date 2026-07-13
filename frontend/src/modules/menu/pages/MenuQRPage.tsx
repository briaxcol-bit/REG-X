import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QrCode, Copy, Check, ExternalLink, Loader2, UtensilsCrossed } from 'lucide-react'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import { getPublicMenu, type PublicMenuItem } from '@lib/db'

export default function MenuQRPage() {
  const slug = useAuthStore((s) => s.tenant?.tenantSlug)
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const menuUrl = slug ? `${origin}/m/${slug}` : ''
  const qrUrl = menuUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(menuUrl)}` : ''

  const { data: menu, isLoading } = useQuery({
    queryKey: ['public-menu', slug], queryFn: () => getPublicMenu(slug!), enabled: !!slug,
  })

  const grouped = useMemo(() => {
    const items = menu?.items ?? []
    const map = new Map<string, PublicMenuItem[]>()
    items.forEach((it) => { const k = it.category ?? 'Otros'; if (!map.has(k)) map.set(k, []); map.get(k)!.push(it) })
    return [...map.entries()]
  }, [menu])

  const copy = async () => {
    try { await navigator.clipboard.writeText(menuUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* noop */ }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><QrCode className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Menú Digital QR</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Imprime el código y tus clientes verán el menú desde su celular.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* QR + enlace */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 space-y-4">
          <div className="rounded-2xl bg-white p-4 flex items-center justify-center border border-grafito-100 dark:border-white/10">
            {qrUrl ? <img src={qrUrl} alt="QR del menú" className="h-56 w-56" /> : <div className="h-56 w-56 flex items-center justify-center text-grafito-300"><QrCode className="h-16 w-16" /></div>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Enlace del menú</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-xs text-grafito-700 dark:text-grafito-300 bg-grafito-50 dark:bg-white/5 border border-grafito-200 dark:border-white/10 rounded-lg px-2.5 py-2">{menuUrl || '—'}</code>
              <button onClick={copy} disabled={!menuUrl} className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 disabled:opacity-40">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {menuUrl && (
            <div className="flex gap-2">
              <a href={menuUrl} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600"><ExternalLink className="h-4 w-4" /> Abrir menú</a>
              <a href={qrUrl} download="menu-qr.png" target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/10 py-2 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5"><QrCode className="h-4 w-4" /> Descargar QR</a>
            </div>
          )}
        </div>

        {/* Vista previa */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-grafito-100 dark:border-white/5 flex items-center justify-between">
            <h2 className="font-semibold text-grafito-900 dark:text-white text-sm">Vista previa del menú</h2>
            <span className="text-xs text-grafito-400">{menu?.items?.length ?? 0} productos</span>
          </div>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
          ) : (menu?.items?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><UtensilsCrossed className="h-8 w-8" /><p className="text-sm">No hay productos activos para mostrar.</p><p className="text-xs">Activa productos en el módulo Productos y aparecerán aquí.</p></div>
          ) : (
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {grouped.map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500 mb-2">{cat}</h3>
                  <div className="divide-y divide-grafito-100 dark:divide-white/5">
                    {items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-sm text-grafito-800 dark:text-grafito-100">{it.name}</span>
                        <span className="text-sm font-semibold text-grafito-900 dark:text-white shrink-0">{formatCurrency(Number(it.price), 'COP')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
