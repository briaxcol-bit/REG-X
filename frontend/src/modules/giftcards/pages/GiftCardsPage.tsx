import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Gift, Plus, Loader2, X, Ban, Minus, CreditCard } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getGiftCards, createGiftCard, redeemGiftCard, cancelGiftCard, getCustomers,
  type GiftCardRow, type GiftCardStatus,
} from '@lib/db'

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

const STATUS: Record<GiftCardStatus, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Activa',    cls: 'bg-emerald-500/10 text-emerald-500' },
  REDEEMED:  { label: 'Agotada',   cls: 'bg-grafito-200 dark:bg-white/10 text-grafito-500' },
  EXPIRED:   { label: 'Vencida',   cls: 'bg-amber-400/10 text-amber-600 dark:text-amber-400' },
  CANCELLED: { label: 'Anulada',   cls: 'bg-red-500/10 text-red-500' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>{children}</div>
}

function IssueModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [balance, setBalance] = useState('')
  const [code, setCode] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [expires, setExpires] = useState('')
  const { data: customers = [] } = useQuery({ queryKey: ['customers', tenantId], queryFn: () => getCustomers(tenantId), enabled: !!tenantId })

  const save = useMutation({
    mutationFn: () => createGiftCard(tenantId, {
      code: code.trim() || undefined,
      initial_balance: Number(balance) || 0,
      customer_id: customerId || null,
      expires_at: expires || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gift-cards', tenantId] }); toast.success('Tarjeta emitida'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo emitir'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Emitir tarjeta de regalo</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Valor de la tarjeta"><input type="number" min={0} value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="50000" className={inputCls} /></Field>
          <Field label="Código (opcional, se genera solo)"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GC-XXXXXX" className={cn(inputCls, 'font-mono')} /></Field>
          <Field label="Cliente (opcional)">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
              <option value="">— Ninguno —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </Field>
          <Field label="Vence (opcional)"><input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!balance || Number(balance) <= 0 || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Emitir
          </button>
        </div>
      </div>
    </div>
  )
}

function RedeemModal({ tenantId, card, onClose }: { tenantId: string; card: GiftCardRow; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const redeem = useMutation({
    mutationFn: () => redeemGiftCard(tenantId, card.id, Number(amount) || 0),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gift-cards', tenantId] }); toast.success('Redención registrada'); onClose() },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo redimir'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Redimir {card.code}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-grafito-500 mb-4">Saldo disponible: <span className="font-bold text-grafito-900 dark:text-white">{formatCurrency(Number(card.balance), card.currency)}</span></p>
        <Field label="Monto a redimir"><input type="number" min={0} max={Number(card.balance)} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => redeem.mutate()} disabled={!amount || Number(amount) <= 0 || redeem.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />} Redimir
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GiftCardsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [issue, setIssue] = useState(false)
  const [redeem, setRedeem] = useState<GiftCardRow | null>(null)

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['gift-cards', tenantId],
    queryFn: () => getGiftCards(tenantId!),
    enabled: !!tenantId,
  })

  const metrics = useMemo(() => {
    const active = cards.filter((c) => c.status === 'ACTIVE')
    return { count: cards.length, active: active.length, outstanding: active.reduce((s, c) => s + Number(c.balance), 0) }
  }, [cards])

  const cancel = useMutation({
    mutationFn: (id: string) => cancelGiftCard(tenantId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gift-cards', tenantId] }); toast.success('Tarjeta anulada') },
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Gift className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Tarjetas de Regalo</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Emite y redime gift cards.</p>
          </div>
        </div>
        <button onClick={() => setIssue(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Emitir tarjeta
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4"><p className="text-xs text-grafito-500">Emitidas</p><p className="text-2xl font-black text-grafito-900 dark:text-white mt-1">{metrics.count}</p></div>
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4"><p className="text-xs text-grafito-500">Activas</p><p className="text-2xl font-black text-emerald-500 mt-1">{metrics.active}</p></div>
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4"><p className="text-xs text-grafito-500">Saldo por redimir</p><p className="text-2xl font-black text-brand-500 mt-1">{formatCurrency(metrics.outstanding, 'COP')}</p></div>
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400"><Gift className="h-8 w-8" /><p className="text-sm">Aún no has emitido tarjetas.</p></div>
        ) : (
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead><tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Saldo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Vence</th><th className="px-4 py-3 text-right">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {cards.map((c) => (
                <tr key={c.id} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono font-semibold text-grafito-900 dark:text-white">{c.code}</td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{c.customers?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-grafito-900 dark:text-white">{formatCurrency(Number(c.balance), c.currency)}</p>
                    <p className="text-[11px] text-grafito-400">de {formatCurrency(Number(c.initial_balance), c.currency)}</p>
                  </td>
                  <td className="px-4 py-3"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', STATUS[c.status].cls)}>{STATUS[c.status].label}</span></td>
                  <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{c.expires_at ? new Date(c.expires_at + 'T00:00:00').toLocaleDateString('es') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button disabled={c.status !== 'ACTIVE'} onClick={() => setRedeem(c)} title="Redimir" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10 disabled:opacity-30"><CreditCard className="h-4 w-4" /></button>
                      <button disabled={c.status !== 'ACTIVE'} onClick={() => { if (confirm(`¿Anular la tarjeta ${c.code}?`)) cancel.mutate(c.id) }} title="Anular" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30"><Ban className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {issue && tenantId && <IssueModal tenantId={tenantId} onClose={() => setIssue(false)} />}
      {redeem && tenantId && <RedeemModal tenantId={tenantId} card={redeem} onClose={() => setRedeem(null)} />}
    </div>
  )
}
