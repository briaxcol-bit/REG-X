import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Users, Search, Loader2, UserPlus, Pencil,
  ChevronDown, CheckCircle2, XCircle, RefreshCw,
  Eye, EyeOff, X, Trash2, AlertTriangle,
  CreditCard,
} from 'lucide-react'
import { PhoneField } from '@shared/components/PhoneField'
import {
  getEmployees, updateEmployeeRole, toggleEmployeeActive,
  addEmployee, updateEmployeeProfile, deleteEmployee,
  ROLE_CONFIG,
} from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'
import type { EmployeeRow, BusinessRole } from '@lib/db'

// ── Role options (excludes OWNER/ADMIN per requirement) ──────
const ROLES = Object.entries(ROLE_CONFIG) as [BusinessRole, typeof ROLE_CONFIG[BusinessRole]][]

// ── Role badge ───────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role as BusinessRole]
  if (!cfg) return <span className="text-xs text-grafito-400">{role}</span>
  return (
    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', cfg.color)}>
      {cfg.label}
    </span>
  )
}

// ── Avatar ───────────────────────────────────────────────────
function Avatar({ name, src }: { name: string | null; src: string | null }) {
  if (src) {
    return <img src={src} alt={name ?? ''} className="h-10 w-10 rounded-full object-cover shrink-0" />
  }
  const initials = (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="h-10 w-10 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center text-sm font-bold shrink-0">
      {initials}
    </div>
  )
}

// ── Role Select dropdown ─────────────────────────────────────
function RoleSelect({
  value, onChange, disabled,
}: { value: string; onChange: (r: BusinessRole) => void; disabled?: boolean }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value as BusinessRole)}
        disabled={disabled}
        className="appearance-none rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 pl-3 pr-7 py-1.5 text-sm text-grafito-700 dark:text-grafito-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {ROLES.map(([key, cfg]) => (
          <option key={key} value={key}>{cfg.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-grafito-400" />
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────
interface DeleteModalProps {
  employee: EmployeeRow
  tenantId: string
  onClose: () => void
  onDeleted: () => void
}

function DeleteEmployeeModal({ employee, tenantId, onClose, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setErr(null)
    try {
      await deleteEmployee({ userId: employee.userId, tenantId })
      onDeleted()
      onClose()
    } catch (ex: any) {
      setErr(ex?.message ?? 'Error al eliminar empleado.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl">
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-base font-bold text-grafito-900 dark:text-white mb-1">
            Eliminar empleado
          </h2>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">
            ¿Estás seguro de que quieres eliminar a{' '}
            <span className="font-semibold text-grafito-700 dark:text-grafito-200">
              {employee.fullName ?? 'este empleado'}
            </span>{' '}
            del negocio? Esta acción no se puede deshacer.
          </p>

          {err && (
            <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-500">{err}</div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-grafito-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Employee Modal ───────────────────────────────────────
interface EditModalProps {
  employee: EmployeeRow
  tenantId: string
  onClose: () => void
  onSaved: (updated: Partial<EmployeeRow>) => void
}

function EditEmployeeModal({ employee, tenantId, onClose, onSaved }: EditModalProps) {
  const [fullName, setFullName]     = useState(employee.fullName ?? '')
  const [email, setEmail]           = useState(employee.email    ?? '')
  const [cedula, setCedula]         = useState(employee.cedula   ?? '')
  const [phone, setPhone]           = useState(employee.phone    ?? '')
  const [role, setRole]             = useState<BusinessRole>(employee.role as BusinessRole)
  const [resetPwd, setResetPwd]     = useState(false)
  const [password, setPassword]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr]               = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const pwdMismatch = resetPwd && confirmPwd.length > 0 && password !== confirmPwd
  const pwdTooShort = resetPwd && password.length > 0 && password.length < 6
  const canSubmit   = !!fullName.trim() && !pwdMismatch && !pwdTooShort &&
                      (!resetPwd || password.length >= 6)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setErr(null)
    try {
      await updateEmployeeProfile({
        userId:   employee.userId,
        fullName: fullName.trim(),
        email:    email.trim()   || undefined,
        cedula:   cedula.trim()  || null,
        phone:    phone.trim()   || null,
        tenantId,
        role,
        password: resetPwd && password.length >= 6 ? password : undefined,
      })
      onSaved({
        fullName: fullName.trim(),
        role,
        email:  email.trim()  || null,
        cedula: cedula.trim() || null,
        phone:  phone.trim()  || null,
      })
      onClose()
    } catch (ex: any) {
      setErr(ex?.message ?? 'Error al actualizar empleado.')
    } finally {
      setSubmitting(false)
    }
  }

  const roleCfg = ROLE_CONFIG[role]
  const inputCls = 'w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 px-3.5 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-grafito-100 dark:border-white/5 sticky top-0 bg-white dark:bg-grafito-900 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10">
              <Pencil className="h-4 w-4 text-brand-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-grafito-900 dark:text-white">Editar Empleado</h2>
              <p className="text-xs text-grafito-400 truncate max-w-[220px]">
                {employee.fullName ?? employee.userId.slice(0, 12) + '…'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-grafito-100 dark:hover:bg-grafito-800 text-grafito-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Nombre completo <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Nombre del empleado"
              required
              className={inputCls}
            />
          </div>

          {/* Cédula */}
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5 flex items-center gap-1.5">
              <CreditCard className="h-3 w-3" /> Cédula / ID
            </label>
            <input value={cedula} onChange={e => setCedula(e.target.value)}
              placeholder="Ej: 1234567890" className={inputCls} />
          </div>

          {/* Celular */}
          <PhoneField
            label="Celular"
            value={phone || undefined}
            onChange={val => setPhone(val ?? '')}
          />

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@empleado.com"
              className={inputCls}
            />
          </div>

          {/* Rol */}
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">Rol</label>
            <div className="relative">
              <select
                value={role}
                onChange={e => setRole(e.target.value as BusinessRole)}
                className="appearance-none w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 pl-3.5 pr-8 py-2.5 text-sm text-grafito-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all cursor-pointer"
              >
                {ROLES.map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
            </div>
            {roleCfg && (
              <p className="text-[11px] text-grafito-400 mt-1 flex items-center gap-1.5">
                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold', roleCfg.color)}>{roleCfg.label}</span>
                {roleCfg.description}
              </p>
            )}
          </div>

          {/* Restablecer contraseña */}
          <div className="rounded-xl border border-grafito-200 dark:border-white/10 overflow-hidden">
            {/* Toggle */}
            <button
              type="button"
              onClick={() => { setResetPwd(v => !v); setPassword(''); setConfirmPwd('') }}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-grafito-700 dark:text-grafito-200 hover:bg-grafito-50 dark:hover:bg-grafito-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="text-base">🔑</span>
                El empleado olvidó su contraseña
              </span>
              <span className={cn(
                'h-5 w-9 rounded-full transition-colors relative',
                resetPwd ? 'bg-brand-500' : 'bg-grafito-200 dark:bg-grafito-700'
              )}>
                <span className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  resetPwd ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </span>
            </button>

            {/* Campos visibles solo si toggle activo */}
            {resetPwd && (
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-grafito-100 dark:border-white/5 bg-orange-500/5">
                <p className="text-[11px] text-orange-500 font-medium">
                  ⚠ Solo usa esta opción si el empleado realmente olvidó su contraseña.
                </p>
                {/* Nueva contraseña */}
                <div>
                  <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
                    Nueva contraseña <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 pl-3.5 pr-10 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-grafito-400 hover:text-grafito-600">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {pwdTooShort && <p className="text-[11px] text-red-400 mt-1">Mínimo 6 caracteres.</p>}
                </div>
                {/* Confirmar contraseña */}
                <div>
                  <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
                    Confirmar contraseña <span className="text-red-400">*</span>
                  </label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className={cn(
                      'w-full rounded-xl border bg-white dark:bg-grafito-800 px-3.5 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 focus:ring-2 outline-none transition-all',
                      pwdMismatch
                        ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
                        : 'border-grafito-200 dark:border-white/10 focus:border-brand-500 focus:ring-brand-500/20'
                    )}
                  />
                  {pwdMismatch && <p className="text-[11px] text-red-400 mt-1">Las contraseñas no coinciden.</p>}
                  {!pwdMismatch && confirmPwd.length >= 6 && password === confirmPwd && (
                    <p className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Contraseñas coinciden
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {err && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">{err}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-grafito-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || !canSubmit}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Employee Modal ────────────────────────────────────────
interface AddModalProps {
  tenantId: string
  branchId: string | null
  onClose: () => void
  onCreated: () => void
}

function AddEmployeeModal({ tenantId, branchId, onClose, onCreated }: AddModalProps) {
  const [fullName, setFullName]     = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [cedula, setCedula]         = useState('')
  const [phone, setPhone]           = useState('')
  const [role, setRole]             = useState<BusinessRole>('CASHIER')
  const [showPwd, setShowPwd]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr]               = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || password.length < 6) return
    setSubmitting(true)
    setErr(null)
    try {
      await addEmployee({
        email, fullName, password, role, tenantId, branchId,
        cedula: cedula.trim() || null,
        phone:  phone.trim()  || null,
      })
      onCreated()
      onClose()
    } catch (ex: any) {
      setErr(ex?.message ?? 'Error al crear empleado.')
    } finally {
      setSubmitting(false)
    }
  }

  const roleCfg = ROLE_CONFIG[role]
  const inputCls = 'w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 px-3.5 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-grafito-100 dark:border-white/5 sticky top-0 bg-white dark:bg-grafito-900 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10">
              <UserPlus className="h-4 w-4 text-brand-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-grafito-900 dark:text-white">Nuevo Empleado</h2>
              <p className="text-xs text-grafito-400">Crea la cuenta y asigna su rol</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-grafito-100 dark:hover:bg-grafito-800 text-grafito-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Nombre completo <span className="text-red-400">*</span>
            </label>
            <input ref={nameRef} value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Ej: Juan Pérez" required className={inputCls} />
          </div>

          {/* Cédula */}
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5 flex items-center gap-1.5">
              <CreditCard className="h-3 w-3" /> Cédula / ID
            </label>
            <input value={cedula} onChange={e => setCedula(e.target.value)}
              placeholder="Ej: 1234567890" className={inputCls} />
          </div>

          {/* Celular */}
          <PhoneField
            label="Celular"
            value={phone || undefined}
            onChange={val => setPhone(val ?? '')}
          />

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Correo electrónico <span className="text-red-400">*</span>
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="empleado@negocio.com" required className={inputCls} />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Contraseña temporal <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" minLength={6} required
                className="w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 pl-3.5 pr-10 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-grafito-400 hover:text-grafito-600">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-grafito-400 mt-1">El empleado podrá cambiarla desde su perfil.</p>
          </div>

          {/* Rol */}
          <div>
            <label className="block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5">
              Rol <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select value={role} onChange={e => setRole(e.target.value as BusinessRole)}
                className="appearance-none w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 pl-3.5 pr-8 py-2.5 text-sm text-grafito-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all cursor-pointer">
                {ROLES.map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
            </div>
            {roleCfg && (
              <p className="text-[11px] text-grafito-400 mt-1 flex items-center gap-1">
                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold', roleCfg.color)}>{roleCfg.label}</span>
                {roleCfg.description}
              </p>
            )}
          </div>

          {err && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">{err}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-grafito-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || !fullName || !email || password.length < 6}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {submitting ? 'Creando...' : 'Crear empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { tenant, branch } = useAuthStore()

  const [employees, setEmployees]   = useState<EmployeeRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [saving, setSaving]             = useState<Record<string, boolean>>({})
  const [saved, setSaved]               = useState<Record<string, boolean>>({})
  const [showAddModal, setShowAddModal]         = useState(false)
  const [editingEmployee, setEditingEmployee]   = useState<EmployeeRow | null>(null)
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeRow | null>(null)

  const load = () => {
    if (!tenant?.tenantId) return
    setLoading(true)
    setError(null)
    getEmployees(tenant.tenantId)
      .then(setEmployees)
      .catch(err => setError(String(err?.message ?? err)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [tenant?.tenantId])

  const filtered = useMemo(() => {
    let list = employees
    if (roleFilter !== 'ALL') list = list.filter(e => e.role === roleFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.fullName?.toLowerCase().includes(q) ||
        e.cedula?.toLowerCase().includes(q)   ||
        e.email?.toLowerCase().includes(q)    ||
        e.userId.includes(q)
      )
    }
    return list
  }, [employees, search, roleFilter])

  const handleRoleChange = async (userId: string, newRole: BusinessRole) => {
    if (!tenant?.tenantId) return
    setSaving(s => ({ ...s, [userId]: true }))
    try {
      await updateEmployeeRole(tenant.tenantId, userId, newRole)
      setEmployees(prev =>
        prev.map(e => e.userId === userId ? { ...e, role: newRole } : e)
      )
      setSaved(s => ({ ...s, [userId]: true }))
      setTimeout(() => setSaved(s => { const n = { ...s }; delete n[userId]; return n }), 2000)
    } catch (err) {
      setError(String((err as any)?.message ?? err))
    } finally {
      setSaving(s => { const n = { ...s }; delete n[userId]; return n })
    }
  }

  const handleToggleActive = async (userId: string, current: boolean) => {
    if (!tenant?.tenantId) return
    setSaving(s => ({ ...s, [userId]: true }))
    try {
      await toggleEmployeeActive(tenant.tenantId, userId, !current)
      setEmployees(prev =>
        prev.map(e => e.userId === userId ? { ...e, isActive: !current } : e)
      )
    } catch (err) {
      setError(String((err as any)?.message ?? err))
    } finally {
      setSaving(s => { const n = { ...s }; delete n[userId]; return n })
    }
  }

  const handleEmployeeSaved = (userId: string, updated: Partial<EmployeeRow>) => {
    setEmployees(prev => prev.map(e => e.userId === userId ? { ...e, ...updated } : e))
  }

  // Stats
  const totalActive   = employees.filter(e => e.isActive).length
  const totalInactive = employees.filter(e => !e.isActive).length
  const byRole = ROLES.map(([key, cfg]) => ({
    key, label: cfg.label, count: employees.filter(e => e.role === key).length,
  })).filter(r => r.count > 0)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Empleados</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">
            Gestiona el equipo y sus roles dentro del negocio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 px-3.5 py-2 text-sm text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-grafito-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Agregar empleado
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {!loading && employees.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
            <p className="text-xs text-grafito-500 dark:text-grafito-400 font-medium">Total</p>
            <p className="text-2xl font-bold text-grafito-900 dark:text-white mt-0.5">{employees.length}</p>
          </div>
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
            <p className="text-xs text-grafito-500 dark:text-grafito-400 font-medium">Activos</p>
            <p className="text-2xl font-bold text-emerald-500 mt-0.5">{totalActive}</p>
          </div>
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
            <p className="text-xs text-grafito-500 dark:text-grafito-400 font-medium">Inactivos</p>
            <p className="text-2xl font-bold text-grafito-400 mt-0.5">{totalInactive}</p>
          </div>
          <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
            <p className="text-xs text-grafito-500 dark:text-grafito-400 font-medium">Roles activos</p>
            <p className="text-2xl font-bold text-brand-500 mt-0.5">{byRole.length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center bg-white dark:bg-grafito-900/60 p-4 rounded-2xl border border-grafito-200 dark:border-white/5">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-grafito-100 dark:bg-grafito-800 px-3 py-2.5">
          <Search className="h-4 w-4 text-grafito-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula o correo..."
            className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400"
          />
        </div>
        <div className="relative sm:w-52">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="appearance-none w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 pl-3.5 pr-8 py-2.5 text-sm text-grafito-700 dark:text-grafito-200 outline-none cursor-pointer"
          >
            <option value="ALL">Todos los roles</option>
            {ROLES.map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-grafito-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando empleados...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-grafito-400">
            <Users className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">
              {employees.length === 0 ? 'No hay empleados registrados.' : 'Sin resultados para los filtros.'}
            </p>
            {employees.length === 0 && (
              <p className="text-xs text-center max-w-xs">
                Los empleados aparecen aquí cuando se registran con una invitación a este negocio.
              </p>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold text-grafito-500 uppercase border-b border-grafito-200 dark:border-white/5">
                  <th className="px-6 pb-3 pt-5">Empleado</th>
                  <th className="pb-3 pt-5">Rol asignado</th>
                  <th className="pb-3 pt-5">Descripción del rol</th>
                  <th className="pb-3 pt-5">Estado</th>
                  <th className="pb-3 pt-5 pr-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
                {filtered.map(emp => {
                  const roleCfg = ROLE_CONFIG[emp.role as BusinessRole]
                  const isSavingThis = !!saving[emp.userId]
                  const isSaved = !!saved[emp.userId]

                  return (
                    <tr key={emp.userId} className={cn(
                      'hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors',
                      !emp.isActive && 'opacity-50'
                    )}>
                      {/* Empleado */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.fullName} src={emp.avatarUrl} />
                          <div>
                            <p className="font-semibold text-grafito-900 dark:text-white">
                              {emp.fullName ?? 'Sin nombre'}
                            </p>
                            <p className="text-[11px] text-grafito-400">
                              {emp.email ?? <span className="font-mono">{emp.userId.slice(0, 8)}…</span>}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <RoleSelect
                            value={emp.role}
                            onChange={role => handleRoleChange(emp.userId, role)}
                            disabled={isSavingThis || !emp.isActive}
                          />
                          {isSavingThis && <Loader2 className="h-3.5 w-3.5 animate-spin text-grafito-400" />}
                          {isSaved && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                        </div>
                      </td>

                      {/* Descripción */}
                      <td className="py-4 pr-4 text-xs text-grafito-500 dark:text-grafito-400 max-w-[180px]">
                        {roleCfg?.description ?? '—'}
                      </td>

                      {/* Estado */}
                      <td className="py-4">
                        {emp.isActive ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Activo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-grafito-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-grafito-300" />
                            Inactivo
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-4 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          {/* Editar */}
                          <button
                            onClick={() => setEditingEmployee(emp)}
                            disabled={isSavingThis}
                            title="Editar empleado"
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          {/* Activar / Desactivar */}
                          <button
                            onClick={() => handleToggleActive(emp.userId, emp.isActive)}
                            disabled={isSavingThis}
                            title={emp.isActive ? 'Desactivar acceso' : 'Activar acceso'}
                            className={cn(
                              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                              emp.isActive
                                ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                            )}
                          >
                            {emp.isActive
                              ? <><XCircle className="h-3.5 w-3.5" /> Desactivar</>
                              : <><CheckCircle2 className="h-3.5 w-3.5" /> Activar</>
                            }
                          </button>
                          {/* Eliminar */}
                          <button
                            onClick={() => setDeletingEmployee(emp)}
                            disabled={isSavingThis}
                            title="Eliminar empleado"
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-grafito-100 dark:border-white/5 text-xs text-grafito-400">
              {filtered.length} empleado{filtered.length !== 1 ? 's' : ''}
              {roleFilter !== 'ALL' && ` · filtrando por ${ROLE_CONFIG[roleFilter as BusinessRole]?.label ?? roleFilter}`}
            </div>
          </>
        )}
      </div>

      {/* Role legend */}
      {!loading && employees.length > 0 && (
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5">
          <p className="text-xs font-semibold text-grafito-500 uppercase mb-3">Roles disponibles</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ROLES.map(([key, cfg]) => (
              <div key={key} className="flex items-start gap-2">
                <span className={cn('mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', cfg.color)}>
                  {cfg.label}
                </span>
                <span className="text-xs text-grafito-400">{cfg.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal agregar empleado */}
      {showAddModal && tenant?.tenantId && (
        <AddEmployeeModal
          tenantId={tenant.tenantId}
          branchId={branch?.branchId ?? null}
          onClose={() => setShowAddModal(false)}
          onCreated={load}
        />
      )}

      {/* Modal editar empleado */}
      {editingEmployee && tenant?.tenantId && (
        <EditEmployeeModal
          employee={editingEmployee}
          tenantId={tenant.tenantId}
          onClose={() => setEditingEmployee(null)}
          onSaved={updated => handleEmployeeSaved(editingEmployee.userId, updated)}
        />
      )}

      {/* Modal eliminar empleado */}
      {deletingEmployee && tenant?.tenantId && (
        <DeleteEmployeeModal
          employee={deletingEmployee}
          tenantId={tenant.tenantId}
          onClose={() => setDeletingEmployee(null)}
          onDeleted={() => setEmployees(prev => prev.filter(e => e.userId !== deletingEmployee.userId))}
        />
      )}
    </div>
  )
}
