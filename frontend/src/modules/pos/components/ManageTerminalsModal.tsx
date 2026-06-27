import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, Plus, Trash2, Monitor, Check, AlertTriangle,
  Save, Pencil, ArrowLeft, Receipt, CreditCard,
} from 'lucide-react'
import { useAuthStore } from '@store/auth.store'
import {
  getPOSTerminals, upsertPOSTerminal, deletePOSTerminal, getEmployees,
  type POSTerminalWithCashier, type POSTerminalMode,
} from '@lib/db'
import { useCategories } from '@modules/products/hooks/useProducts'
import { cn } from '@shared/utils/cn'
import { toast } from 'sonner'

interface TerminalForm {
  id?: string
  name: string
  cashier_id: string
  mode: POSTerminalMode
  allowed_category_ids: string[] | null
  notes: string
  is_active: boolean
}

const EMPTY_FORM: TerminalForm = {
  name: '', cashier_id: '', mode: 'FULL',
  allowed_category_ids: null, notes: '', is_active: true,
}

// ── Vista: Lista de terminales ────────────────────────────────
function ListView({ terminals, isLoading, onNew, onEdit, onDelete, deleting }: {
  terminals: POSTerminalWithCashier[]
  isLoading: boolean
  onNew: () => void
  onEdit: (t: POSTerminalWithCashier) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="h-5 w-5 rounded-full border-2 border-grafito-200 border-t-brand-500" />
          </div>
        ) : terminals.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-grafito-100 dark:bg-white/5">
              <Monitor className="h-6 w-6 text-grafito-300 dark:text-grafito-600" />
            </div>
            <p className="text-sm font-semibold text-grafito-600 dark:text-grafito-400">Sin terminales</p>
            <p className="text-xs text-grafito-400 max-w-[180px] leading-relaxed">
              Agrega puntos de venta para asignar a tus cajeros
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {terminals.map(t => (
              <div key={t.id} className={cn(
                'rounded-xl border bg-white dark:bg-grafito-800 overflow-hidden transition-opacity',
                !t.is_active && 'opacity-50',
              )}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    t.mode === 'FULL'
                      ? 'bg-brand-50 dark:bg-brand-500/10'
                      : 'bg-amber-50 dark:bg-amber-500/10',
                  )}>
                    {t.mode === 'FULL'
                      ? <CreditCard className="h-4 w-4 text-brand-500" />
                      : <Receipt className="h-4 w-4 text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-grafito-900 dark:text-white truncate">{t.name}</p>
                      {!t.is_active && (
                        <span className="shrink-0 rounded-full bg-grafito-100 dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-grafito-400 uppercase tracking-wide">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-grafito-400 truncate mt-0.5">
                      {t.cashier?.full_name ?? 'Sin cajero asignado'}
                      {' · '}
                      {t.mode === 'FULL' ? 'Factura y cobra' : 'Solo comandas'}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => onEdit(t)}
                      className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 hover:text-grafito-700 dark:hover:text-white transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setConfirmId(t.id)}
                      className="rounded-lg p-1.5 text-grafito-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Confirm delete inline */}
                <AnimatePresence>
                  {confirmId === t.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden">
                      <div className="flex items-center gap-2 border-t border-red-100 dark:border-red-500/10 bg-red-50 dark:bg-red-500/[0.07] px-4 py-2.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <p className="flex-1 text-xs text-red-600 dark:text-red-400">¿Eliminar esta terminal?</p>
                        <button onClick={() => setConfirmId(null)}
                          className="text-xs font-medium text-grafito-500 hover:text-grafito-700 px-2 py-1">
                          No
                        </button>
                        <button onClick={() => { onDelete(t.id); setConfirmId(null) }} disabled={deleting}
                          className="rounded-lg bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600">
                          Eliminar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-grafito-100 dark:border-white/5 p-4 shrink-0">
        <button onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
          <Plus className="h-4 w-4" />
          Agregar terminal
        </button>
      </div>
    </div>
  )
}

// ── Vista: Formulario ─────────────────────────────────────────
function FormView({ form, onChange, onSave, onBack, saving, tenantId }: {
  form: TerminalForm
  onChange: (p: Partial<TerminalForm>) => void
  onSave: () => void
  onBack: () => void
  saving: boolean
  tenantId: string
}) {
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', tenantId],
    queryFn:  () => getEmployees(tenantId),
    enabled:  !!tenantId,
  })
  const { data: categories = [] } = useCategories()
  const cashiers = employees.filter(e => e.isActive)

  const toggleCategory = (id: string) => {
    const cur = form.allowed_category_ids
    if (cur === null) {
      onChange({ allowed_category_ids: categories.map(c => c.id).filter(c => c !== id) })
    } else if (cur.includes(id)) {
      const next = cur.filter(c => c !== id)
      onChange({ allowed_category_ids: next.length === 0 ? null : next })
    } else {
      const next = [...cur, id]
      onChange({ allowed_category_ids: next.length === categories.length ? null : next })
    }
  }

  const inputCls = 'w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 px-3 py-2.5 text-sm text-grafito-900 dark:text-white placeholder-grafito-400 outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-grafito-750 transition-colors'

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Nombre */}
        <div>
          <label className="block text-xs font-medium text-grafito-500 mb-1.5">Nombre del punto</label>
          <input value={form.name} onChange={e => onChange({ name: e.target.value })}
            placeholder="ej. Caja 2, Bar, Terraza" className={inputCls} />
        </div>

        {/* Cajero */}
        <div>
          <label className="block text-xs font-medium text-grafito-500 mb-1.5">Cajero asignado</label>
          <select value={form.cashier_id} onChange={e => onChange({ cashier_id: e.target.value })}
            className={inputCls}>
            <option value="">— Sin asignar —</option>
            {cashiers.map(e => (
              <option key={e.userId} value={e.userId}>
                {e.fullName ?? e.email}
              </option>
            ))}
          </select>
        </div>

        {/* Modo */}
        <div>
          <label className="block text-xs font-medium text-grafito-500 mb-2">Permisos de venta</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'FULL' as const, icon: CreditCard, label: 'Facturar y cobrar', desc: 'Completa ventas con pago', activeClass: 'border-brand-500 bg-brand-50 dark:bg-brand-500/10', iconClass: 'text-brand-500' },
              { key: 'COMMANDS_ONLY' as const, icon: Receipt, label: 'Solo comandas', desc: 'Crea pedidos sin cobrar', activeClass: 'border-amber-500 bg-amber-50 dark:bg-amber-500/10', iconClass: 'text-amber-500' },
            ]).map(({ key, icon: Icon, label, desc, activeClass, iconClass }) => {
              const active = form.mode === key
              return (
                <button key={key} onClick={() => onChange({ mode: key })}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all',
                    active ? activeClass : 'border-grafito-200 dark:border-white/10 hover:border-grafito-300 dark:hover:border-white/20',
                  )}>
                  <Icon className={cn('h-4 w-4', active ? iconClass : 'text-grafito-400')} />
                  <div>
                    <p className={cn('text-xs font-semibold', active ? '' : 'text-grafito-700 dark:text-grafito-300')}>{label}</p>
                    <p className="text-[10px] text-grafito-400 mt-0.5 leading-tight">{desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Categorías */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-grafito-500">Categorías permitidas</label>
            <button onClick={() => onChange({ allowed_category_ids: null })}
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors',
                form.allowed_category_ids === null
                  ? 'bg-grafito-900 dark:bg-white text-white dark:text-grafito-900'
                  : 'text-grafito-500 hover:text-grafito-700 dark:hover:text-grafito-300',
              )}>
              Todas
            </button>
          </div>

          {categories.length === 0 ? (
            <p className="text-xs text-grafito-400 italic">Sin categorías</p>
          ) : (
            <div className="space-y-1">
              {categories.map(cat => {
                const selected = form.allowed_category_ids === null || form.allowed_category_ids.includes(cat.id)
                return (
                  <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                      selected
                        ? 'bg-grafito-50 dark:bg-white/[0.04]'
                        : 'hover:bg-grafito-50 dark:hover:bg-white/[0.02] opacity-40',
                    )}>
                    {/* Color dot */}
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color || '#6366f1' }} />
                    <span className="flex-1 text-xs font-medium text-grafito-700 dark:text-grafito-300">
                      {cat.name}
                    </span>
                    {/* Checkmark */}
                    <span className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      selected
                        ? 'border-brand-500 bg-brand-500'
                        : 'border-grafito-200 dark:border-white/10',
                    )}>
                      {selected && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {form.allowed_category_ids !== null && categories.length > 0 && (
            <p className="text-[10px] text-grafito-400 mt-2">
              {form.allowed_category_ids.length} de {categories.length} seleccionadas
            </p>
          )}
        </div>

        {/* Notas */}
        <div>
          <label className="block text-xs font-medium text-grafito-500 mb-1.5">Notas <span className="text-grafito-400">(opcional)</span></label>
          <input value={form.notes} onChange={e => onChange({ notes: e.target.value })}
            placeholder="ej. Caja de bebidas" className={inputCls} />
        </div>

        {/* Activa */}
        <div className="flex items-center justify-between rounded-xl border border-grafito-100 dark:border-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-grafito-800 dark:text-white">Terminal activa</p>
            <p className="text-xs text-grafito-400 mt-0.5">{form.is_active ? 'Visible para el cajero' : 'Oculta'}</p>
          </div>
          <button onClick={() => onChange({ is_active: !form.is_active })}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors duration-200',
              form.is_active ? 'bg-brand-500' : 'bg-grafito-200 dark:bg-grafito-700',
            )}>
            <span className={cn(
              'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
              form.is_active ? 'translate-x-6' : 'translate-x-1',
            )} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-grafito-100 dark:border-white/5 p-4 shrink-0 flex gap-2">
        <button onClick={onBack}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-grafito-200 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <button onClick={onSave} disabled={!form.name.trim() || saving}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all',
            form.name.trim() && !saving
              ? 'bg-brand-500 text-white hover:bg-brand-600'
              : 'bg-grafito-100 dark:bg-white/5 text-grafito-400 cursor-not-allowed',
          )}>
          <Save className="h-4 w-4" />
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void }

export function ManageTerminalsModal({ open, onClose }: Props) {
  const [form, setForm] = useState<TerminalForm | null>(null)

  const { tenant, branch, user } = useAuthStore()
  const qc = useQueryClient()
  const tenantId = tenant?.tenantId ?? ''
  const branchId = branch?.branchId ?? ''

  const { data: terminals = [], isLoading } = useQuery({
    queryKey: ['pos-terminals', tenantId, branchId],
    queryFn:  () => getPOSTerminals(tenantId, branchId),
    enabled:  open && !!tenantId && !!branchId,
  })

  const saveMutation = useMutation({
    mutationFn: (f: TerminalForm) =>
      upsertPOSTerminal(tenantId, branchId, user?.id ?? '', {
        id: f.id, name: f.name,
        cashier_id: f.cashier_id || null,
        mode: f.mode,
        allowed_category_ids: f.allowed_category_ids,
        notes: f.notes || undefined,
        is_active: f.is_active,
      }),
    onSuccess: () => {
      toast.success('Terminal guardada')
      setForm(null)
      qc.invalidateQueries({ queryKey: ['pos-terminals', tenantId, branchId] })
    },
    onError: () => toast.error('Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePOSTerminal(tenantId, id),
    onSuccess: () => {
      toast.success('Terminal eliminada')
      qc.invalidateQueries({ queryKey: ['pos-terminals', tenantId, branchId] })
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const showForm = !!form
  const title = !showForm ? 'Puntos de venta' : form.id ? 'Editar terminal' : 'Nueva terminal'
  const subtitle = !showForm
    ? `${terminals.length} terminal${terminals.length !== 1 ? 'es' : ''}`
    : form.id ? form.name : 'Configura el punto de venta'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => { setForm(null); onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            onClick={e => e.stopPropagation()}
            className="flex flex-col w-full max-w-sm h-[520px] max-h-[90vh] rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-grafito-100 dark:border-white/5 px-5 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-grafito-100 dark:bg-white/5">
                  <Monitor className="h-4 w-4 text-grafito-500 dark:text-grafito-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-grafito-900 dark:text-white">{title}</p>
                  <p className="text-xs text-grafito-400">{subtitle}</p>
                </div>
              </div>
              <button onClick={() => { setForm(null); onClose() }}
                className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content — animated between list ↔ form */}
            <AnimatePresence mode="wait" initial={false}>
              {!showForm ? (
                <motion.div key="list"
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.16 }}
                  className="flex flex-col min-h-0 flex-1">
                  <ListView
                    terminals={terminals} isLoading={isLoading}
                    onNew={() => setForm({ ...EMPTY_FORM })}
                    onEdit={t => setForm({ id: t.id, name: t.name, cashier_id: t.cashier_id ?? '', mode: t.mode, allowed_category_ids: t.allowed_category_ids, notes: t.notes ?? '', is_active: t.is_active })}
                    onDelete={id => deleteMutation.mutate(id)}
                    deleting={deleteMutation.isPending}
                  />
                </motion.div>
              ) : (
                <motion.div key="form"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.16 }}
                  className="flex flex-col min-h-0 flex-1">
                  <FormView
                    form={form}
                    onChange={p => setForm(f => f ? { ...f, ...p } : f)}
                    onSave={() => form && saveMutation.mutate(form)}
                    onBack={() => setForm(null)}
                    saving={saveMutation.isPending}
                    tenantId={tenantId}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
