import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Gift, Loader2, X, Plus, Trash2, Power, Save, Star, Search, Coins, Award,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getCustomers, getLoyaltyConfig, saveLoyaltyConfig, getLoyaltyRewards, saveLoyaltyReward,
  deleteLoyaltyReward, adjustLoyaltyPoints,
  type CustomerRow, type LoyaltyRewardRow,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none'

function PointsModal({ tenantId, customer, onClose }: { tenantId: string; customer: CustomerRow; onClose: () => void }) {
  const qc = useQueryClient()
  const [kind, setKind] = useState<'EARN' | 'REDEEM'>('EARN')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const save = useMutation({
    mutationFn: () => adjustLoyaltyPoints(tenantId, customer.id, kind === 'EARN' ? Number(amount) : -Number(amount), kind, note.trim() || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers', tenantId] }); toast.success(kind === 'EARN' ? 'Puntos agregados' : 'Puntos redimidos'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'Error'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Puntos · {customer.full_name}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-grafito-500 mb-4">Saldo actual: <span className="font-bold text-grafito-800 dark:text-grafito-100">{customer.loyalty_points} pts</span></p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(['EARN', 'REDEEM'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cn('rounded-xl border py-2 text-sm font-semibold', kind === k ? 'border-brand-500 bg-brand-500/5 text-brand-600 dark:text-brand-300' : 'border-grafito-200 dark:border-white/10 text-grafito-500')}>{k === 'EARN' ? 'Agregar' : 'Redimir'}</button>
          ))}
        </div>
        <div className="space-y-3">
          <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Puntos</label><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className={inputCls} inputMode="numeric" placeholder="0" /></div>
          <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Nota (opcional)</label><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></div>
        </div>
        <button onClick={() => save.mutate()} disabled={!amount || save.isPending} className="w-full mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />} Guardar
        </button>
      </div>
    </div>
  )
}

export default function LoyaltyPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [pointsFor, setPointsFor] = useState<CustomerRow | null>(null)
  const [rewardName, setRewardName] = useState('')
  const [rewardCost, setRewardCost] = useState('')

  const { data: customers = [] } = useQuery({ queryKey: ['customers', tenantId], queryFn: () => getCustomers(tenantId!), enabled: !!tenantId })
  const { data: config } = useQuery({ queryKey: ['loyalty-config', tenantId], queryFn: () => getLoyaltyConfig(tenantId!), enabled: !!tenantId })
  const { data: rewards = [] } = useQuery({ queryKey: ['loyalty-rewards', tenantId], queryFn: () => getLoyaltyRewards(tenantId!), enabled: !!tenantId })

  const [perPoint, setPerPoint] = useState('')
  const [ptValue, setPtValue] = useState('')
  const effPerPoint = perPoint !== '' ? perPoint : String(config?.currency_per_point ?? 1000)
  const effPtValue = ptValue !== '' ? ptValue : String(config?.point_value ?? 50)

  const saveCfg = useMutation({
    mutationFn: () => saveLoyaltyConfig(tenantId!, { currency_per_point: Number(effPerPoint) || 0, point_value: Number(effPtValue) || 0, is_active: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty-config', tenantId] }); toast.success('Configuración guardada') },
  })
  const addReward = useMutation({
    mutationFn: () => saveLoyaltyReward(tenantId!, { name: rewardName.trim(), points_cost: Number(rewardCost) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty-rewards', tenantId] }); setRewardName(''); setRewardCost(''); toast.success('Recompensa agregada') },
  })
  const delReward = useMutation({ mutationFn: (id: string) => deleteLoyaltyReward(tenantId!, id), onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-rewards', tenantId] }) })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? customers.filter((c) => c.full_name.toLowerCase().includes(q)) : customers
    return [...list].sort((a, b) => b.loyalty_points - a.loyalty_points)
  }, [customers, search])
  const totalPoints = useMemo(() => customers.reduce((s, c) => s + (c.loyalty_points || 0), 0), [customers])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><Gift className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Fidelización</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Puntos y recompensas por compra.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          {/* Configuración */}
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-grafito-500 flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" /> Configuración de puntos</p>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Gana 1 punto por cada ($)</label>
              <input value={effPerPoint} onChange={(e) => setPerPoint(e.target.value.replace(/\D/g, ''))} className={inputCls} inputMode="numeric" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Cada punto vale ($)</label>
              <input value={effPtValue} onChange={(e) => setPtValue(e.target.value.replace(/\D/g, ''))} className={inputCls} inputMode="numeric" />
            </div>
            <button onClick={() => saveCfg.mutate()} disabled={saveCfg.isPending} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {saveCfg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
            <p className="text-[11px] text-grafito-400">{customers.length} clientes · {totalPoints.toLocaleString('es-CO')} pts en circulación</p>
          </div>

          {/* Recompensas */}
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-grafito-500 flex items-center gap-1.5 mb-3"><Award className="h-3.5 w-3.5" /> Recompensas</p>
            <div className="flex gap-2 mb-3">
              <input value={rewardName} onChange={(e) => setRewardName(e.target.value)} placeholder="Recompensa" className={inputCls} />
              <input value={rewardCost} onChange={(e) => setRewardCost(e.target.value.replace(/\D/g, ''))} placeholder="pts" className={cn(inputCls, 'w-20')} inputMode="numeric" />
              <button onClick={() => addReward.mutate()} disabled={!rewardName.trim() || addReward.isPending} className="rounded-xl bg-brand-500 px-3 text-white hover:bg-brand-600 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {rewards.length === 0 ? <p className="text-xs text-grafito-400 text-center py-4">Sin recompensas.</p> : rewards.map((r: LoyaltyRewardRow) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-grafito-50 dark:bg-white/[0.02] px-3 py-2">
                  <span className="text-sm text-grafito-800 dark:text-grafito-100">{r.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">{r.points_cost} pts</span>
                    <button onClick={() => delReward.mutate(r.id)} className="rounded-lg p-1 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Clientes y saldos */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-grafito-100 dark:border-white/5 flex items-center gap-2">
            <Search className="h-4 w-4 text-grafito-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…" className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400" />
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Star className="h-8 w-8" /><p className="text-sm">Sin clientes.</p></div>
          ) : (
            <div className="divide-y divide-grafito-100 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-grafito-900 dark:text-white truncate">{c.full_name}</p>
                    {c.phone && <p className="text-xs text-grafito-400">{c.phone}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-grafito-800 dark:text-grafito-100"><Star className="h-3.5 w-3.5 text-amber-400" />{c.loyalty_points}</span>
                    <button onClick={() => setPointsFor(c)} className="rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-500/20">Puntos</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {pointsFor && tenantId && <PointsModal tenantId={tenantId} customer={pointsFor} onClose={() => setPointsFor(null)} />}
    </div>
  )
}
