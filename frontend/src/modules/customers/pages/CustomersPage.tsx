import { useState } from 'react'
import { Plus, Search, Mail, Phone, Star, Loader2, UserCircle, X, Pencil } from 'lucide-react'
import { useCustomers, useCreateCustomer, useUpdateCustomer } from '@modules/customers/hooks/useCustomers'
import type { Customer } from '@modules/customers/hooks/useCustomers'

type FormData = { full_name: string; email: string; phone: string; tax_id: string }

function CustomerModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string
  initial: FormData
  onClose: () => void
  onSave: (data: FormData) => Promise<void>
}) {
  const [form, setForm] = useState<FormData>(initial)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-grafito-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'full_name', label: 'Nombre completo *', placeholder: 'Ej: Juan Pérez', type: 'text', required: true },
            { key: 'email',     label: 'Correo electrónico', placeholder: 'cliente@correo.com', type: 'email', required: false },
            { key: 'phone',     label: 'Teléfono',           placeholder: '+57 300 123 4567',   type: 'text', required: false },
            { key: 'tax_id',    label: 'NIT / Cédula',       placeholder: '123456789',          type: 'text', required: false },
          ].map(({ key, label, placeholder, type, required }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wide">{label}</label>
              <input
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                type={type}
                required={required}
                className="mt-1 w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-100 dark:bg-grafito-800 px-4 py-2.5 text-sm text-grafito-900 dark:text-white outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-700 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.full_name.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-grafito-900 dark:text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  const { data: customers = [], isLoading } = useCustomers({ search, limit: 50 })
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()

  const emptyForm: FormData = { full_name: '', email: '', phone: '', tax_id: '' }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Clientes</h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">Directorio y base de datos de clientes registrados.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-grafito-900 dark:text-white hover:bg-brand-600 active:scale-[0.98] transition-all w-fit"
        >
          <Plus className="h-4 w-4" />
          Registrar Cliente
        </button>
      </div>

      {/* Modal Crear */}
      {showCreate && (
        <CustomerModal
          title="Nuevo Cliente"
          initial={emptyForm}
          onClose={() => setShowCreate(false)}
          onSave={async (data) => {
            await createCustomer.mutateAsync({
              full_name: data.full_name,
              email: data.email || undefined,
              phone: data.phone || undefined,
              tax_id: data.tax_id || undefined,
            })
            setShowCreate(false)
          }}
        />
      )}

      {/* Modal Editar */}
      {editing && (
        <CustomerModal
          title="Editar Cliente"
          initial={{
            full_name: editing.fullName,
            email: editing.email ?? '',
            phone: editing.phone ?? '',
            tax_id: editing.taxId ?? '',
          }}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await updateCustomer.mutateAsync({
              id: editing.id,
              data: {
                full_name: data.full_name,
                email: data.email || undefined,
                phone: data.phone || undefined,
                tax_id: data.tax_id || undefined,
              },
            })
            setEditing(null)
          }}
        />
      )}

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-grafito-900/60 p-4 border border-grafito-200 dark:border-white/5">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-grafito-100 dark:bg-grafito-800 px-3 py-2 text-grafito-900 dark:text-white">
          <Search className="h-4 w-4 text-grafito-500 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo, teléfono o cédula/NIT..."
            className="flex-1 bg-transparent text-sm placeholder:text-grafito-400 dark:placeholder:text-grafito-600 outline-none"
          />
        </div>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-grafito-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando clientes...</span>
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-grafito-100 dark:bg-grafito-800 flex items-center justify-center">
            <UserCircle className="h-8 w-8 text-grafito-400" />
          </div>
          <p className="text-sm font-medium text-grafito-900 dark:text-white">
            {search ? 'No se encontraron resultados' : 'No hay clientes registrados'}
          </p>
          <p className="text-xs text-grafito-500">
            {search ? 'Intenta con otro nombre o correo' : 'Haz clic en "Registrar Cliente" para agregar el primero'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <div key={c.id} className="group relative rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 backdrop-blur-md space-y-4 hover:border-brand-500/30 transition-colors">
              {/* Edit button */}
              <button
                onClick={() => setEditing(c)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 hover:text-brand-500 transition-all"
                title="Editar cliente"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-brand-500">{c.fullName[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <h3 className="font-bold text-grafito-900 dark:text-white truncate">{c.fullName}</h3>
                  {c.loyaltyPoints > 0 && (
                    <span className="flex items-center gap-1 text-xs text-brand-500 font-semibold">
                      <Star className="h-3 w-3" /> {c.loyaltyPoints} puntos
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-grafito-600 dark:text-grafito-300">
                {c.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-grafito-400 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-grafito-400 shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
