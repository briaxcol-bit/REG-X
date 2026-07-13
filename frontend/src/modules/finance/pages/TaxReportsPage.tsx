import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Landmark, Loader2, Receipt, Info } from 'lucide-react'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import { getTaxSummary } from '@lib/db'

function monthStart(): string { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }

export default function TaxReportsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const { data: sum, isLoading } = useQuery({
    queryKey: ['tax-summary', tenantId, from, to],
    queryFn: () => getTaxSummary(tenantId!, from, to),
    enabled: !!tenantId,
  })

  const cards = [
    { label: 'Base gravable (subtotal)', value: sum?.subtotal ?? 0, cls: 'text-grafito-900 dark:text-white' },
    { label: 'IVA generado', value: sum?.tax ?? 0, cls: 'text-brand-500' },
    { label: 'Total facturado', value: sum?.total ?? 0, cls: 'text-emerald-500' },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><Landmark className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Informes Tributarios</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">IVA y base gravable a partir de tus ventas.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white" />
        </div>
        {sum && <div className="ml-auto text-xs text-grafito-400">{sum.count} venta{sum.count !== 1 ? 's' : ''} en el período</div>}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5">
              <div className="flex items-center gap-2 text-grafito-500"><Receipt className="h-4 w-4" /><p className="text-xs font-medium">{c.label}</p></div>
              <p className={`text-2xl font-black mt-1 ${c.cls}`}>{formatCurrency(c.value, 'COP')}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 px-5 py-4">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-500 dark:text-blue-300">
          El IVA mostrado se calcula sobre las ventas registradas (impuesto ya incluido en el total).
          La <span className="font-semibold">factura electrónica ante la DIAN</span> requiere un proveedor tecnológico autorizado; se integra en una fase posterior desde el módulo de integraciones.
        </p>
      </div>
    </div>
  )
}
