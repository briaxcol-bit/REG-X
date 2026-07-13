import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Split, Users, Minus, Plus, Scale, ListChecks, SlidersHorizontal,
  CheckCircle2, Loader2, History,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getBarTabs, getBarTabItems, closeBarTab, saveBillSplit, getBillSplits,
  type BillSplitShare,
} from '@lib/db'

type Method = 'EQUAL' | 'ITEMS' | 'CUSTOM'
const round = (n: number) => Math.round(n)

function splitEven(total: number, n: number): number[] {
  const t = round(total), base = Math.floor(t / n), rem = t - base * n
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0))
}

export default function SplitBillPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)
  const qc = useQueryClient()

  const [tabId, setTabId] = useState('')          // '' = manual
  const [manual, setManual] = useState('')
  const [tip, setTip] = useState('')
  const [people, setPeople] = useState(2)
  const [method, setMethod] = useState<Method>('EQUAL')
  const [assign, setAssign] = useState<Record<string, number>>({})   // itemId → personIndex, -1 = compartido
  const [customMap, setCustomMap] = useState<Record<number, string>>({})
  const [closeTab, setCloseTab] = useState(true)

  const { data: openTabs = [] } = useQuery({ queryKey: ['bar-tabs', tenantId], queryFn: () => getBarTabs(tenantId!, { status: 'OPEN' }), enabled: !!tenantId })
  const { data: items = [] } = useQuery({ queryKey: ['bar-tab-items', tenantId, tabId], queryFn: () => getBarTabItems(tenantId!, tabId), enabled: !!tenantId && !!tabId })
  const { data: history = [] } = useQuery({ queryKey: ['bill-splits', tenantId], queryFn: () => getBillSplits(tenantId!), enabled: !!tenantId })

  const selectedTab = openTabs.find((t) => t.id === tabId) ?? null
  const itemsTotal = useMemo(() => items.reduce((s, it) => s + Number(it.total), 0), [items])
  const baseTotal = tabId ? (items.length ? itemsTotal : Number(selectedTab?.total ?? 0)) : (Number(manual) || 0)
  const tipAmt = Number(tip) || 0
  const grand = round(baseTotal + tipAmt)
  const persons = Array.from({ length: people }, (_, i) => i)
  const canItems = !!tabId && items.length > 0

  const shares = useMemo<number[]>(() => {
    if (people <= 0) return []
    if (method === 'CUSTOM') return persons.map((i) => round(Number(customMap[i]) || 0))
    if (method === 'ITEMS' && canItems) {
      const shared = items.filter((it) => (assign[it.id] ?? -1) === -1).reduce((s, it) => s + Number(it.total), 0)
      const sharedEach = shared / people
      const raw = persons.map((p) => {
        const own = items.filter((it) => assign[it.id] === p).reduce((s, it) => s + Number(it.total), 0)
        const basePerson = own + sharedEach
        const tipPerson = itemsTotal > 0 ? tipAmt * (basePerson / itemsTotal) : tipAmt / people
        return basePerson + tipPerson
      })
      const rounded = raw.map(round)
      const diff = grand - rounded.reduce((s, v) => s + v, 0)
      if (rounded.length) rounded[0] = (rounded[0] ?? 0) + diff
      return rounded
    }
    return splitEven(grand, people)
  }, [method, canItems, items, assign, people, tipAmt, itemsTotal, grand, customMap])

  const assignedSum = useMemo(() => shares.reduce((s, v) => s + v, 0), [shares])
  const remaining = grand - assignedSum

  const save = useMutation({
    mutationFn: async () => {
      const detail: BillSplitShare[] = shares.map((amt, i) => ({ label: `Persona ${i + 1}`, amount: amt }))
      await saveBillSplit(tenantId!, {
        tab_id: tabId || null, branch_id: branchId ?? null,
        total: round(baseTotal), tip: round(tipAmt), method, people, detail,
      })
      if (tabId && closeTab) await closeBarTab(tenantId!, tabId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bill-splits', tenantId] })
      qc.invalidateQueries({ queryKey: ['bar-tabs', tenantId] })
      toast.success('División registrada')
      if (tabId && closeTab) { setTabId(''); setManual('') }
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo registrar'),
  })

  const setTipPct = (pct: number) => setTip(String(round(baseTotal * pct)))

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><Split className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">División de Cuenta</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Divide la cuenta entre los comensales de forma flexible.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Configuración */}
        <div className="space-y-4">
          {/* Fuente */}
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-grafito-500">Cuenta a dividir</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Comanda de bar</label>
                <select value={tabId} onChange={(e) => { setTabId(e.target.value); setMethod(e.target.value ? 'ITEMS' : 'EQUAL') }} className="w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white">
                  <option value="">— Total manual —</option>
                  {openTabs.map((t) => <option key={t.id} value={t.id}>{t.name} · {formatCurrency(Number(t.total), 'COP')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Total {tabId ? '(de la comanda)' : 'manual'}</label>
                <input value={tabId ? String(round(baseTotal)) : manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} disabled={!!tabId} className={cn('w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white', tabId && 'opacity-60')} inputMode="numeric" placeholder="0" />
              </div>
            </div>

            {/* Personas + propina */}
            <div className="flex flex-wrap items-end gap-4 pt-1">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Comensales</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPeople((p) => Math.max(1, p - 1))} className="rounded-lg p-2 border border-grafito-200 dark:border-white/10 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5"><Minus className="h-4 w-4" /></button>
                  <span className="inline-flex items-center gap-1 text-lg font-bold text-grafito-900 dark:text-white w-10 justify-center"><Users className="h-4 w-4 text-grafito-400" />{people}</span>
                  <button onClick={() => setPeople((p) => Math.min(12, p + 1))} className="rounded-lg p-2 border border-grafito-200 dark:border-white/10 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Propina</label>
                <div className="flex items-center gap-2">
                  <input value={tip} onChange={(e) => setTip(e.target.value.replace(/\D/g, ''))} className="w-28 text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white" inputMode="numeric" placeholder="0" />
                  {[0, 0.1, 0.15, 0.2].map((p) => (
                    <button key={p} onClick={() => setTipPct(p)} className="px-2 py-1.5 rounded-lg text-xs font-semibold border border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">{p === 0 ? 'Sin' : `${p * 100}%`}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Método */}
          <div className="flex gap-2">
            {([['EQUAL', 'Iguales', Scale, true], ['ITEMS', 'Por ítems', ListChecks, canItems], ['CUSTOM', 'Personalizado', SlidersHorizontal, true]] as const).map(([key, label, Icon, enabled]) => (
              <button key={key} disabled={!enabled} onClick={() => setMethod(key)} className={cn('inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-40', method === key ? 'bg-brand-500 text-white border-brand-500' : 'border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5')}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {/* Asignación por ítems */}
          {method === 'ITEMS' && canItems && (
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 divide-y divide-grafito-100 dark:divide-white/5">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-mono text-grafito-400 w-8">{Number(it.quantity)}×</span>
                  <span className="flex-1 text-sm text-grafito-800 dark:text-grafito-100 truncate">{it.name}</span>
                  <span className="text-sm text-grafito-500 shrink-0">{formatCurrency(Number(it.total), 'COP')}</span>
                  <select value={assign[it.id] ?? -1} onChange={(e) => setAssign((a) => ({ ...a, [it.id]: Number(e.target.value) }))} className="text-xs px-2 py-1 rounded-lg border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-700 dark:text-grafito-200 shrink-0">
                    <option value={-1}>Compartido</option>
                    {persons.map((p) => <option key={p} value={p}>Persona {p + 1}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Montos personalizados */}
          {method === 'CUSTOM' && (
            <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 grid sm:grid-cols-2 gap-3">
              {persons.map((i) => (
                <div key={i}>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Persona {i + 1}</label>
                  <input value={customMap[i] ?? ''} onChange={(e) => setCustomMap((m) => ({ ...m, [i]: e.target.value.replace(/\D/g, '') }))} className="w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white" inputMode="numeric" placeholder="0" />
                </div>
              ))}
              <p className={cn('sm:col-span-2 text-xs font-semibold', remaining === 0 ? 'text-emerald-500' : 'text-amber-500')}>
                {remaining === 0 ? 'Cuadra exacto ✓' : `${remaining > 0 ? 'Falta' : 'Sobra'} por asignar: ${formatCurrency(Math.abs(remaining), 'COP')}`}
              </p>
            </div>
          )}
        </div>

        {/* Resultado */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] text-grafito-400 uppercase font-semibold">Total con propina</p>
                <p className="text-2xl font-black text-grafito-900 dark:text-white">{formatCurrency(grand, 'COP')}</p>
              </div>
              <div className="text-right text-xs text-grafito-400">
                <p>Base {formatCurrency(round(baseTotal), 'COP')}</p>
                <p>Propina {formatCurrency(round(tipAmt), 'COP')}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {persons.map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-grafito-50 dark:bg-white/[0.02] px-3 py-2">
                  <span className="text-sm font-medium text-grafito-800 dark:text-grafito-100">Persona {i + 1}</span>
                  <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{formatCurrency(shares[i] ?? 0, 'COP')}</span>
                </div>
              ))}
            </div>

            {tabId && (
              <label className="flex items-center gap-2 mt-4 text-xs text-grafito-600 dark:text-grafito-300 cursor-pointer">
                <input type="checkbox" checked={closeTab} onChange={(e) => setCloseTab(e.target.checked)} className="rounded border-grafito-300" />
                Cerrar la comanda al registrar
              </label>
            )}
            <button onClick={() => save.mutate()} disabled={grand <= 0 || save.isPending} className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Registrar división
            </button>
          </div>

          {/* Historial */}
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-grafito-100 dark:border-white/5 flex items-center gap-1.5"><History className="h-3.5 w-3.5 text-grafito-400" /><h3 className="text-sm font-bold text-grafito-900 dark:text-white">Historial</h3></div>
            {history.length === 0 ? (
              <p className="text-xs text-grafito-400 py-6 text-center">Aún no hay divisiones registradas.</p>
            ) : (
              <div className="divide-y divide-grafito-100 dark:divide-white/5 max-h-72 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-grafito-800 dark:text-grafito-100">{formatCurrency(Number(h.total) + Number(h.tip), 'COP')} · {h.people}p</p>
                      <p className="text-[11px] text-grafito-400">{new Date(h.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })} · {h.method === 'EQUAL' ? 'Iguales' : h.method === 'ITEMS' ? 'Por ítems' : 'Personalizado'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
