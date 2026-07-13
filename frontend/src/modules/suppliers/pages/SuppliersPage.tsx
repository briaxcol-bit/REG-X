import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Truck, Search, Plus, Pencil, Trash2, Loader2, X, Phone, Mail, Power,
  Building2, Tags, Wallet, Globe, MapPin, MessageCircle, CreditCard, Receipt,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import { formatCurrency } from '@shared/utils/format'
import {
  getSuppliers, createSupplier, updateSupplier, deleteSupplier, toggleSupplierActive,
  getSupplierSpend, getExpenses,
  type SupplierRow, type SupplierInput, type SupplierPaymentTerms,
} from '@lib/db'

const SUPPLIER_CATEGORIES = [
  'Insumos', 'Materia prima', 'Empaques', 'Servicios',
  'Logística / Transporte', 'Tecnología', 'Aseo y mantenimiento', 'Otros',
]

const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '')
const withHttp = (u: string) => (/^https?:\/\//.test(u) ? u : `https://${u}`)
const paymentLabel = (s: SupplierRow) =>
  s.payment_terms === 'CREDIT' ? `Crédito${s.credit_days ? ` ${s.credit_days}d` : ''}` : 'Contado'

// ─── Modal crear / editar ─────────────────────────────────────────────────────
function SupplierModal({ tenantId, editing, onClose }: { tenantId: string; editing: SupplierRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName]         = useState(editing?.name ?? '')
  const [taxId, setTaxId]       = useState(editing?.tax_id ?? '')
  const [category, setCategory] = useState(editing?.category ?? '')
  const [contact, setContact]   = useState(editing?.contact_name ?? '')
  const [phone, setPhone]       = useState(editing?.phone ?? '')
  const [email, setEmail]       = useState(editing?.email ?? '')
  const [website, setWebsite]   = useState(editing?.website ?? '')
  const [street, setStreet]     = useState(editing?.address?.street ?? '')
  const [city, setCity]         = useState(editing?.address?.city ?? '')
  const [dept, setDept]         = useState(editing?.address?.department ?? '')
  const [terms, setTerms]       = useState<SupplierPaymentTerms>(editing?.payment_terms ?? 'CASH')
  const [creditDays, setCreditDays] = useState(editing?.credit_days ? String(editing.credit_days) : '')
  const [notes, setNotes]       = useState(editing?.notes ?? '')

  const save = useMutation({
    mutationFn: () => {
      const addr = { street: street.trim(), city: city.trim(), department: dept.trim() }
      const hasAddr = addr.street || addr.city || addr.department
      const input: SupplierInput = {
        name: name.trim(),
        tax_id: taxId.trim() || null,
        category: category.trim() || null,
        contact_name: contact.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        address: hasAddr ? addr : null,
        payment_terms: terms,
        credit_days: terms === 'CREDIT' && creditDays.trim() ? Number(creditDays) : null,
        notes: notes.trim() || null,
      }
      return editing ? updateSupplier(tenantId, editing.id, input) : createSupplier(tenantId, input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', tenantId] })
      toast.success(editing ? 'Proveedor actualizado' : 'Proveedor creado')
      onClose()
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-grafito-900 dark:text-white">{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nombre del proveedor"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Distribuidora XYZ S.A.S." /></Field></div>

          <Field label="Categoría">
            <input list="supplier-cats" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="Insumos, Servicios…" />
            <datalist id="supplier-cats">{SUPPLIER_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="NIT / Identificación"><input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputCls} /></Field>

          <Field label="Persona de contacto"><input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} /></Field>
          <Field label="Teléfono"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+57 300 000 0000" /></Field>

          <Field label="Correo"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} type="email" /></Field>
          <Field label="Sitio web"><input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="www.proveedor.com" /></Field>

          <div className="sm:col-span-2"><Field label="Dirección"><input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} placeholder="Calle 123 # 45-67" /></Field></div>
          <Field label="Ciudad"><input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} /></Field>
          <Field label="Departamento"><input value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls} /></Field>

          <Field label="Condición de pago">
            <select value={terms} onChange={(e) => setTerms(e.target.value as SupplierPaymentTerms)} className={inputCls}>
              <option value="CASH">Contado</option>
              <option value="CREDIT">Crédito</option>
            </select>
          </Field>
          <Field label="Plazo (días)">
            <input value={creditDays} onChange={(e) => setCreditDays(e.target.value.replace(/\D/g, ''))} disabled={terms !== 'CREDIT'} className={cn(inputCls, terms !== 'CREDIT' && 'opacity-40')} placeholder="30" />
          </Field>

          <div className="sm:col-span-2"><Field label="Notas"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></Field></div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editing ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Ficha de detalle (drawer lateral) ────────────────────────────────────────
function SupplierDrawer({ tenantId, supplier, onClose, onEdit }: {
  tenantId: string; supplier: SupplierRow; onClose: () => void; onEdit: () => void
}) {
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['supplier-expenses', tenantId, supplier.id],
    queryFn: () => getExpenses(tenantId, { supplierId: supplier.id }),
    enabled: !!tenantId,
  })
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const actions = [
    supplier.phone && { icon: Phone, label: 'Llamar', href: `tel:${supplier.phone}` },
    supplier.phone && { icon: MessageCircle, label: 'WhatsApp', href: `https://wa.me/${digits(supplier.phone)}` },
    supplier.email && { icon: Mail, label: 'Correo', href: `mailto:${supplier.email}` },
    supplier.website && { icon: Globe, label: 'Web', href: withHttp(supplier.website) },
  ].filter(Boolean) as { icon: any; label: string; href: string }[]

  const addr = [supplier.address?.street, supplier.address?.city, supplier.address?.department].filter(Boolean).join(', ')

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: 'rgba(3,7,18,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="h-full w-full max-w-md bg-white dark:bg-grafito-900 border-l border-grafito-200 dark:border-white/10 shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-grafito-100 dark:border-white/5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                <span className="text-base font-black text-brand-500">{supplier.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-grafito-900 dark:text-white truncate">{supplier.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {supplier.category && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-brand-500/10 text-brand-500">{supplier.category}</span>}
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', supplier.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-grafito-200 dark:bg-white/10 text-grafito-500')}>{supplier.is_active ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5 shrink-0"><X className="h-4 w-4" /></button>
          </div>

          {/* Acciones rápidas */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {actions.map((a) => (
                <a key={a.label} href={a.href} target={a.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-grafito-200 dark:border-white/10 text-grafito-700 dark:text-grafito-200 hover:bg-grafito-100 dark:hover:bg-white/5">
                  <a.icon className="h-3.5 w-3.5" /> {a.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Datos */}
        <div className="p-5 space-y-3">
          <InfoRow icon={Building2} label="NIT / Identificación" value={supplier.tax_id} />
          <InfoRow icon={Phone} label="Teléfono" value={supplier.phone} />
          <InfoRow icon={Mail} label="Correo" value={supplier.email} />
          <InfoRow icon={MapPin} label="Dirección" value={addr || null} />
          <InfoRow icon={CreditCard} label="Condición de pago" value={paymentLabel(supplier)} />
          {supplier.notes && <InfoRow icon={Receipt} label="Notas" value={supplier.notes} />}
        </div>

        {/* Gastos */}
        <div className="p-5 border-t border-grafito-100 dark:border-white/5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-grafito-900 dark:text-white">Gastos con este proveedor</h4>
            <span className="text-sm font-black text-brand-500">{formatCurrency(total, 'COP')}</span>
          </div>
          {isLoading ? (
            <div className="flex h-16 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-grafito-400" /></div>
          ) : expenses.length === 0 ? (
            <p className="text-xs text-grafito-400 py-4 text-center">Sin gastos registrados a este proveedor todavía.</p>
          ) : (
            <div className="space-y-1.5">
              {expenses.slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg bg-grafito-50 dark:bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-grafito-800 dark:text-grafito-100 truncate">{e.category}{e.description ? ` · ${e.description}` : ''}</p>
                    <p className="text-[11px] text-grafito-400">{new Date(e.expense_date).toLocaleDateString('es-CO')}</p>
                  </div>
                  <span className="text-xs font-semibold text-grafito-700 dark:text-grafito-200 shrink-0">{formatCurrency(Number(e.amount), e.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-grafito-100 dark:border-white/5">
          <button onClick={onEdit} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
            <Pencil className="h-4 w-4" /> Editar proveedor
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-grafito-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-grafito-400">{label}</p>
        <p className="text-sm text-grafito-800 dark:text-grafito-100 break-words">{value ?? '—'}</p>
      </div>
    </div>
  )
}

// ─── Página principal de Proveedores ─────────────────────────────────────────
export default function SuppliersPage() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ editing: SupplierRow | null } | null>(null)
  const [detail, setDetail] = useState<SupplierRow | null>(null)

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', tenantId],
    queryFn: () => getSuppliers(tenantId!, { includeInactive: true }),
    enabled: !!tenantId,
  })
  const { data: spend = {} } = useQuery({
    queryKey: ['supplier-spend', tenantId],
    queryFn: () => getSupplierSpend(tenantId!),
    enabled: !!tenantId,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.tax_id?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q) ||
      s.contact_name?.toLowerCase().includes(q),
    )
  }, [suppliers, search])

  const metrics = useMemo(() => {
    const active = suppliers.filter((s) => s.is_active).length
    const cats = new Set(suppliers.map((s) => s.category).filter(Boolean)).size
    const totalSpend = Object.values(spend).reduce((sum, v) => sum + v.total, 0)
    return { total: suppliers.length, active, cats, totalSpend }
  }, [suppliers, spend])

  const toggle = useMutation({
    mutationFn: (s: SupplierRow) => toggleSupplierActive(tenantId!, s.id, !s.is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers', tenantId] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteSupplier(tenantId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers', tenantId] }); toast.success('Proveedor eliminado') },
  })

  const openEditFromDetail = (s: SupplierRow) => { setDetail(null); setModal({ editing: s }) }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><Truck className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Proveedores</h1>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">Gestiona tus proveedores, contactos y compras.</p>
          </div>
        </div>
        <button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Nuevo proveedor
        </button>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Proveedores" value={String(metrics.total)} Icon={Truck} color="text-brand-500" bg="bg-brand-500/10" />
        <MetricCard label="Activos" value={String(metrics.active)} Icon={Power} color="text-emerald-500" bg="bg-emerald-500/10" />
        <MetricCard label="Categorías" value={String(metrics.cats)} Icon={Tags} color="text-purple-500" bg="bg-purple-500/10" />
        <MetricCard label="Gasto acumulado" value={formatCurrency(metrics.totalSpend, 'COP')} Icon={Wallet} color="text-amber-500" bg="bg-amber-400/10" />
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-grafito-900/60 border border-grafito-200 dark:border-white/5 px-3 py-2.5 max-w-md">
        <Search className="h-4 w-4 text-grafito-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, NIT, categoría o contacto…" className="flex-1 bg-transparent text-sm outline-none text-grafito-900 dark:text-white placeholder:text-grafito-400" />
      </div>

      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 overflow-x-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-grafito-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-grafito-400">
            <Truck className="h-8 w-8" />
            <p className="text-sm">Aún no hay proveedores. Crea el primero.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm min-w-[820px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3 text-right">Gasto acumulado</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
              {filtered.map((s) => {
                const sp = spend[s.id]
                return (
                  <tr key={s.id} onClick={() => setDetail(s)} className={cn('cursor-pointer hover:bg-grafito-50 dark:hover:bg-white/5', !s.is_active && 'opacity-50')}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-grafito-900 dark:text-white">{s.name}</p>
                      <div className="flex items-center gap-3 text-xs text-grafito-400 mt-0.5">
                        {s.address?.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.address.city}</span>}
                        {s.tax_id && <span>NIT {s.tax_id}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.category ? <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-grafito-100 dark:bg-white/10 text-grafito-600 dark:text-grafito-300">{s.category}</span> : <span className="text-grafito-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-grafito-700 dark:text-grafito-200">{s.contact_name ?? '—'}</p>
                      <div className="flex items-center gap-3 text-xs text-grafito-400 mt-0.5">
                        {s.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                        {s.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold', s.payment_terms === 'CREDIT' ? 'bg-amber-400/10 text-amber-600 dark:text-amber-400' : 'bg-grafito-100 dark:bg-white/10 text-grafito-600 dark:text-grafito-300')}>{paymentLabel(s)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {sp ? (
                        <div>
                          <p className="font-semibold text-grafito-900 dark:text-white">{formatCurrency(sp.total, 'COP')}</p>
                          <p className="text-[11px] text-grafito-400">{sp.count} gasto{sp.count !== 1 ? 's' : ''}</p>
                        </div>
                      ) : <span className="text-grafito-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', s.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-grafito-200 dark:bg-white/10 text-grafito-500')}>{s.is_active ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggle.mutate(s)} title={s.is_active ? 'Desactivar' : 'Activar'} className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Power className="h-4 w-4" /></button>
                        <button onClick={() => setModal({ editing: s })} title="Editar" className="rounded-lg p-1.5 text-grafito-400 hover:text-brand-500 hover:bg-brand-500/10"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { if (confirm(`¿Eliminar a "${s.name}"?`)) remove.mutate(s.id) }} title="Eliminar" className="rounded-lg p-1.5 text-grafito-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && tenantId && <SupplierModal tenantId={tenantId} editing={modal.editing} onClose={() => setModal(null)} />}
      {detail && tenantId && <SupplierDrawer tenantId={tenantId} supplier={detail} onClose={() => setDetail(null)} onEdit={() => openEditFromDetail(detail)} />}
    </div>
  )
}

function MetricCard({ label, value, Icon, color, bg }: { label: string; value: string; Icon: any; color: string; bg: string }) {
  return (
    <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-grafito-500 dark:text-grafito-400">{label}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', bg)}><Icon className={cn('h-4 w-4', color)} /></div>
      </div>
      <p className="text-xl font-bold text-grafito-900 dark:text-white">{value}</p>
    </div>
  )
}
