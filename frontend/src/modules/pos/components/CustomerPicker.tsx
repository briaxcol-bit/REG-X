import { useState } from 'react'
import { Search, X, UserCircle, Building2, User, Plus, Loader2, ChevronLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCustomers } from '@modules/customers/hooks/useCustomers'
import { createCustomer } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { PhoneField } from '@shared/components/PhoneField'
import { toast } from 'sonner'

interface CustomerPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (customerId: string, customerName: string) => void
}

// ── Mini form nueva persona natural ──────────────────────────────
const DOC_TYPES_NATURAL  = ['CC', 'CE', 'TI', 'PA']
const DOC_TYPES_EMPRESA  = ['NIT']
const REGIMES            = [
  { value: 'SIMPLIFICADO', label: 'Régimen Simplificado' },
  { value: 'COMUN',        label: 'Régimen Común' },
]

interface NewCustomerFormProps {
  onBack: () => void
  onCreated: (id: string, name: string) => void
}

function NewCustomerForm({ onBack, onCreated }: NewCustomerFormProps) {
  const { tenant, branch } = useAuthStore()

  const [personType, setPersonType] = useState<'NATURAL' | 'EMPRESA'>('NATURAL')
  const [docType,    setDocType]    = useState('CC')
  const [taxId,      setTaxId]      = useState('')
  const [fullName,   setFullName]   = useState('')
  const [bizName,    setBizName]    = useState('')
  const [regime,     setRegime]     = useState<'SIMPLIFICADO' | 'COMUN'>('SIMPLIFICADO')
  const [phone,      setPhone]      = useState<string | undefined>(undefined)
  const [email,      setEmail]      = useState('')
  const [saving,     setSaving]     = useState(false)

  const displayName = personType === 'EMPRESA' ? (bizName || fullName) : fullName

  const handleSave = async () => {
    if (!tenant?.tenantId || !branch?.branchId) return
    if (!fullName.trim()) { toast.warning('El nombre es requerido.'); return }
    if (personType === 'EMPRESA' && !bizName.trim()) { toast.warning('La razón social es requerida.'); return }

    setSaving(true)
    try {
      const row = await createCustomer(tenant.tenantId, branch.branchId, {
        person_type:   personType,
        doc_type:      personType === 'EMPRESA' ? 'NIT' : docType,
        regime,
        full_name:     fullName.trim(),
        business_name: personType === 'EMPRESA' ? bizName.trim() : null,
        tax_id:        taxId.trim() || null,
        phone:         phone || null,
        email:         email.trim() || null,
      })
      toast.success(`Cliente "${displayName}" creado.`)
      onCreated((row as any).id, displayName)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al crear el cliente.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-xl bg-grafito-100 dark:bg-grafito-800 border border-grafito-200 dark:border-white/10 px-3 py-2.5 text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none focus:border-brand-500 transition-colors'
  const labelCls = 'block text-xs font-medium text-grafito-500 dark:text-grafito-400 mb-1'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-grafito-200 dark:border-white/5 px-4 py-3">
        <button onClick={onBack} className="rounded-lg p-1 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-grafito-900 dark:text-white">Nuevo cliente</span>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {/* Tipo persona */}
        <div className="grid grid-cols-2 gap-2">
          {(['NATURAL', 'EMPRESA'] as const).map(type => (
            <button
              key={type}
              onClick={() => {
                setPersonType(type)
                setDocType(type === 'EMPRESA' ? 'NIT' : 'CC')
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border transition-all ${
                personType === type
                  ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                  : 'border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:border-grafito-300'
              }`}
            >
              {type === 'NATURAL' ? <User className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
              {type === 'NATURAL' ? 'Persona Natural' : 'Empresa'}
            </button>
          ))}
        </div>

        {/* Empresa: razón social */}
        {personType === 'EMPRESA' && (
          <div>
            <label className={labelCls}>Razón social *</label>
            <input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Nombre de la empresa" className={inputCls} />
          </div>
        )}

        {/* Nombre contacto */}
        <div>
          <label className={labelCls}>{personType === 'EMPRESA' ? 'Nombre de contacto *' : 'Nombre completo *'}</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nombre y apellidos" className={inputCls} />
        </div>

        {/* Documento */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Tipo doc.</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              disabled={personType === 'EMPRESA'}
              className={`${inputCls} cursor-pointer`}
            >
              {(personType === 'EMPRESA' ? DOC_TYPES_EMPRESA : DOC_TYPES_NATURAL).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Número</label>
            <input value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="CC / NIT..." className={inputCls} />
          </div>
        </div>

        {/* Régimen */}
        <div>
          <label className={labelCls}>Régimen tributario</label>
          <select value={regime} onChange={e => setRegime(e.target.value as any)} className={`${inputCls} cursor-pointer`}>
            {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* Teléfono / Email */}
        <PhoneField
          label="Teléfono / Celular"
          value={phone}
          onChange={setPhone}
        />
        <div>
          <label className={labelCls}>Correo</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@..." className={inputCls} />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-grafito-100 dark:border-white/5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {saving ? 'Guardando...' : 'Crear y seleccionar'}
        </button>
      </div>
    </div>
  )
}

// ── Main picker ───────────────────────────────────────────────────
export function CustomerPicker({ open, onClose, onSelect }: CustomerPickerProps) {
  const [search,    setSearch]    = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const { data: customers = [] }  = useCustomers({ search, limit: 20 })

  const handleClose = () => {
    setSearch('')
    setShowForm(false)
    onClose()
  }

  const handleCreated = (id: string, name: string) => {
    onSelect(id, name)
    handleClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed left-1/2 top-[10%] z-50 w-full max-w-sm -translate-x-1/2 rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            {showForm ? (
              <NewCustomerForm onBack={() => setShowForm(false)} onCreated={handleCreated} />
            ) : (
              <>
                {/* Search header */}
                <div className="flex items-center gap-2 border-b border-grafito-200 dark:border-white/5 px-4 py-3">
                  <Search className="h-4 w-4 text-grafito-500 dark:text-grafito-400 shrink-0" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, cédula, NIT o teléfono…"
                    className="flex-1 bg-transparent text-sm text-grafito-900 dark:text-white placeholder:text-grafito-400 outline-none"
                    autoFocus
                  />
                  <button onClick={handleClose}><X className="h-4 w-4 text-grafito-500" /></button>
                </div>

                {/* Customer list */}
                <div className="flex-1 overflow-y-auto">
                  {customers.length === 0 ? (
                    <p className="py-8 text-center text-sm text-grafito-400">
                      {search ? 'No se encontraron clientes.' : 'Busca un cliente o crea uno nuevo.'}
                    </p>
                  ) : (
                    customers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { onSelect(c.id, c.fullName); handleClose() }}
                        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors text-left"
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          c.personType === 'EMPRESA' ? 'bg-amber-500/15' : 'bg-brand-500/15'
                        }`}>
                          {c.personType === 'EMPRESA'
                            ? <Building2 className="h-4 w-4 text-amber-500" />
                            : <UserCircle className="h-4 w-4 text-brand-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-grafito-900 dark:text-white truncate">{c.fullName}</p>
                          <p className="text-xs text-grafito-400 truncate">
                            {c.docType} {c.taxId ?? '—'} · {c.personType === 'EMPRESA' ? 'Empresa' : 'Persona Natural'}
                            {c.phone ? ` · ${c.phone}` : ''}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Nuevo cliente */}
                <div className="p-3 border-t border-grafito-100 dark:border-white/5">
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-500/40 py-2.5 text-sm font-semibold text-brand-500 hover:bg-brand-500/5 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo cliente
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
