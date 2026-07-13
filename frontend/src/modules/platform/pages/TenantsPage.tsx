import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAllTenants, setTenantPlan, setTenantActive, deleteTenant,
  type PlatformTenantRow,
} from '@lib/db'
import {
  Building2, Search, Loader2, CheckCircle, AlertCircle,
  Globe, Calendar, Plus, Power, Pencil, Trash2, MoreVertical, X,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { CreateTenantModal } from '../components/CreateTenantModal'
import { EditTenantModal } from '../components/EditTenantModal'
import { toast } from 'sonner'

const PLAN_STYLES: Record<string, string> = {
  FREE:         'bg-grafito-500/10 text-grafito-400',
  BASIC:        'bg-blue-500/10 text-blue-400',
  PROFESSIONAL: 'bg-purple-500/10 text-purple-400',
  ENTERPRISE:   'bg-brand-500/10 text-brand-400',
}

const BIZ_LABELS: Record<string, string> = {
  STORE: 'Tienda', RESTAURANT: 'Restaurante', CAFE: 'Cafeteria',
  BAR: 'Bar', SERVICE: 'Servicios', WHOLESALE: 'Mayorista',
  RESTOBAR: 'Resto-Bar', BAKERY: 'Panadería', ICE_CREAM_SHOP: 'Heladería',
  PHARMACY: 'Farmacia', MINIMARKET: 'Minimarket', CUSTOM: 'Otro',
}

// ── Confirmation Dialog ──────────────────────────────────────
interface ConfirmDeleteDialogProps {
  tenant: PlatformTenantRow | null
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

function ConfirmDeleteDialog({ tenant, onConfirm, onCancel, isPending }: ConfirmDeleteDialogProps) {
  if (!tenant) return null
  const primary = tenant.primary_color || '#F20D18'
  const secondary = tenant.secondary_color || '#111827'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-red-500/20 bg-white dark:bg-grafito-900 shadow-2xl overflow-hidden">
        {/* Top colored bar */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, #ef4444, #dc2626)` }} />
        <div className="p-6 space-y-4">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 rounded-md text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden shrink-0 shadow"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
              {tenant.logo_url
                ? <img src={tenant.logo_url} alt={tenant.name} className="h-full w-full object-cover" />
                : <span className="text-white font-bold text-lg">{tenant.name.charAt(0).toUpperCase()}</span>
              }
            </div>
            <div>
              <h3 className="font-bold text-grafito-900 dark:text-white">Eliminar Tenant</h3>
              <p className="text-sm text-grafito-500">{tenant.name}</p>
            </div>
          </div>

          <div className="rounded-xl bg-red-500/8 border border-red-500/20 p-3">
            <p className="text-sm text-red-500 font-medium">⚠️ Esta acción es irreversible</p>
            <p className="text-xs text-grafito-500 dark:text-grafito-400 mt-1">
              Se eliminarán permanentemente todas las sucursales, suscripciones, usuarios
              y datos asociados a <strong className="text-grafito-700 dark:text-grafito-200">{tenant.name}</strong>.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isPending}
              className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="flex-[1.5] flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Actions Menu ─────────────────────────────────────────────
function ActionsMenu({
  tenant,
  onEdit,
  onDelete,
  onToggleActive,
  isPending,
}: {
  tenant: PlatformTenantRow
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    // position:fixed usa coordenadas de viewport — sin window.scrollY
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })
  }, [open])

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
        title="Acciones"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {/* Portal al body: el contenedor de la tabla tiene backdrop-filter,
          que convierte position:fixed en relativo a él, y su overflow-hidden
          recortaba el menú — por eso "desaparecía" al abrirse. */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 min-w-[170px] rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 shadow-xl overflow-hidden"
            style={{ top: pos.top, right: pos.right }}
          >
            <button
              onClick={() => { setOpen(false); onEdit() }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-grafito-700 dark:text-grafito-200 hover:bg-grafito-50 dark:hover:bg-white/5"
            >
              <Pencil className="h-3.5 w-3.5 text-blue-400" />
              Editar
            </button>
            <button
              onClick={() => { setOpen(false); onToggleActive() }}
              disabled={isPending}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-grafito-50 dark:hover:bg-white/5 disabled:opacity-50"
            >
              <Power className={cn('h-3.5 w-3.5', tenant.is_active ? 'text-yellow-400' : 'text-emerald-400')} />
              <span className={tenant.is_active ? 'text-yellow-500' : 'text-emerald-500'}>
                {tenant.is_active ? 'Desactivar' : 'Activar'}
              </span>
            </button>
            <div className="h-px bg-grafito-100 dark:bg-white/5 mx-3 my-1" />
            <button
              onClick={() => { setOpen(false); onDelete() }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function TenantsPage() {
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState<string>('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [editTenant, setEditTenant] = useState<PlatformTenantRow | null>(null)
  const [deletingTenant, setDeletingTenant] = useState<PlatformTenantRow | null>(null)
  const qc = useQueryClient()

  const { data: tenants = [], isLoading, isError, error } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: getAllTenants,
  })

  if (isError) {
    return (
      <div className="p-6 text-red-500 text-sm">
        ERROR FETCHING TENANTS: {(error as Error)?.message ?? JSON.stringify(error)}
      </div>
    )
  }

  const activeMutation = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => setTenantActive(vars.id, vars.active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-tenants'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTenant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-tenants'] })
      qc.invalidateQueries({ queryKey: ['platform-stats'] })
      toast.success('Tenant eliminado correctamente')
      setDeletingTenant(null)
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Error al eliminar el tenant')
    },
  })

  const filtered = tenants.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
    const matchPlan = filterPlan === 'ALL' || t.plan === filterPlan
    return matchSearch && matchPlan
  })

  const planFilters = ['ALL', ...Array.from(new Set(tenants.map((t) => t.plan)))]

  return (
    <div className="space-y-6 p-6">
      <CreateTenantModal open={showCreate} onClose={() => setShowCreate(false)} />
      <EditTenantModal tenant={editTenant} onClose={() => setEditTenant(null)} />
      <ConfirmDeleteDialog
        tenant={deletingTenant}
        onConfirm={() => deletingTenant && deleteMutation.mutate(deletingTenant.id)}
        onCancel={() => setDeletingTenant(null)}
        isPending={deleteMutation.isPending}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Tenants</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">
            {tenants.length} empresa{tenants.length !== 1 ? 's' : ''} registradas en la plataforma.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nuevo tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 text-grafito-900 dark:text-white placeholder-grafito-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {planFilters.map((p) => (
            <button
              key={p}
              onClick={() => setFilterPlan(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                filterPlan === p
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'border-grafito-200 dark:border-white/10 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5',
              )}
            >
              {p === 'ALL' ? 'Todos' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 backdrop-blur-md overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-grafito-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-grafito-400">
            <Building2 className="h-8 w-8" />
            <p className="text-sm">
              {search || filterPlan !== 'ALL' ? 'Sin resultados para ese filtro.' : 'Sin tenants registrados.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5">
                <th className="px-6 py-3">Empresa</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">País</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Suscripción</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Registro</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {filtered.map((t) => {
                const sub = t.subscriptions?.[0]
                const primary = t.primary_color || '#F20D18'
                const secondary = t.secondary_color || '#111827'
                return (
                  <tr key={t.id} className="hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors">
                    {/* Empresa con avatar de colores */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center font-bold text-base overflow-hidden shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                        >
                          {t.logo_url ? (
                            <img src={t.logo_url} alt={t.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-white">{t.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-grafito-900 dark:text-white">{t.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs font-mono text-grafito-400">{t.slug}</p>
                            {/* Color dots */}
                            <span className="flex gap-0.5 items-center">
                              <span className="h-2.5 w-2.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: primary }} title={`Primario: ${primary}`} />
                              <span className="h-2.5 w-2.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: secondary }} title={`Secundario: ${secondary}`} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-grafito-500 dark:text-grafito-400 text-xs">
                      {BIZ_LABELS[t.business_type] ?? t.business_type}
                    </td>

                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-xs text-grafito-500 dark:text-grafito-400">
                        <Globe className="h-3.5 w-3.5" />
                        {t.country}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'text-[10px] px-2 py-1 rounded-lg font-bold',
                          PLAN_STYLES[t.plan] ?? 'bg-grafito-500/10 text-grafito-400',
                        )}
                      >
                        {t.plan}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {sub ? (
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-bold',
                            sub.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : sub.status === 'TRIAL'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-yellow-500/10 text-yellow-400',
                          )}
                        >
                          {sub.status}
                        </span>
                      ) : (
                        <span className="text-xs text-grafito-400">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {t.is_active ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Inactivo
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-grafito-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(t.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <ActionsMenu
                        tenant={t}
                        onEdit={() => setEditTenant(t)}
                        onDelete={() => setDeletingTenant(t)}
                        onToggleActive={() => activeMutation.mutate({ id: t.id, active: !t.is_active })}
                        isPending={activeMutation.isPending}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
