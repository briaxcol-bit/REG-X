import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPlans, setPlanPrice, setPlanFeatures, setPlanActive, createPlan, deletePlan,
  getTenantSubscriptions, activateSubscription, renewSubscription, cancelSubscription,
  type PlanCode, type PlanRow, type TenantSubscriptionRow,
} from '@lib/db'
import {
  CreditCard, Loader2, Check, RefreshCw, XCircle, Save, CalendarClock,
  Plus, Trash2, Pencil, EyeOff, Eye, Info, X,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'

const PLAN_ORDER: PlanCode[] = ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE']

const PLAN_ACCENT: Record<string, string> = {
  FREE:         'text-grafito-400',
  BASIC:        'text-blue-400',
  PROFESSIONAL: 'text-purple-400',
  ENTERPRISE:   'text-brand-400',
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:    'bg-emerald-500/10 text-emerald-400',
  TRIAL:     'bg-blue-500/10 text-blue-400',
  PAST_DUE:  'bg-yellow-500/10 text-yellow-400',
  EXPIRED:   'bg-red-500/10 text-red-400',
  CANCELLED: 'bg-grafito-500/10 text-grafito-400',
}

function daysLeft(end: string | null): number | null {
  if (!end) return null
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000)
}

// ── Tarjeta de plan (precio y features editables) ────────────────────────
function PlanCard({ plan }: { plan: PlanRow }) {
  const qc = useQueryClient()
  const [price, setPrice] = useState(String(plan.price))
  const [features, setFeatures] = useState<string[]>(plan.features ?? [])
  const [newFeature, setNewFeature] = useState('')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')

  const dirtyPrice    = Number(price) !== Number(plan.price)
  const dirtyFeatures = JSON.stringify(features) !== JSON.stringify(plan.features ?? [])
  const dirty = dirtyPrice || dirtyFeatures

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['plans'] })
    qc.invalidateQueries({ queryKey: ['tenant-subscriptions'] })
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (dirtyPrice)    await setPlanPrice(plan.code, Number(price))
      if (dirtyFeatures) await setPlanFeatures(plan.code, features)
    },
    onSuccess: invalidate,
  })

  const addFeature = () => {
    const val = newFeature.trim()
    if (!val) return
    setFeatures((f) => [...f, val])
    setNewFeature('')
  }

  const removeFeature = (i: number) => setFeatures((f) => f.filter((_, idx) => idx !== i))

  const startEdit = (i: number) => { setEditIdx(i); setEditVal(features[i]) }
  const confirmEdit = () => {
    if (editIdx === null) return
    const val = editVal.trim()
    if (!val) return
    setFeatures((f) => f.map((x, i) => (i === editIdx ? val : x)))
    setEditIdx(null)
  }

  const toggleActive = useMutation({
    mutationFn: () => setPlanActive(plan.code, !plan.is_active),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: () => deletePlan(plan.code),
    onSuccess: invalidate,
  })

  return (
    <div className={cn(
      'rounded-2xl border p-5 flex flex-col gap-3 transition-opacity',
      plan.is_active
        ? 'border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60'
        : 'border-dashed border-grafito-300 dark:border-white/10 bg-grafito-50 dark:bg-grafito-900/30 opacity-60',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-bold', PLAN_ACCENT[plan.code])}>{plan.name}</span>
          {!plan.is_active && (
            <span className="text-[9px] uppercase tracking-wide bg-grafito-200 dark:bg-white/10 text-grafito-500 dark:text-grafito-400 px-1.5 py-0.5 rounded-full font-bold">Oculto</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-grafito-400">{plan.code}</span>
          <button
            onClick={() => toggleActive.mutate()}
            disabled={toggleActive.isPending}
            title={plan.is_active ? 'Desactivar plan (ocultarlo)' : 'Activar plan'}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              plan.is_active
                ? 'text-grafito-400 hover:text-red-400 hover:bg-red-500/10'
                : 'text-emerald-400 hover:bg-emerald-500/10',
            )}
          >
            {toggleActive.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : plan.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Precio */}
      <div className="flex items-end gap-1 overflow-hidden">
        <span className="text-grafito-400 text-xs mb-1 shrink-0">{plan.currency}</span>
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="flex-1 min-w-0 w-full bg-transparent text-xl font-extrabold text-grafito-900 dark:text-white border-b border-grafito-200 dark:border-white/10 focus:border-brand-500 focus:outline-none"
        />
        <span className="text-grafito-400 text-xs mb-1 shrink-0">/mes</span>
      </div>

      {/* Features editables */}
      <div className="flex flex-col gap-1.5 flex-1">
        <p className="text-[10px] uppercase font-semibold tracking-wide text-grafito-400 mb-0.5">Incluye</p>
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-1 group">
            {editIdx === i ? (
              <>
                <input
                  autoFocus
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditIdx(null) }}
                  className="flex-1 min-w-0 text-xs px-2 py-1 rounded-lg bg-grafito-50 dark:bg-white/5 border border-brand-500 text-grafito-900 dark:text-white outline-none"
                />
                <button onClick={confirmEdit} className="shrink-0 rounded-md p-1 text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                  <Check className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                <span className="flex-1 text-xs text-grafito-500 dark:text-grafito-300 truncate">{f}</span>
                <button
                  onClick={() => startEdit(i)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 rounded-md p-1 text-grafito-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => removeFeature(i)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 rounded-md p-1 text-grafito-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ))}

        {/* Agregar feature */}
        <div className="flex items-center gap-1.5 mt-1">
          <input
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addFeature() }}
            placeholder="Nueva característica..."
            className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-lg bg-grafito-50 dark:bg-white/5 border border-grafito-200 dark:border-white/10 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={addFeature}
            disabled={!newFeature.trim()}
            className="shrink-0 rounded-lg bg-brand-500/10 p-1.5 text-brand-500 hover:bg-brand-500/20 disabled:opacity-30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Guardar */}
      <div className="flex gap-2">
        <button
          onClick={() => mut.mutate()}
          disabled={!dirty || mut.isPending}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition-colors',
            dirty
              ? 'bg-brand-500 text-white hover:bg-brand-600'
              : 'border border-grafito-200 dark:border-white/10 text-grafito-400 cursor-default',
          )}
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {mut.isSuccess && !dirty ? 'Guardado' : 'Guardar'}
        </button>
        <button
          onClick={() => {
            if (!confirm(`¿Eliminar el plan "${plan.name}"? Solo se puede si no hay tenants activos usándolo.`)) return
            deleteMut.mutate()
          }}
          disabled={deleteMut.isPending}
          title="Eliminar plan"
          className="rounded-xl border border-red-500/20 px-3 py-2 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
        >
          {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Modal para crear un plan nuevo ─────────────────────────────────
function CreatePlanModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [code, setCode]       = useState('')
  const [name, setName]       = useState('')
  const [desc, setDesc]       = useState('')
  const [price, setPrice]     = useState('0')
  const [currency, setCurrency] = useState('COP')
  const [featureInput, setFeatureInput] = useState('')
  const [features, setFeatures] = useState<string[]>([])

  const addFeat = () => {
    const v = featureInput.trim()
    if (!v) return
    setFeatures((f) => [...f, v])
    setFeatureInput('')
  }

  const mut = useMutation({
    mutationFn: () => createPlan({
      code, name, description: desc || undefined,
      price: Number(price), currency, features,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      onClose()
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">Nuevo Plan</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mut.isError && (
          <p className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            {(mut.error as any)?.message ?? 'Error al crear el plan'}
          </p>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Código</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                placeholder="STARTER"
                className="w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Starter"
                className="w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Descripción</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Plan de arranque para emprendedores"
              className="w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Precio</label>
              <input
                type="number" min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white focus:border-brand-500 focus:outline-none"
              >
                <option>COP</option>
                <option>USD</option>
                <option>EUR</option>
                <option>MXN</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">Características</label>
            <div className="space-y-1.5">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span className="flex-1 text-xs text-grafito-500 dark:text-grafito-300">{f}</span>
                  <button onClick={() => setFeatures((fs) => fs.filter((_, idx) => idx !== i))} className="text-grafito-400 hover:text-red-400 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeat() } }}
                  placeholder="Agregar característica..."
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={addFeat}
                  disabled={!featureInput.trim()}
                  className="rounded-lg bg-brand-500/10 p-1.5 text-brand-500 hover:bg-brand-500/20 disabled:opacity-30 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!code.trim() || !name.trim() || mut.isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear plan
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Fila de suscripción por tenant ───────────────────────────
function SubRow({ row, plans }: { row: TenantSubscriptionRow; plans: PlanRow[] }) {
  const qc = useQueryClient()
  const sub = row.subscriptions?.[0]
  const [plan, setPlan] = useState<string>(sub?.plan ?? row.plan ?? 'BASIC')
  const [override, setOverride] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tenant-subscriptions'] })
    qc.invalidateQueries({ queryKey: ['platform-tenants'] })
  }

  const activate = useMutation({
    mutationFn: () => activateSubscription(row.id, plan as PlanCode, override ? Number(override) : undefined),
    onSuccess: () => { setOverride(''); invalidate() },
  })
  const renew  = useMutation({ mutationFn: () => renewSubscription(row.id), onSuccess: invalidate })
  const cancel = useMutation({ mutationFn: () => cancelSubscription(row.id), onSuccess: invalidate })

  const busy = activate.isPending || renew.isPending || cancel.isPending
  const end  = sub?.current_period_end ?? null
  const dl   = daysLeft(end)
  const expired = dl !== null && dl < 0
  const status = expired && sub?.status === 'ACTIVE' ? 'EXPIRED' : (sub?.status ?? '—')

  return (
    <tr className="hover:bg-grafito-50 dark:hover:bg-white/5 align-top">
      <td className="px-4 py-4">
        <p className="font-semibold text-grafito-900 dark:text-white">{row.name}</p>
        <p className="text-xs font-mono text-grafito-400">{row.slug}</p>
      </td>
      <td className="px-4 py-4">
        {sub ? (
          <span className="text-sm text-grafito-700 dark:text-grafito-200">
            {sub.currency} {Number(sub.price).toLocaleString('es')}
          </span>
        ) : <span className="text-xs text-grafito-400">—</span>}
      </td>
      <td className="px-4 py-4">
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', STATUS_STYLES[status] ?? 'bg-grafito-100 text-grafito-500')}>
          {status}
        </span>
      </td>
      <td className="px-4 py-4 text-xs">
        {end ? (
          <div className={cn('flex items-center gap-1', expired ? 'text-red-400' : 'text-grafito-500 dark:text-grafito-300')}>
            <CalendarClock className="h-3.5 w-3.5" />
            <div>
              <div>{new Date(end).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div className={cn('text-[10px]', expired ? 'text-red-400' : 'text-grafito-400')}>
                {dl === null ? '' : expired ? `vencido hace ${Math.abs(dl)}d` : `${dl} día${dl === 1 ? '' : 's'}`}
              </div>
            </div>
          </div>
        ) : <span className="text-grafito-400">sin activar</span>}
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            disabled={busy}
            className="text-xs px-2 py-1.5 rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 text-grafito-900 dark:text-white"
          >
            {plans.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}
          </select>
          <input
            type="number"
            min={0}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="precio*"
            title="Opcional: precio personalizado para este tenant"
            disabled={busy}
            className="w-20 text-xs px-2 py-1.5 rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 text-grafito-900 dark:text-white placeholder-grafito-400"
          />
          <button
            onClick={() => activate.mutate()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {activate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Activar
          </button>
          <button
            onClick={() => renew.mutate()}
            disabled={busy || !sub}
            title="Renovar 1 mes"
            className="inline-flex items-center gap-1 rounded-lg border border-grafito-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 disabled:opacity-40"
          >
            {renew.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Renovar
          </button>
          <button
            onClick={() => cancel.mutate()}
            disabled={busy || !sub}
            title="Cancelar"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-40"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function PlatformPlansPage() {
  const [showCreate, setShowCreate] = useState(false)
  const { data: plans = [], isLoading: loadingPlans } = useQuery({ queryKey: ['plans'], queryFn: getPlans })
  const { data: subs = [], isLoading: loadingSubs } = useQuery({ queryKey: ['tenant-subscriptions'], queryFn: getTenantSubscriptions })

  const mrr = subs.reduce((sum, t) => {
    const s = t.subscriptions?.[0]
    return sum + (s && s.status === 'ACTIVE' ? Number(s.price) : 0)
  }, 0)

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Suscripciones</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">
          Edita los precios de los planes y gestiona la suscripción de cada empresa (dura 1 mes desde la activación).
        </p>
      </div>

      {/* Catálogo de planes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-grafito-400">Catálogo de planes</h2>
            <p className="text-xs text-grafito-400 dark:text-grafito-500 mt-0.5">
              Crea nuevos planes dinámicos o edita los existentes. Oculta (👁) los que no quieras ofrecer.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Plan
          </button>
        </div>

        {loadingPlans ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => <PlanCard key={p.code} plan={p} />)}
          </div>
        )}
      </section>

      {/* Suscripciones por tenant */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-grafito-400">Suscripciones por empresa</h2>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-500 font-semibold">
            <CreditCard className="h-4 w-4" /> MRR: ${mrr.toLocaleString('es')}/mes
          </div>
        </div>

        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
          {loadingSubs ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
          ) : (
            <table className="w-full text-left text-sm min-w-[820px]">
              <thead>
                <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5">
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3">Gestionar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                {subs.map((row) => <SubRow key={row.id} row={row} plans={plans} />)}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-[11px] text-grafito-400">* precio opcional: deja vacío para usar el del catálogo, o escribe un valor para un precio personalizado a esa empresa.</p>
      </section>

      {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
