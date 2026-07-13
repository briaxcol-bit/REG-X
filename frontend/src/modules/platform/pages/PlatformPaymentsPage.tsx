import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Landmark, CheckCircle2, XCircle, AlertTriangle, Copy, Check,
  Loader2, TrendingUp, Clock, RefreshCw, ExternalLink,
} from 'lucide-react'
import { getAllPayments, type AdminPaymentRow } from '@lib/db'
import { WOMPI } from '@/config/billing'
import { formatCurrency } from '@shared/utils/format'
import { cn } from '@shared/utils/cn'

// ─────────────────────────────────────────────────────────────────────────────
// PASARELA DE PAGOS (Wompi) — dashboard solo SUPER_ADMIN
// Muestra: (1) checklist de lo que Wompi necesita para funcionar,
// (2) métricas de cobro y (3) historial de transacciones de todos los tenants.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = (import.meta.env['VITE_SUPABASE_URL'] as string) ?? ''
const WEBHOOK_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/wompi-webhook` : ''

type CheckState = 'ok' | 'missing' | 'manual'

interface CheckItem {
  label: string
  detail: string
  state: CheckState
}

const STATE_CFG: Record<CheckState, { Icon: typeof CheckCircle2; text: string; bg: string; chip: string }> = {
  ok:      { Icon: CheckCircle2, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', chip: 'Listo' },
  missing: { Icon: XCircle,      text: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-500/10',    chip: 'Falta' },
  manual:  { Icon: AlertTriangle,text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-400/10',   chip: 'Por verificar' },
}

const STATUS_CFG: Record<AdminPaymentRow['status'], { label: string; cls: string }> = {
  APPROVED: { label: 'Aprobado',  cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  PENDING:  { label: 'Pendiente', cls: 'bg-amber-400/10 text-amber-600 dark:text-amber-400' },
  DECLINED: { label: 'Rechazado', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  VOIDED:   { label: 'Anulado',   cls: 'bg-grafito-500/10 text-grafito-500' },
  ERROR:    { label: 'Error',     cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PlatformPaymentsPage() {
  const [copied, setCopied] = useState(false)

  const { data: payments = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => getAllPayments(200),
    retry: false,
    refetchInterval: 60_000,
  })

  // La tabla no existe todavía → migración 025 sin aplicar.
  const migrationMissing = isError && /payment_transactions|does not exist|relation/i.test(String((error as any)?.message ?? ''))

  const keyPrefix = WOMPI.publicKey.slice(0, 8)
  const isProd = keyPrefix.startsWith('pub_prod')

  const checks: CheckItem[] = [
    {
      label: 'Llave pública (frontend)',
      detail: WOMPI.enabled ? `${keyPrefix}… configurada` : 'VITE_WOMPI_PUBLIC_KEY vacía — la UI cae a cobro manual',
      state: WOMPI.enabled ? 'ok' : 'missing',
    },
    {
      label: 'Ambiente',
      detail: !WOMPI.enabled ? 'Sin llave, sin ambiente' : isProd ? 'Producción (pagos reales)' : 'Sandbox (pruebas)',
      state: !WOMPI.enabled ? 'missing' : isProd ? 'ok' : 'manual',
    },
    {
      label: 'Tabla de pagos (migración 025)',
      detail: migrationMissing ? 'No encontrada — aplica 025_wompi_payments.sql' : 'Detectada y accesible',
      state: migrationMissing ? 'missing' : 'ok',
    },
    {
      label: 'Edge Functions (checkout + webhook)',
      detail: 'No se detectan desde el frontend — verifícalas en Supabase → Functions',
      state: 'manual',
    },
    {
      label: 'URL de eventos en el panel de Wompi',
      detail: 'Debe apuntar al webhook (ver abajo) en el ambiente correspondiente',
      state: 'manual',
    },
  ]

  const readyCount = checks.filter(c => c.state === 'ok').length

  const metrics = useMemo(() => {
    const approved = payments.filter(p => p.status === 'APPROVED')
    const pending  = payments.filter(p => p.status === 'PENDING')
    const collected = approved.reduce((s, p) => s + p.amount_in_cents, 0) / 100
    const activated = payments.filter(p => p.applied_at).length
    return { approvedCount: approved.length, pendingCount: pending.length, collected, activated }
  }, [payments])

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* noop */ }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5">
            <Landmark className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Pasarela de Pagos · Wompi</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">
              Estado de la integración, cobros y transacciones de toda la plataforma.
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors shrink-0"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> Actualizar
        </button>
      </div>

      {/* Banner global de estado */}
      <div className={cn(
        'rounded-2xl border p-4 flex items-center gap-3',
        WOMPI.enabled && !migrationMissing
          ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/[0.06]'
          : 'border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-400/[0.06]',
      )}>
        {WOMPI.enabled && !migrationMissing
          ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          : <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />}
        <p className="text-sm text-grafito-700 dark:text-grafito-200">
          {WOMPI.enabled && !migrationMissing
            ? <>Wompi está <span className="font-semibold text-emerald-600 dark:text-emerald-400">activo</span> en modo <span className="font-semibold">{isProd ? 'Producción' : 'Sandbox'}</span>. {readyCount}/{checks.length} verificaciones automáticas en verde.</>
            : <>Wompi está en <span className="font-semibold text-amber-600 dark:text-amber-400">cobro manual</span>. Completa el checklist para activar el pago en línea.</>}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Recaudado (aprobado)" value={formatCurrency(metrics.collected, 'COP')} Icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />
        <MetricCard label="Pagos aprobados" value={String(metrics.approvedCount)} Icon={CheckCircle2} color="text-brand-500" bg="bg-brand-500/10" />
        <MetricCard label="Suscripciones activadas" value={String(metrics.activated)} Icon={RefreshCw} color="text-purple-500" bg="bg-purple-500/10" />
        <MetricCard label="Pendientes" value={String(metrics.pendingCount)} Icon={Clock} color="text-amber-500" bg="bg-amber-400/10" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Checklist de configuración */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-grafito-100 dark:border-white/5 flex items-center justify-between">
            <h2 className="font-semibold text-grafito-900 dark:text-white text-sm">Qué necesita Wompi</h2>
            <span className="text-xs text-grafito-400">{readyCount}/{checks.length} auto</span>
          </div>
          <div className="divide-y divide-grafito-100 dark:divide-white/5">
            {checks.map(c => {
              const cfg = STATE_CFG[c.state]
              return (
                <div key={c.label} className="flex items-start gap-3 px-5 py-3">
                  <div className={cn('rounded-md p-1 mt-0.5', cfg.bg)}>
                    <cfg.Icon className={cn('h-3.5 w-3.5', cfg.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-grafito-800 dark:text-grafito-100">{c.label}</p>
                    <p className="text-xs text-grafito-500 mt-0.5">{c.detail}</p>
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap', cfg.bg, cfg.text)}>
                    {cfg.chip}
                  </span>
                </div>
              )
            })}
          </div>

          {/* URL del webhook para copiar */}
          <div className="px-5 py-4 border-t border-grafito-100 dark:border-white/5 bg-grafito-50 dark:bg-white/[0.02]">
            <p className="text-xs font-semibold text-grafito-500 mb-1.5">URL de eventos (webhook) para Wompi</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-xs text-grafito-700 dark:text-grafito-300 bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 rounded-lg px-2.5 py-1.5">
                {WEBHOOK_URL || 'Configura VITE_SUPABASE_URL'}
              </code>
              <button
                onClick={copyWebhook}
                disabled={!WEBHOOK_URL}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors disabled:opacity-40 shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <a
              href="https://comercios.wompi.co"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-500 hover:underline mt-2.5"
            >
              Abrir panel de comercios de Wompi <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Historial de transacciones */}
        <div className="lg:col-span-2 rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-grafito-100 dark:border-white/5">
            <h2 className="font-semibold text-grafito-900 dark:text-white text-sm">Transacciones recientes</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin text-grafito-400" />
            </div>
          ) : migrationMissing ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6 gap-1">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <p className="text-sm font-medium text-grafito-700 dark:text-grafito-200">Falta la migración 025</p>
              <p className="text-xs text-grafito-500">Aplica <code>025_wompi_payments.sql</code> en Supabase para empezar a registrar pagos.</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6 gap-1">
              <XCircle className="h-6 w-6 text-rose-500" />
              <p className="text-sm text-grafito-600 dark:text-grafito-300">No se pudieron cargar las transacciones.</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-grafito-400">
              Aún no hay transacciones registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold text-grafito-500 uppercase border-b border-grafito-100 dark:border-white/5">
                    <th className="px-5 py-2.5">Tenant</th>
                    <th className="px-5 py-2.5">Plan</th>
                    <th className="px-5 py-2.5 text-right">Monto</th>
                    <th className="px-5 py-2.5">Estado</th>
                    <th className="px-5 py-2.5">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                  {payments.slice(0, 25).map(p => {
                    const sc = STATUS_CFG[p.status]
                    return (
                      <tr key={p.id} className="hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-grafito-900 dark:text-white truncate max-w-[160px]">{p.tenant_name ?? '—'}</p>
                          <p className="text-[11px] text-grafito-400 font-mono truncate max-w-[160px]">{p.reference}</p>
                        </td>
                        <td className="px-5 py-2.5 text-grafito-600 dark:text-grafito-300 text-xs">{p.plan_code}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-grafito-800 dark:text-grafito-100">
                          {formatCurrency(p.amount_in_cents / 100, p.currency)}
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', sc.cls)}>{sc.label}</span>
                        </td>
                        <td className="px-5 py-2.5 text-xs text-grafito-500 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, Icon, color, bg }: {
  label: string; value: string; Icon: typeof TrendingUp; color: string; bg: string
}) {
  return (
    <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-grafito-500 dark:text-grafito-400">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', bg)}>
          <Icon className={cn('h-5 w-5', color)} />
        </div>
      </div>
      <p className="text-2xl font-bold text-grafito-900 dark:text-white">{value}</p>
    </div>
  )
}
