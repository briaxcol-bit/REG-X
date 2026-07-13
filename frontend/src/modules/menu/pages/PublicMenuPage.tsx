import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, UtensilsCrossed } from 'lucide-react'
import { getPublicMenu, type PublicMenuItem } from '@lib/db'

// Página PÚBLICA (sin login) a la que apunta el QR: /m/:slug
export default function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: menu, isLoading, isError } = useQuery({
    queryKey: ['public-menu', slug],
    queryFn: () => getPublicMenu(slug!),
    enabled: !!slug,
    retry: false,
  })

  const grouped = useMemo(() => {
    const items = menu?.items ?? []
    const map = new Map<string, PublicMenuItem[]>()
    items.forEach((it) => { const k = it.category ?? 'Otros'; if (!map.has(k)) map.set(k, []); map.get(k)!.push(it) })
    return [...map.entries()]
  }, [menu])

  const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-grafito-50"><Loader2 className="h-8 w-8 animate-spin text-grafito-400" /></div>
  }
  if (isError || !menu?.ok) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-grafito-50 text-grafito-500 px-6 text-center">
        <UtensilsCrossed className="h-10 w-10" />
        <p className="text-lg font-semibold">Menú no disponible</p>
        <p className="text-sm">Revisa el enlace del código QR.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-grafito-50 text-grafito-900">
      <div className="mx-auto max-w-xl px-5 py-8">
        <header className="text-center mb-8">
          {menu.tenant?.logo_url
            ? <img src={menu.tenant.logo_url} alt={menu.tenant.name} className="h-16 w-16 rounded-2xl object-cover mx-auto mb-3 shadow" />
            : <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3"><UtensilsCrossed className="h-7 w-7 text-brand-500" /></div>}
          <h1 className="text-2xl font-black tracking-tight">{menu.tenant?.name}</h1>
          <p className="text-sm text-grafito-400 mt-0.5">Menú</p>
        </header>

        {grouped.length === 0 ? (
          <p className="text-center text-grafito-400 py-16">Menú en preparación.</p>
        ) : (
          <div className="space-y-7">
            {grouped.map(([cat, items]) => (
              <section key={cat}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-brand-500 mb-2 border-b border-grafito-200 pb-1">{cat}</h2>
                <div className="divide-y divide-grafito-100">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 py-3">
                      {it.image_url && <img src={it.image_url} alt={it.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />}
                      <span className="flex-1 text-[15px] font-medium">{it.name}</span>
                      <span className="text-[15px] font-bold text-grafito-900 shrink-0">{fmt(Number(it.price))}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="text-center text-xs text-grafito-300 mt-10 pb-6">Menú digital · REG-X</footer>
      </div>
    </div>
  )
}
