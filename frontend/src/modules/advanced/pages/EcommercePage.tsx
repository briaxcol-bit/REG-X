import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Globe, Loader2, Save, ExternalLink, MessageCircle } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import { getMyTenant, updateMyTenantSettings, getProducts } from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

interface StoreCfg { enabled?: boolean; title?: string; description?: string; whatsapp?: string; show_prices?: boolean }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm font-semibold text-grafito-700 dark:text-grafito-200">
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-500' : 'bg-grafito-300 dark:bg-white/10')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  )
}

export default function EcommercePage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const tenantName = useAuthStore((s) => s.tenant?.tenantName)
  const qc = useQueryClient()

  const { data: tenant } = useQuery({ queryKey: ['my-tenant', tenantId], queryFn: () => getMyTenant(tenantId!), enabled: !!tenantId })
  const { data: products = [] } = useQuery({ queryKey: ['products', tenantId], queryFn: () => getProducts(tenantId!), enabled: !!tenantId })

  const [cfg, setCfg] = useState<StoreCfg>({})
  useEffect(() => {
    if (tenant) {
      const s = (tenant.settings?.ecommerce as StoreCfg) ?? {}
      setCfg({ enabled: s.enabled ?? false, title: s.title ?? tenantName ?? '', description: s.description ?? '', whatsapp: s.whatsapp ?? '', show_prices: s.show_prices ?? true })
    }
  }, [tenant, tenantName])

  const save = useMutation({
    mutationFn: () => updateMyTenantSettings(tenantId!, tenant?.settings ?? null, { ecommerce: cfg } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tenant', tenantId] }); toast.success('Tienda guardada') },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  const set = (patch: Partial<StoreCfg>) => setCfg((c) => ({ ...c, ...patch }))
  const wa = (name: string, price: number) =>
    `https://wa.me/${(cfg.whatsapp ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, quiero pedir: ${name}${cfg.show_prices ? ` (${formatCurrency(price, 'COP')})` : ''}`)}`
  const active = products.filter((p) => p.status === 'ACTIVE')

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><Globe className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Tienda en Línea</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Catálogo web conectado a tu inventario.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Config */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-grafito-500">Configuración</h2>
            <Toggle checked={!!cfg.enabled} onChange={(v) => set({ enabled: v })} label={cfg.enabled ? 'Activa' : 'Inactiva'} />
          </div>
          <Field label="Nombre de la tienda"><input value={cfg.title ?? ''} onChange={(e) => set({ title: e.target.value })} className={inputCls} /></Field>
          <Field label="Descripción"><input value={cfg.description ?? ''} onChange={(e) => set({ description: e.target.value })} className={inputCls} /></Field>
          <Field label="WhatsApp para pedidos (con indicativo, sin +)"><input value={cfg.whatsapp ?? ''} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="573001112233" className={inputCls} /></Field>
          <Toggle checked={cfg.show_prices ?? true} onChange={(v) => set({ show_prices: v })} label="Mostrar precios en la tienda" />
          <button onClick={() => save.mutate()} disabled={save.isPending} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar tienda
          </button>
          <p className="text-[11px] text-grafito-400 flex items-center gap-1"><ExternalLink className="h-3 w-3" /> La publicación con URL pública (sin login) se habilita en la fase de despliegue; aquí ves la vista previa y ya queda conectada al catálogo.</p>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6">
          <div className="text-center border-b border-grafito-100 dark:border-white/5 pb-4 mb-4">
            <h3 className="text-lg font-bold text-grafito-900 dark:text-white">{cfg.title || 'Tu tienda'}</h3>
            {cfg.description && <p className="text-xs text-grafito-500 mt-0.5">{cfg.description}</p>}
          </div>
          {active.length === 0 ? (
            <p className="text-sm text-grafito-400 text-center py-8">No hay productos activos para mostrar.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[420px] overflow-y-auto">
              {active.slice(0, 30).map((p) => (
                <div key={p.id} className="rounded-xl border border-grafito-200 dark:border-white/5 p-3 flex flex-col">
                  <div className="aspect-square rounded-lg bg-grafito-100 dark:bg-white/5 mb-2 overflow-hidden flex items-center justify-center">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Globe className="h-6 w-6 text-grafito-300" />}
                  </div>
                  <p className="text-xs font-semibold text-grafito-900 dark:text-white line-clamp-2 flex-1">{p.name}</p>
                  {cfg.show_prices && <p className="text-sm font-bold text-brand-500 mt-1">{formatCurrency(Number(p.price), 'COP')}</p>}
                  {cfg.whatsapp && (
                    <a href={wa(p.name, Number(p.price))} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600"><MessageCircle className="h-3 w-3" /> Pedir</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
