import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTenantWithOwner, uploadTenantLogo, type CreateTenantInput } from '@lib/db'
import { supabase } from '@lib/supabase'
import { X, Loader2, Building2, UserPlus, CheckCircle, AlertCircle, Copy, UploadCloud, Palette, Image as ImageIcon } from 'lucide-react'
import { cn } from '@shared/utils/cn'

interface CreateTenantModalProps {
  open: boolean
  onClose: () => void
}

const BUSINESS_TYPES = [
  { value: 'STORE',          label: 'Tienda' },
  { value: 'HARDWARE',       label: 'Ferretería' },
  { value: 'MINIMARKET',     label: 'Minimarket' },
  { value: 'WHOLESALE',      label: 'Mayorista / Distribuidora' },
  { value: 'PHARMACY',       label: 'Farmacia' },
  { value: 'RESTAURANT',     label: 'Restaurante' },
  { value: 'CAFE',           label: 'Cafetería' },
  { value: 'BAR',            label: 'Bar' },
  { value: 'RESTOBAR',       label: 'Resto-Bar' },
  { value: 'BAKERY',         label: 'Panadería' },
  { value: 'ICE_CREAM_SHOP', label: 'Heladería' },
  { value: 'SERVICES',       label: 'Servicios (taller, peluquería…)' },
  { value: 'CUSTOM',         label: 'Otro (configuración manual)' },
]

const MODULE_LABELS: Record<string, string> = {
  // Core
  pos:                'Punto de Venta',
  inventory:          'Inventario',
  customers:          'Clientes',
  reports:            'Reportes',
  expenses:           'Gastos Operativos',
  suppliers:          'Proveedores',
  // Restaurant / F&B
  kitchen_display:    'Pantalla de Cocina (KDS)',
  tables:             'Gestión de Mesas',
  reservations:       'Reservas',
  bar_tabs:           'Comandas de Bar',
  delivery:           'Delivery',
  menu_digital:       'Menú Digital QR',
  tips:               'Propinas',
  split_bill:         'División de Cuenta',
  // Retail
  promotions:         'Promociones y Descuentos',
  loyalty:            'Fidelización',
  label_printer:      'Impresora de Etiquetas',
  purchase_orders:    'Órdenes de Compra',
  price_lists:        'Listas de Precios',
  gift_cards:         'Tarjetas de Regalo',
  layaway:            'Apartados',
  // Pharmacy
  prescriptions:      'Recetas Médicas',
  expiry_control:     'Control de Vencimientos',
  batch_tracking:     'Trazabilidad por Lotes',
  drug_catalog:       'Catálogo de Medicamentos',
  // Hardware
  quotes:             'Cotizaciones',
  work_orders:        'Órdenes de Trabajo',
  assemblies:         'Ensambles y Kits',
  unit_conversion:    'Conversión de Unidades',
  serial_tracking:    'Seguimiento por Serial',
  // Finance
  accounting:         'Contabilidad',
  accounts_receivable:'Cuentas por Cobrar',
  accounts_payable:   'Cuentas por Pagar',
  tax_reports:        'Informes Tributarios',
  payroll:            'Nómina',
  // HR
  employees:          'Empleados',
  attendance:         'Asistencia y Turnos',
  commissions:        'Comisiones',
  // Advanced
  multi_branch:       'Multi-Sucursal',
  warehouse_transfer: 'Transferencia de Bodegas',
  ecommerce:          'Tienda en Línea',
  webhooks:           'Webhooks / API',
  audit_log:          'Auditoría',
}

// Módulos core que no se pueden desactivar
const CORE_MODULES = ['pos','inventory','customers','reports','expenses','suppliers']

const MODULES_BY_TYPE: Record<string, string[]> = {
  STORE:          ['pos','inventory','customers','reports','expenses','suppliers',
                   'promotions','loyalty','label_printer','purchase_orders','price_lists','gift_cards','layaway',
                   'employees','commissions','attendance','accounts_receivable','accounts_payable'],
  HARDWARE:       ['pos','inventory','customers','reports','expenses','suppliers',
                   'quotes','work_orders','assemblies','unit_conversion','serial_tracking',
                   'label_printer','purchase_orders','price_lists','promotions','layaway',
                   'employees','commissions','attendance','accounts_receivable','accounts_payable'],
  MINIMARKET:     ['pos','inventory','customers','reports','expenses','suppliers',
                   'promotions','loyalty','label_printer','purchase_orders','price_lists','gift_cards',
                   'expiry_control','batch_tracking',
                   'employees','commissions','attendance','accounts_payable'],
  WHOLESALE:      ['pos','inventory','customers','reports','expenses','suppliers',
                   'purchase_orders','price_lists','quotes','label_printer','batch_tracking','serial_tracking',
                   'employees','attendance','accounts_receivable','accounts_payable','tax_reports'],
  PHARMACY:       ['pos','inventory','customers','reports','expenses','suppliers',
                   'prescriptions','expiry_control','batch_tracking','drug_catalog',
                   'label_printer','purchase_orders','price_lists',
                   'employees','attendance','accounts_receivable','accounts_payable','tax_reports'],
  RESTAURANT:     ['pos','inventory','customers','reports','expenses','suppliers',
                   'kitchen_display','tables','reservations','delivery','menu_digital','tips','split_bill',
                   'promotions','loyalty',
                   'employees','commissions','attendance','payroll','accounts_payable'],
  CAFE:           ['pos','inventory','customers','reports','expenses','suppliers',
                   'kitchen_display','tables','delivery','menu_digital','tips',
                   'promotions','loyalty',
                   'employees','commissions','attendance'],
  BAR:            ['pos','inventory','customers','reports','expenses','suppliers',
                   'kitchen_display','tables','bar_tabs','tips','split_bill',
                   'promotions','loyalty',
                   'employees','commissions','attendance'],
  RESTOBAR:       ['pos','inventory','customers','reports','expenses','suppliers',
                   'kitchen_display','tables','bar_tabs','reservations','delivery','menu_digital','tips','split_bill',
                   'promotions','loyalty',
                   'employees','commissions','attendance','payroll','accounts_payable'],
  BAKERY:         ['pos','inventory','customers','reports','expenses','suppliers',
                   'kitchen_display','delivery','menu_digital',
                   'promotions','loyalty','label_printer','purchase_orders',
                   'employees','commissions','attendance'],
  ICE_CREAM_SHOP: ['pos','inventory','customers','reports','expenses','suppliers',
                   'promotions','loyalty','label_printer',
                   'employees','commissions','attendance'],
  SERVICES:       ['pos','inventory','customers','reports','expenses','suppliers',
                   'quotes','work_orders',
                   'employees','commissions','attendance','payroll',
                   'accounts_receivable','accounts_payable'],
  CUSTOM:         ['pos','inventory','customers','reports','expenses','suppliers'],
}

const PLANS = ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'] as const

const PRESET_COLORS = [
  { name: 'Rojo (Default)', value: '#F20D18' },
  { name: 'Esmeralda',      value: '#10b981' },
  { name: 'Azul',           value: '#3b82f6' },
  { name: 'Violeta',        value: '#8b5cf6' },
  { name: 'Naranja',        value: '#f97316' },
  { name: 'Ámbar',          value: '#f59e0b' },
  { name: 'Cian',           value: '#06b6d4' },
  { name: 'Rosa',           value: '#ec4899' },
  { name: 'Grafito',        value: '#374151' },
  { name: 'Negro',          value: '#111827' },
]

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const initial: CreateTenantInput = {
  name: '', slug: '', business_type: 'STORE', plan: 'BASIC',
  country: 'CO', currency: 'COP',
  owner_email: '', owner_name: '', owner_password: '',
  primary_color: '#F20D18',
  secondary_color: '#111827',
}

async function disableModules(tenantId: string, slugsToDisable: string[]) {
  if (!slugsToDisable.length) return
  // Obtener los module_ids de los slugs a deshabilitar
  const { data: mods } = await (supabase as any)
    .from('marketplace_modules')
    .select('id, slug')
    .in('slug', slugsToDisable)
  if (!mods?.length) return
  const ids = mods.map((m: any) => m.id)
  await (supabase as any)
    .from('tenant_modules')
    .update({ is_enabled: false })
    .eq('tenant_id', tenantId)
    .in('module_id', ids)
}

export function CreateTenantModal({ open, onClose }: CreateTenantModalProps) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateTenantInput>(initial)
  const [slugTouched, setSlugTouched] = useState(false)
  const [selectedModules, setSelectedModules] = useState<Set<string>>(
    new Set(MODULES_BY_TYPE['STORE'])
  )

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      let finalLogoUrl: string | undefined = undefined
      if (logoFile) finalLogoUrl = await uploadTenantLogo(logoFile)

      const result = await createTenantWithOwner({ ...form, logo_url: finalLogoUrl })

      // Deshabilitar módulos que el admin desmarcó
      const defaultMods = MODULES_BY_TYPE[form.business_type] ?? MODULES_BY_TYPE.CUSTOM
      const toDisable = defaultMods.filter((s) => !selectedModules.has(s))
      if (result?.tenant_id) await disableModules(result.tenant_id, toDisable)

      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-tenants'] })
      qc.invalidateQueries({ queryKey: ['platform-stats'] })
    },
  })

  if (!open) return null

  const set = (k: keyof CreateTenantInput, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleName = (v: string) =>
    setForm((f) => ({ ...f, name: v, slug: slugTouched ? f.slug : slugify(v) }))

  const handleBusinessType = (biz: string) => {
    set('business_type', biz)
    setSelectedModules(new Set(MODULES_BY_TYPE[biz] ?? MODULES_BY_TYPE.CUSTOM))
  }

  const toggleModule = (slug: string) => {
    if (CORE_MODULES.includes(slug)) return // core no se puede desactivar
    setSelectedModules((prev) => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const valid =
    form.name.trim().length >= 2 &&
    form.slug.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(form.owner_email) &&
    form.owner_name.trim().length >= 2 &&
    form.owner_password.length >= 8

  const done = mutation.isSuccess
  const result = mutation.data

  const reset = () => {
    mutation.reset()
    setForm(initial)
    setSlugTouched(false)
    setLogoFile(null)
    setLogoPreview(null)
    setSelectedModules(new Set(MODULES_BY_TYPE['STORE']))
  }
  const close = () => { reset(); onClose() }

  const defaultMods = MODULES_BY_TYPE[form.business_type] ?? MODULES_BY_TYPE.CUSTOM

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-grafito-200 dark:border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${form.primary_color}15`, color: form.primary_color }}
            >
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="h-full w-full rounded-xl object-cover" />
                : <Building2 className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-grafito-900 dark:text-white">Nuevo tenant</h2>
              <p className="text-xs text-grafito-500">Crea un espacio 100% editable</p>
            </div>
          </div>
          <button onClick={close} className="rounded-md p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          /* ── Éxito ── */
          <div className="p-6 space-y-4 max-w-md mx-auto">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <div>
                <p className="font-bold text-grafito-900 dark:text-white">Tenant creado exitosamente</p>
                <p className="text-sm text-grafito-500">{form.name}</p>
              </div>
            </div>
            <div className="rounded-xl bg-grafito-50 dark:bg-white/5 p-4 space-y-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-grafito-400">Credenciales del OWNER</p>
              <Row label="Email" value={result?.owner_email ?? form.owner_email} />
              <Row label="Contraseña" value={form.owner_password} />
              <p className="text-xs text-grafito-400 pt-1">
                Compártelas con el dueño. Él podrá ingresar y crear al resto de su equipo.
              </p>
            </div>
            <button onClick={close} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: form.primary_color }}>
              Listo
            </button>
          </div>
        ) : (
          /* ── Formulario ── */
          <form onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate() }} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* ── Columna izquierda ── */}
              <div className="space-y-6">
                <Section title="Identidad Visual" icon={<Palette className="h-3.5 w-3.5" />}>
                  <Field label="Logo (Opcional)">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-grafito-200 dark:border-white/10 rounded-xl cursor-pointer hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors overflow-hidden relative group"
                    >
                      <input type="file" ref={fileInputRef} onChange={handleLogoSelect} accept="image/*" className="hidden" />
                      {logoPreview ? (
                        <>
                          <img src={logoPreview} alt="Preview" className="h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs font-semibold text-white flex items-center gap-1"><UploadCloud className="h-3 w-3" /> Cambiar logo</p>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-grafito-400">
                          <ImageIcon className="h-6 w-6 mb-1 opacity-50" />
                          <span className="text-xs font-medium">Click para subir logo</span>
                        </div>
                      )}
                    </div>
                  </Field>

                  <Field label="Color Primario de la Marca">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2 mt-1">
                        {PRESET_COLORS.map(color => (
                          <button key={color.value} type="button" onClick={() => set('primary_color', color.value)}
                            className={cn("w-6 h-6 rounded-full border-2 transition-all",
                              form.primary_color === color.value
                                ? "border-grafito-900 dark:border-white scale-110"
                                : "border-transparent scale-100 opacity-80 hover:scale-110 hover:opacity-100")}
                            style={{ backgroundColor: color.value }} title={color.name} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={form.primary_color} onChange={(e) => set('primary_color', e.target.value)}
                          className="h-8 w-12 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span className="text-xs font-mono text-grafito-500">{form.primary_color}</span>
                      </div>
                    </div>
                  </Field>

                  <Field label="Color Secundario (Acento)">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2 mt-1">
                        {PRESET_COLORS.map(color => (
                          <button key={color.value} type="button" onClick={() => set('secondary_color', color.value)}
                            className={cn("w-6 h-6 rounded-full border-2 transition-all",
                              form.secondary_color === color.value
                                ? "border-grafito-900 dark:border-white scale-110"
                                : "border-transparent scale-100 opacity-80 hover:scale-110 hover:opacity-100")}
                            style={{ backgroundColor: color.value }} title={color.name} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={form.secondary_color ?? '#111827'} onChange={(e) => set('secondary_color', e.target.value)}
                          className="h-8 w-12 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span className="text-xs font-mono text-grafito-500">{form.secondary_color}</span>
                      </div>
                    </div>
                  </Field>
                </Section>

                <Section title="Usuario OWNER" icon={<UserPlus className="h-3.5 w-3.5" />}>
                  <Field label="Nombre completo">
                    <input value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)}
                      placeholder="Juan Pérez" className={inputCls} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={form.owner_email} onChange={(e) => set('owner_email', e.target.value)}
                      placeholder="owner@empresa.com" className={inputCls} />
                  </Field>
                  <Field label="Contraseña temporal">
                    <input value={form.owner_password} onChange={(e) => set('owner_password', e.target.value)}
                      placeholder="mínimo 8 caracteres" className={`${inputCls} font-mono`} />
                  </Field>
                </Section>
              </div>

              {/* ── Columna derecha ── */}
              <div className="space-y-6">
                <Section title="Información de Empresa" icon={<Building2 className="h-3.5 w-3.5" />}>
                  <Field label="Nombre">
                    <input value={form.name} onChange={(e) => handleName(e.target.value)}
                      placeholder="Mi Empresa S.A.S" className={inputCls} />
                  </Field>
                  <Field label="Slug (URL)">
                    <input value={form.slug}
                      onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)) }}
                      placeholder="mi-empresa" className={`${inputCls} font-mono`} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tipo de negocio">
                      <select value={form.business_type} onChange={(e) => handleBusinessType(e.target.value)} className={inputCls}>
                        {BUSINESS_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Plan Inicial">
                      <select value={form.plan} onChange={(e) => set('plan', e.target.value)} className={inputCls}>
                        {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="País (ISO)">
                      <input value={form.country} onChange={(e) => set('country', e.target.value.toUpperCase())}
                        maxLength={3} placeholder="CO" className={inputCls} />
                    </Field>
                    <Field label="Moneda (ISO)">
                      <input value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())}
                        maxLength={3} placeholder="COP" className={inputCls} />
                    </Field>
                  </div>
                </Section>

                {/* ── Módulos toggleables ── */}
                <Section title="Módulos" icon={
                  <span className="text-[10px] font-semibold text-grafito-400">
                    {selectedModules.size}/{defaultMods.length} activos
                  </span>
                }>
                  <div className="space-y-1">
                    {defaultMods.map((slug) => {
                      const isCore = CORE_MODULES.includes(slug)
                      const active = selectedModules.has(slug)
                      return (
                        <button
                          key={slug}
                          type="button"
                          onClick={() => toggleModule(slug)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                            active
                              ? 'bg-grafito-50 dark:bg-white/5'
                              : 'bg-grafito-50/40 dark:bg-white/[0.02] opacity-50',
                            isCore ? 'cursor-default' : 'hover:bg-grafito-100 dark:hover:bg-white/10 cursor-pointer'
                          )}
                        >
                          <span className={cn(
                            'font-medium',
                            active ? 'text-grafito-800 dark:text-white' : 'text-grafito-400 line-through'
                          )}>
                            {MODULE_LABELS[slug] ?? slug}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0 ml-2">
                            {isCore && (
                              <span className="text-[9px] font-bold uppercase text-grafito-400 bg-grafito-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                core
                              </span>
                            )}
                            {/* Toggle pill */}
                            <span
                              className={cn(
                                'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors',
                                active ? 'bg-emerald-500' : 'bg-grafito-300 dark:bg-white/20'
                              )}
                            >
                              <span className={cn(
                                'inline-block h-3 w-3 rounded-full bg-white shadow transition-transform',
                                active ? 'translate-x-3.5' : 'translate-x-0.5'
                              )} />
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </Section>

                {/* Live Preview */}
                <div className="p-4 rounded-xl border border-grafito-200 dark:border-white/10 overflow-hidden relative">
                  <div className="absolute inset-0 opacity-10"
                    style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color ?? '#111827'})` }} />
                  <p className="text-xs font-semibold text-grafito-400 mb-3 uppercase tracking-wider relative z-10">Preview de Marca</p>
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0 shadow-md overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color ?? '#111827'})` }}>
                      {logoPreview
                        ? <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                        : <span className="text-white font-bold text-lg">{(form.name || 'E').charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-semibold text-sm truncate dark:text-white">{form.name || 'Mi Empresa S.A.S'}</p>
                      <div className="flex gap-1 mt-1.5">
                        <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: form.primary_color }} />
                        <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: form.secondary_color ?? '#111827' }} />
                      </div>
                    </div>
                    <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white shadow-md"
                      style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color ?? '#111827'})` }}>
                      Acción
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {mutation.isError && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{(mutation.error as Error)?.message ?? 'Error al crear el tenant'}</span>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-grafito-200 dark:border-white/5">
              <button type="button" onClick={close}
                className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5">
                Cancelar
              </button>
              <button type="submit" disabled={!valid || mutation.isPending}
                style={{ backgroundColor: form.primary_color }}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white opacity-90 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear Tenant y Enviar Credenciales
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 text-grafito-900 dark:text-white placeholder-grafito-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40'

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-4 bg-white dark:bg-grafito-800/50 p-4 rounded-xl border border-grafito-100 dark:border-white/5">
      <p className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-grafito-500 dark:text-grafito-400">
        <span>{title}</span>
        {icon}
      </p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-grafito-700 dark:text-grafito-300">{label}</span>
      {children}
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center justify-between gap-2 bg-white dark:bg-grafito-900 p-2 rounded-lg border border-grafito-100 dark:border-white/5">
      <span className="text-xs font-medium text-grafito-500">{label}</span>
      <button type="button" onClick={copy}
        className="flex items-center gap-1.5 font-mono text-sm text-grafito-900 dark:text-white hover:opacity-70 transition-opacity">
        {value}
        {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 opacity-50" />}
      </button>
    </div>
  )
}
