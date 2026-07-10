import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CreditCard, Check, Loader2, CalendarClock, AlertTriangle, X,
  MessageCircle, Mail, Copy, Sparkles, CreditCard as CardIcon,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { getMySubscription, getPublicPlans, startWompiCheckout, type PublicPlanRow, type MySubscriptionRow } from '@lib/db'
import { BILLING, WOMPI } from '@/config/billing'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Activa',     cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  TRIAL:     { label: 'Prueba',     cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  PAST_DUE:  { label: 'Por vencer', cls: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  EXPIRED:   { label: 'Vencida',    cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
  CANCELLED: { label: 'Cancelada',  cls: 'bg-grafito-500/10 text-grafito-400 border-grafito-500/20' },
}

function money(v: number, currency: string) {
  try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v) }
  catch { return `${currency} ${v.toLocaleString('es')}` }
}

function daysLeft(end: string | null): number | null {
  if (!end) return null
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000)
}

export default function SubscriptionsPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const tenantName = useAuthStore((s) => s.tenant?.tenantName)
  const [payFor, setPayFor] = useState<PublicPlanRow | null>(null)

  const { data: sub, isLoading: loadingSub, refetch: refetchSub } = useQuery({
    queryKey: ['my-subscription', tenantId],
    queryFn: () => getMySubscription(tenantId!),
    enabled: !!tenantId,
  })
  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['public-plans'],
    queryFn: getPublicPlans,
  })

  // Retorno desde Wompi: la URL trae ?id=<transacción>. Mostramos "verificando"
  // y refrescamos la suscripción unas cuantas veces (el webhook la activa).
  const [verifying, setVerifying] = useState(
    () => new URLSearchParams(window.location.search).has('id'),
  )
  useEffect(() => {
    if (!verifying) return
    let tries = 0
    const iv = setInterval(async () => {
      tries += 1
      await refetchSub()
      if (tries >= 6) {
        clearInterval(iv)
        setVerifying(false)
        // Limpia el ?id= de la URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }, 4000)
    return () => clearInterval(iv)
  }, [verifying, refetchSub])

  const dl = daysLeft(sub?.current_period_end ?? null)
  const effectiveStatus = useMemo(() => {
    if (!sub) return null
    if (sub.status === 'ACTIVE' && dl !== null && dl < 0) return 'EXPIRED'
    if (sub.status === 'ACTIVE' && dl !== null && dl <= 5) return 'PAST_DUE'
    return sub.status
  }, [sub, dl])

  const needsAttention = effectiveStatus === 'EXPIRED' || effectiveStatus === 'PAST_DUE'

  if (loadingSub || loadingPlans) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Mi Suscripción</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Tu plan, estado de pago y renovación.</p>
      </div>

      {/* Verificando pago (retorno de Wompi) */}
      {verifying && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-500">Estamos confirmando tu pago…</p>
            <p className="text-xs text-blue-500/80 mt-0.5">Esto puede tardar unos segundos. No cierres esta página.</p>
          </div>
        </div>
      )}

      {/* Aviso de vencimiento */}
      {needsAttention && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-500">
              {effectiveStatus === 'EXPIRED' ? 'Tu suscripción venció' : 'Tu suscripción está por vencer'}
            </p>
            <p className="text-xs text-red-500/80 mt-0.5">
              {effectiveStatus === 'EXPIRED'
                ? 'Renueva para reactivar el acceso completo de tu negocio.'
                : `Te ${dl === 1 ? 'queda 1 día' : `quedan ${dl} días`}. Renueva para no perder el servicio.`}
            </p>
          </div>
          {sub && (
            <button
              onClick={() => setPayFor(plans.find(p => p.code === sub.plan) ?? plans[0] ?? null)}
              className="shrink-0 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
            >
              Renovar
            </button>
          )}
        </div>
      )}

      {/* Estado actual */}
      <CurrentPlanCard sub={sub} status={effectiveStatus} dl={dl} />

      {/* Catálogo de planes */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-grafito-400 mb-3">Planes disponibles</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = sub?.plan === p.code
            return (
              <div
                key={p.code}
                className={cn(
                  'rounded-2xl border p-6 flex flex-col justify-between space-y-5',
                  isCurrent
                    ? 'border-brand-500 ring-1 ring-brand-500/40 bg-white dark:bg-grafito-900/60'
                    : 'border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60',
                )}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-grafito-900 dark:text-white text-lg">{p.name}</h3>
                    {isCurrent && <span className="text-[10px] font-bold uppercase tracking-wide text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full">Tu plan</span>}
                  </div>
                  <div>
                    <span className="text-2xl font-extrabold text-grafito-900 dark:text-white">{money(p.price, p.currency)}</span>
                    <span className="text-sm text-grafito-400"> /mes</span>
                  </div>
                  {p.description && <p className="text-xs text-grafito-500">{p.description}</p>}
                  <ul className="space-y-2 text-sm text-grafito-600 dark:text-grafito-300">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => setPayFor(p)}
                  disabled={isCurrent && effectiveStatus === 'ACTIVE'}
                  className={cn(
                    'w-full rounded-xl py-2.5 text-sm font-semibold transition-colors',
                    isCurrent && effectiveStatus === 'ACTIVE'
                      ? 'border border-grafito-200 dark:border-white/10 text-grafito-400 cursor-default'
                      : 'bg-brand-500 text-white hover:bg-brand-600',
                  )}
                >
                  {isCurrent ? (effectiveStatus === 'ACTIVE' ? 'Plan actual' : 'Renovar este plan') : 'Solicitar este plan'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {payFor && (
        <PaymentModal plan={payFor} tenantId={tenantId} tenantName={tenantName} onClose={() => setPayFor(null)} />
      )}
    </div>
  )
}

// ── Tarjeta de plan actual ────────────────────────────────────────────────────
function CurrentPlanCard({ sub, status, dl }: { sub: MySubscriptionRow | null | undefined; status: string | null; dl: number | null }) {
  const sc = status ? STATUS_CFG[status] : null
  return (
    <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-brand-500/10 p-3"><CreditCard className="h-6 w-6 text-brand-500" /></div>
          <div>
            <p className="text-xs text-grafito-400 uppercase tracking-wide">Plan actual</p>
            <p className="text-xl font-bold text-grafito-900 dark:text-white">
              {sub ? sub.plan : 'Sin suscripción'}
              {sub && <span className="text-sm font-normal text-grafito-400"> · {money(Number(sub.price), sub.currency)}/mes</span>}
            </p>
          </div>
        </div>
        {sc && <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', sc.cls)}>{sc.label}</span>}
      </div>

      {sub?.current_period_end && (
        <div className="mt-5 flex items-center gap-2 text-sm text-grafito-500 dark:text-grafito-300">
          <CalendarClock className="h-4 w-4" />
          <span>
            {status === 'TRIAL' ? 'Prueba hasta' : 'Renueva el'}{' '}
            <span className="font-semibold text-grafito-900 dark:text-white">
              {new Date(sub.current_period_end).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            {dl !== null && (
              <span className={cn('ml-2 text-xs', dl < 0 ? 'text-red-500' : 'text-grafito-400')}>
                ({dl < 0 ? `vencido hace ${Math.abs(dl)}d` : `faltan ${dl} día${dl === 1 ? '' : 's'}`})
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Modal de pago manual ──────────────────────────────────────────────────────
function PaymentModal({ plan, tenantId, tenantName, onClose }: { plan: PublicPlanRow; tenantId?: string; tenantName?: string; onClose: () => void }) {
  const msg = `Hola, quiero activar el plan ${plan.name} (${money(plan.price, plan.currency)}/mes) para mi negocio "${tenantName ?? ''}". Adjunto el comprobante de pago.`
  const waUrl = `https://wa.me/${BILLING.whatsapp}?text=${encodeURIComponent(msg)}`
  const mailUrl = `mailto:${BILLING.email}?subject=${encodeURIComponent('Activación de plan ' + plan.name)}&body=${encodeURIComponent(msg)}`

  const copy = (t: string) => { navigator.clipboard?.writeText(t); }

  const wompiOn = WOMPI.enabled && !!tenantId
  const [paying, setPaying] = useState(false)
  const payWithWompi = async () => {
    if (!tenantId) return
    setPaying(true)
    try {
      const res = await startWompiCheckout(tenantId, plan.code, `${window.location.origin}/subscriptions`)
      window.location.href = res.checkoutUrl
    } catch (e: any) {
      setPaying(false)
      toast.error(e?.message ?? 'No se pudo iniciar el pago en línea')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" /> Activar {plan.name}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-2xl font-extrabold text-grafito-900 dark:text-white">{money(plan.price, plan.currency)}<span className="text-sm font-normal text-grafito-400"> /mes</span></p>

        {wompiOn && (
          <div className="mt-4 space-y-2">
            <button
              onClick={payWithWompi}
              disabled={paying}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CardIcon className="h-4 w-4" />}
              Pagar en línea con Wompi
            </button>
            <p className="text-[11px] text-grafito-400 text-center">Tarjeta, PSE, Nequi o Bancolombia. Activación automática.</p>
            <div className="flex items-center gap-3 pt-1">
              <div className="h-px flex-1 bg-grafito-200 dark:bg-white/10" />
              <span className="text-[10px] uppercase tracking-wide text-grafito-400">o paga manual</span>
              <div className="h-px flex-1 bg-grafito-200 dark:bg-white/10" />
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-grafito-50 dark:bg-white/5 border border-grafito-200 dark:border-white/10 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-grafito-400">Cómo pagar</p>
          <ol className="space-y-1.5 text-sm text-grafito-600 dark:text-grafito-300 list-decimal list-inside">
            <li>Paga a nombre de <span className="font-semibold">{BILLING.beneficiary}</span> por uno de estos medios.</li>
            <li>Envíanos el comprobante por WhatsApp o correo.</li>
            <li>Activamos tu plan (normalmente el mismo día).</li>
          </ol>
          {BILLING.methods.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {BILLING.methods.map((m) => (
                <div key={m.label} className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-grafito-800/60 border border-grafito-200 dark:border-white/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-grafito-400">{m.label}</p>
                    <p className="text-sm font-semibold text-grafito-900 dark:text-white truncate">{m.value}</p>
                  </div>
                  <button onClick={() => copy(m.value)} title="Copiar" className="shrink-0 rounded-md p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={waUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <a href={mailUrl} className="inline-flex items-center justify-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
            <Mail className="h-4 w-4" /> Correo
          </a>
        </div>
        <p className="mt-3 text-[11px] text-grafito-400 text-center">
          {wompiOn
            ? 'El pago en línea se activa solo; el pago manual lo verifica el equipo.'
            : 'Pago manual verificado por el equipo. Pronto habilitaremos pago con tarjeta/PSE en línea.'}
        </p>
      </div>
    </div>
  )
}
