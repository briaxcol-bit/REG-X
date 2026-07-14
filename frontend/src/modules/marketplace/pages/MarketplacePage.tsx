import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Grid, RotateCcw, Loader2, Lock } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import {
  getMarketplaceModules, getMyModuleSlugs, setTenantModule, resetTenantModules,
  type MarketplaceModuleRow,
} from '@lib/db'

const CATEGORY_LABELS: Record<string, string> = {
  core:       'Núcleo (siempre activo)',
  restaurant: 'Restaurante y F&B',
  retail:     'Retail',
  pharmacy:   'Farmacia',
  hardware:   'Ferretería y Servicios Técnicos',
  services:   'Servicios',
  finance:    'Finanzas',
  hr:         'Talento Humano',
  advanced:   'Avanzado',
}
const CATEGORY_ORDER = ['core','restaurant','retail','pharmacy','hardware','services','finance','hr','advanced']

const PLAN_RANK: Record<string, number> = { FREE: 0, BASIC: 1, PROFESSIONAL: 2, ENTERPRISE: 3 }

export default function MarketplacePage() {
  const { tenant, hasRole } = useAuthStore()
  const tenantId = tenant?.tenantId
  const canManage = hasRole('OWNER') || hasRole('ADMIN')
  const qc = useQueryClient()

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['marketplace-modules'],
    queryFn: getMarketplaceModules,
  })
  const { data: enabledSlugs = [] } = useQuery({
    queryKey: ['my-module-slugs', tenantId],
    queryFn: () => getMyModuleSlugs(tenantId!),
    enabled: !!tenantId,
  })
  const enabled = useMemo(() => new Set(enabledSlugs), [enabledSlugs])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-module-slugs', tenantId] })
  }

  const toggle = useMutation({
    mutationFn: ({ slug, on }: { slug: string; on: boolean }) => setTenantModule(tenantId!, slug, on),
    onSuccess: (_d, v) => { invalidate(); toast.success(v.on ? 'Módulo activado' : 'Módulo desactivado') },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo cambiar el módulo'),
  })

  const reset = useMutation({
    mutationFn: () => resetTenantModules(tenantId!),
    onSuccess: () => { invalidate(); toast.success('Módulos restablecidos según tu tipo de negocio') },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo restablecer'),
  })

  const byCategory = useMemo(() => {
    const map = new Map<string, MarketplaceModuleRow[]>()
    for (const m of catalog) {
      const arr = map.get(m.category) ?? []
      arr.push(m)
      map.set(m.category, arr)
    }
    return map
  }, [catalog])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Grid className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Módulos</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">
              Activa solo lo que tu negocio usa — el menú lateral se ajusta al instante.
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => { if (confirm('¿Restablecer los módulos a los recomendados para tu tipo de negocio? Los que activaste manualmente se apagarán.')) reset.mutate() }}
            disabled={reset.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {reset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Restablecer según mi negocio
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
      ) : (
        CATEGORY_ORDER.filter(c => byCategory.has(c)).map(cat => (
          <div key={cat}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-grafito-400 mb-3">
              {CATEGORY_LABELS[cat] ?? cat}
            </p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(byCategory.get(cat) ?? []).map(m => {
                const isCore = m.category === 'core'
                const isOn   = isCore || enabled.has(m.slug)
                const planOk = (PLAN_RANK[tenant?.plan ?? 'FREE'] ?? 0) >= (PLAN_RANK[m.min_plan] ?? 0)
                return (
                  <div key={m.id} className={cn(
                    'rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors',
                    isOn
                      ? 'border-brand-500/30 bg-brand-500/[0.04] dark:bg-brand-500/[0.06]'
                      : 'border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60',
                  )}>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-sm text-grafito-900 dark:text-white">{m.name}</h3>
                        {!m.is_free && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-500 uppercase">{m.min_plan}</span>
                        )}
                      </div>
                      <p className="text-xs text-grafito-500 dark:text-grafito-400 mt-1">{m.description}</p>
                    </div>
                    {isCore ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-grafito-400">
                        <Lock className="h-3 w-3" /> Parte del núcleo
                      </span>
                    ) : !planOk && !isOn ? (
                      <span className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-purple-500/20 bg-purple-500/5 py-2 text-xs font-bold text-purple-500">
                        <Lock className="h-3 w-3" /> Requiere plan {m.min_plan}
                      </span>
                    ) : (
                      <button
                        onClick={() => toggle.mutate({ slug: m.slug, on: !isOn })}
                        disabled={!canManage || toggle.isPending}
                        className={cn(
                          'w-full rounded-xl py-2 text-xs font-bold transition-colors disabled:opacity-50',
                          isOn
                            ? 'border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10'
                            : 'bg-brand-500 text-white hover:bg-brand-600',
                        )}
                      >
                        {isOn ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
