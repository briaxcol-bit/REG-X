import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarX, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { getExpiringBatches, type BatchRow } from '@lib/db'

const WINDOWS = [30, 60, 90]

function daysTo(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
}

export default function ExpiryControlPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const [days, setDays] = useState(30)

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['expiring-batches', tenantId, days],
    queryFn: () => getExpiringBatches(tenantId!, days),
    enabled: !!tenantId,
  })

  const { expired, soon } = useMemo(() => {
    const expired: BatchRow[] = []
    const soon: BatchRow[] = []
    for (const b of batches) {
      const d = daysTo(b.expiry_date)
      if (d !== null && d < 0) expired.push(b)
      else soon.push(b)
    }
    return { expired, soon }
  }, [batches])

  const Row = ({ b }: { b: BatchRow }) => {
    const d = daysTo(b.expiry_date)
    const isExpired = d !== null && d < 0
    return (
      <tr className="hover:bg-grafito-50 dark:hover:bg-white/5">
        <td className="px-4 py-3 font-semibold text-grafito-900 dark:text-white">{b.products?.name ?? '—'}</td>
        <td className="px-4 py-3 font-mono text-grafito-600 dark:text-grafito-300">{b.batch_number}</td>
        <td className="px-4 py-3 text-right text-grafito-700 dark:text-grafito-200">{Number(b.quantity)}</td>
        <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{b.expiry_date ? new Date(b.expiry_date + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
        <td className="px-4 py-3">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', isExpired ? 'bg-red-500/10 text-red-500' : 'bg-amber-400/10 text-amber-600 dark:text-amber-400')}>
            {isExpired ? `Vencido hace ${Math.abs(d!)}d` : `Vence en ${d}d`}
          </span>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><CalendarX className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Control de Vencimientos</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Productos próximos a vencer (según los lotes).</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl bg-grafito-100 dark:bg-white/5 p-1">
          {WINDOWS.map((w) => (
            <button key={w} onClick={() => setDays(w)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', days === w ? 'bg-white dark:bg-grafito-800 text-brand-500 shadow-sm' : 'text-grafito-500 hover:text-grafito-800 dark:hover:text-white')}>
              {w} días
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 text-red-500"><AlertTriangle className="h-4 w-4" /><p className="text-xs font-semibold">Vencidos</p></div>
          <p className="text-3xl font-black text-red-500 mt-1">{expired.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Por vencer (≤ {days}d)</p>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{soon.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><CalendarX className="h-8 w-8" /><p className="text-sm">Nada por vencer en los próximos {days} días. 🎉</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Producto</th><th className="px-4 py-3">Lote</th><th className="px-4 py-3 text-right">Cant.</th><th className="px-4 py-3">Vence</th><th className="px-4 py-3">Estado</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {expired.map((b) => <Row key={b.id} b={b} />)}
              {soon.map((b) => <Row key={b.id} b={b} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
