import { useState } from 'react'
import {
  Plus, Search, Mail, Phone, Star, Loader2,
  Building2, User, X, Pencil, FileText,
  CreditCard, MapPin, BadgeCheck, Trash2,
} from 'lucide-react'
import { useCustomers, useCreateCustomer, useUpdateCustomer, type Customer, type CustomerInput } from '@modules/customers/hooks/useCustomers'
import { cn } from '@shared/utils/cn'

// ── Constantes de facturación ────────────────────────────────
type PersonType = 'NATURAL' | 'EMPRESA'
type Regime     = 'SIMPLIFICADO' | 'COMUN'

const DOC_TYPES_NATURAL = [
  { value: 'CC',  label: 'Cédula de Ciudadanía' },
  { value: 'CE',  label: 'Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PA',  label: 'Pasaporte' },
  { value: 'TI',  label: 'Tarjeta de Identidad' },
]

const REGIMES: { value: Regime; label: string; desc: string }[] = [
  { value: 'SIMPLIFICADO', label: 'Régimen Simplificado', desc: 'No responsable de IVA' },
  { value: 'COMUN',        label: 'Régimen Común',        desc: 'Responsable de IVA' },
]

const inputCls = 'w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-grafito-800 px-3.5 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all'
const labelCls = 'block text-xs font-semibold text-grafito-600 dark:text-grafito-300 mb-1.5'

// ── Formulario inicial ────────────────────────────────────────
function emptyForm(personType: PersonType = 'NATURAL'): CustomerInput {
  return {
    person_type:   personType,
    doc_type:      personType === 'NATURAL' ? 'CC' : 'NIT',
    regime:        'SIMPLIFICADO',
    full_name:     '',
    business_name: null,
    email:         null,
    phone:         null,
    tax_id:        null,
    address:       null,
  }
}

function customerToInput(c: Customer): CustomerInput {
  return {
    person_type:   c.personType,
    doc_type:      c.docType,
    regime:        c.regime,
    full_name:     c.fullName,
    business_name: c.businessName,
    email:         c.email,
    phone:         c.phone,
    tax_id:        c.taxId,
    address:       c.address,
  }
}

// ── Modal de cliente ─────────────────────────────────────────
function CustomerModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title:   string
  initial: CustomerInput
  onClose: () => void
  onSave:  (data: CustomerInput) => Promise<void>
}) {
  const [form, setForm]         = useState<CustomerInput>(initial)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  const set = (patch: Partial<CustomerInput>) => setForm(f => ({ ...f, ...patch }))
  const setAddr = (patch: Partial<NonNullable<CustomerInput['address']>>) =>
    setForm(f => ({ ...f, address: { ...f.address, ...patch } }))

  const isNatural = form.person_type === 'NATURAL'

  // Al cambiar tipo de persona, resetear doc_type
  const switchType = (type: PersonType) => {
    setForm(emptyForm(type))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = isNatural ? form.full_name : form.business_name
    if (!name?.trim()) return
    setSaving(true)
    setErr(null)
    try {
      await onSave({
        ...form,
        full_name:     form.full_name.trim(),
        business_name: form.business_name?.trim() || null,
        email:         form.email?.trim()         || null,
        phone:         form.phone?.trim()         || null,
        tax_id:        form.tax_id?.trim()        || null,
      })
    } catch (ex: any) {
      setErr(ex?.message ?? 'Error al guardar cliente.')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = isNatural ? !!form.full_name.trim() : !!form.business_name?.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-6 pb-4 border-b border-grafito-100 dark:border-white/5 bg-white dark:bg-grafito-900">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10">
              <FileText className="h-4 w-4 text-brand-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-grafito-900 dark:text-white">{title}</h2>
              <p className="text-xs text-grafito-400">Datos para facturación electrónica</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-grafito-100 dark:hover:bg-grafito-800 text-grafito-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Toggle tipo de persona */}
          <div>
            <label className={labelCls}>Tipo de persona</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { type: 'NATURAL' as PersonType, icon: User,      label: 'Persona Natural' },
                { type: 'EMPRESA' as PersonType, icon: Building2, label: 'Empresa' },
              ] as const).map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => switchType(type)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all',
                    form.person_type === type
                      ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                      : 'border-grafito-200 dark:border-white/10 text-grafito-500 hover:border-grafito-300 dark:hover:border-white/20'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── PERSONA NATURAL ── */}
          {isNatural && (
            <>
              <div>
                <label className={labelCls}>Nombre completo <span className="text-red-400">*</span></label>
                <input value={form.full_name} onChange={e => set({ full_name: e.target.value })}
                  placeholder="Ej: Juan Carlos Pérez" required className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tipo de documento</label>
                  <select value={form.doc_type} onChange={e => set({ doc_type: e.target.value })}
                    className={inputCls + ' cursor-pointer'}>
                    {DOC_TYPES_NATURAL.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Número de documento</label>
                  <input value={form.tax_id ?? ''} onChange={e => set({ tax_id: e.target.value })}
                    placeholder="Ej: 1012345678" className={inputCls} />
                </div>
              </div>
            </>
          )}

          {/* ── EMPRESA ── */}
          {!isNatural && (
            <>
              <div>
                <label className={labelCls}>Razón social <span className="text-red-400">*</span></label>
                <input value={form.business_name ?? ''} onChange={e => set({ business_name: e.target.value })}
                  placeholder="Ej: Distribuciones García S.A.S." required className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>NIT</label>
                  <input value={form.tax_id ?? ''} onChange={e => set({ tax_id: e.target.value })}
                    placeholder="Ej: 900123456-7" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nombre representante</label>
                  <input value={form.full_name} onChange={e => set({ full_name: e.target.value })}
                    placeholder="Ej: María García" className={inputCls} />
                </div>
              </div>

              {/* Dirección empresa */}
              <div>
                <label className={labelCls + ' flex items-center gap-1.5'}>
                  <MapPin className="h-3 w-3" /> Dirección
                </label>
                <input value={form.address?.street ?? ''} onChange={e => setAddr({ street: e.target.value })}
                  placeholder="Calle / Carrera / Avenida..." className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Ciudad</label>
                  <input value={form.address?.city ?? ''} onChange={e => setAddr({ city: e.target.value })}
                    placeholder="Ej: Bogotá" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Departamento</label>
                  <input value={form.address?.department ?? ''} onChange={e => setAddr({ department: e.target.value })}
                    placeholder="Ej: Cundinamarca" className={inputCls} />
                </div>
              </div>
            </>
          )}

          {/* Contacto — compartido */}
          <div className="rounded-xl border border-grafito-100 dark:border-white/5 bg-grafito-50 dark:bg-grafito-800/50 p-4 space-y-3">
            <p className="text-xs font-bold text-grafito-500 dark:text-grafito-400 uppercase tracking-wide">Contacto</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls + ' flex items-center gap-1.5'}>
                  <Mail className="h-3 w-3" /> Correo electrónico
                </label>
                <input type="email" value={form.email ?? ''} onChange={e => set({ email: e.target.value })}
                  placeholder="correo@empresa.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls + ' flex items-center gap-1.5'}>
                  <Phone className="h-3 w-3" /> Teléfono / Celular
                </label>
                <input type="tel" value={form.phone ?? ''} onChange={e => set({ phone: e.target.value })}
                  placeholder="300 123 4567" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Régimen tributario */}
          <div>
            <label className={labelCls + ' flex items-center gap-1.5'}>
              <BadgeCheck className="h-3 w-3" /> Régimen tributario
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REGIMES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set({ regime: r.value })}
                  className={cn(
                    'flex flex-col items-start rounded-xl border-2 px-3.5 py-2.5 text-left transition-all',
                    form.regime === r.value
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-grafito-200 dark:border-white/10 hover:border-grafito-300 dark:hover:border-white/20'
                  )}
                >
                  <span className={cn('text-sm font-semibold', form.regime === r.value ? 'text-brand-500' : 'text-grafito-700 dark:text-grafito-200')}>
                    {r.label}
                  </span>
                  <span className="text-[11px] text-grafito-400 mt-0.5">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">{err}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-grafito-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !canSubmit}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {saving ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Badge tipo de persona ────────────────────────────────────
function PersonBadge({ type }: { type: PersonType }) {
  return type === 'EMPRESA'
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500"><Building2 className="h-2.5 w-2.5" />Empresa</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-500"><User className="h-2.5 w-2.5" />Natural</span>
}

function RegimeBadge({ regime }: { regime: Regime }) {
  return regime === 'COMUN'
    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500">Resp. IVA</span>
    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-grafito-100 dark:bg-grafito-800 text-grafito-400">No Resp. IVA</span>
}

// ── Página principal ─────────────────────────────────────────
export default function CustomersPage() {
  const [search, setSearch]     = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing]   = useState<Customer | null>(null)
  const [filterType, setFilterType] = useState<'ALL' | PersonType>('ALL')

  const { data: customers = [], isLoading } = useCustomers({ search, limit: 100 })
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()

  const filtered = filterType === 'ALL'
    ? customers
    : customers.filter(c => c.personType === filterType)

  const totalNatural = customers.filter(c => c.personType === 'NATURAL').length
  const totalEmpresa = customers.filter(c => c.personType === 'EMPRESA').length

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Clientes</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Directorio con soporte de facturación electrónica.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 active:scale-[0.98] transition-all w-fit"
        >
          <Plus className="h-4 w-4" />
          Registrar Cliente
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: customers.length, color: 'text-grafito-900 dark:text-white' },
          { label: 'Personas Naturales', value: totalNatural, color: 'text-teal-500' },
          { label: 'Empresas', value: totalEmpresa, color: 'text-blue-500' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-grafito-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-white dark:bg-grafito-900/60 border border-grafito-200 dark:border-white/5 px-3 py-2.5">
          <Search className="h-4 w-4 text-grafito-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, razón social, NIT, correo..."
            className="flex-1 bg-transparent text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-grafito-400 hover:text-grafito-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {(['ALL', 'NATURAL', 'EMPRESA'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn(
                'rounded-xl px-4 py-2.5 text-xs font-semibold border transition-all',
                filterType === t
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-white dark:bg-grafito-900/60 border-grafito-200 dark:border-white/5 text-grafito-500 hover:border-grafito-300'
              )}>
              {t === 'ALL' ? 'Todos' : t === 'NATURAL' ? 'Naturales' : 'Empresas'}
            </button>
          ))}
        </div>
      </div>

      {/* Modales */}
      {showCreate && (
        <CustomerModal
          title="Nuevo Cliente"
          initial={emptyForm()}
          onClose={() => setShowCreate(false)}
          onSave={async (data) => {
            await createCustomer.mutateAsync(data)
            setShowCreate(false)
          }}
        />
      )}

      {editing && (
        <CustomerModal
          title="Editar Cliente"
          initial={customerToInput(editing)}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await updateCustomer.mutateAsync({ id: editing.id, data })
            setEditing(null)
          }}
        />
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-grafito-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando clientes...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-grafito-100 dark:bg-grafito-800 flex items-center justify-center">
            <FileText className="h-8 w-8 text-grafito-400" />
          </div>
          <p className="text-sm font-medium text-grafito-900 dark:text-white">
            {search ? 'Sin resultados para esa búsqueda' : 'No hay clientes registrados'}
          </p>
          <p className="text-xs text-grafito-500">
            {search ? 'Intenta con otro nombre, NIT o correo' : 'Haz clic en "Registrar Cliente" para agregar el primero'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => {
            const isEmpresa   = c.personType === 'EMPRESA'
            const displayName = isEmpresa ? (c.businessName ?? c.fullName) : c.fullName
            const initials    = displayName?.[0]?.toUpperCase() ?? '?'

            return (
              <div key={c.id}
                className="group relative rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 space-y-3 hover:border-brand-500/30 transition-all">

                {/* Acciones */}
                <div className="absolute top-3.5 right-3.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(c)} title="Editar"
                    className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 hover:text-brand-500 transition-all">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Cabecera */}
                <div className="flex items-start gap-3 pr-10">
                  <div className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
                    isEmpresa ? 'bg-blue-500/15 text-blue-500' : 'bg-teal-500/15 text-teal-500'
                  )}>
                    {isEmpresa ? <Building2 className="h-5 w-5" /> : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-grafito-900 dark:text-white truncate text-sm">{displayName}</h3>
                    {isEmpresa && c.fullName && (
                      <p className="text-[11px] text-grafito-400 truncate">Rep: {c.fullName}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <PersonBadge type={c.personType} />
                      <RegimeBadge regime={c.regime} />
                    </div>
                  </div>
                </div>

                {/* Datos */}
                <div className="space-y-1.5 text-xs text-grafito-600 dark:text-grafito-300">
                  {c.taxId && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3 w-3 text-grafito-400 shrink-0" />
                      <span className="font-mono">{c.docType}: {c.taxId}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-grafito-400 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-grafito-400 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.address?.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-grafito-400 shrink-0" />
                      <span>{[c.address.city, c.address.department].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {c.loyaltyPoints > 0 && (
                    <div className="flex items-center gap-2">
                      <Star className="h-3 w-3 text-brand-500 shrink-0" />
                      <span className="text-brand-500 font-semibold">{c.loyaltyPoints} puntos</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
