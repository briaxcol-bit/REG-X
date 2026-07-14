import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Settings, Shield, Building, Bell, Save, Loader2, Upload, Info,
  MonitorDown, CheckCircle2, Smartphone, Share,
} from 'lucide-react'
import {
  isInstalled, canInstall, isIOS, promptInstall, onInstallAvailabilityChange,
} from '@lib/pwa-install'
import { cn } from '@shared/utils/cn'
import { useAuthStore } from '@store/auth.store'
import {
  getMyTenant, updateMyTenant, updateMyTenantSettings, uploadMyTenantLogo, getMyModuleSlugs,
  type MyTenantRow, type TenantSettings,
} from '@lib/db'
import { isRoleAvailable } from '@shared/utils/roles'

const BUSINESS_TYPES = [
  { value: 'STORE',          label: 'Tienda' },
  { value: 'MINIMARKET',     label: 'Minimarket' },
  { value: 'HARDWARE',       label: 'Ferretería' },
  { value: 'WHOLESALE',      label: 'Mayorista / Distribuidora' },
  { value: 'PHARMACY',       label: 'Farmacia' },
  { value: 'RESTAURANT',     label: 'Restaurante' },
  { value: 'CAFE',           label: 'Cafetería' },
  { value: 'BAR',            label: 'Bar' },
  { value: 'RESTOBAR',       label: 'Resto-Bar' },
  { value: 'BAKERY',         label: 'Panadería' },
  { value: 'ICE_CREAM_SHOP', label: 'Heladería' },
  { value: 'SERVICES',       label: 'Servicios' },
  { value: 'CUSTOM',         label: 'Otro' },
]

const CURRENCIES = ['COP', 'USD', 'MXN', 'EUR', 'PEN', 'CLP', 'ARS']
const TIMEZONES = [
  'America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Santiago',
  'America/Argentina/Buenos_Aires', 'America/Caracas', 'America/New_York',
]
const LOCALES = [
  { value: 'es-CO', label: 'Español (Colombia)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'en-US', label: 'English (US)' },
]

// ── Matriz de roles (informativa, coincide con el store de auth) ──────────────
const ROLE_MATRIX: { role: string; label: string; desc: string; perms: string }[] = [
  { role: 'OWNER',             label: 'Propietario',        desc: 'Dueño del negocio',              perms: 'Acceso total a todo' },
  { role: 'ADMIN',             label: 'Administrador',      desc: 'Gestión operativa',              perms: 'Ventas, productos, inventario, reportes, restaurante' },
  { role: 'CASHIER',           label: 'Cajero',             desc: 'Punto de venta',                 perms: 'Vender, ver productos e inventario, comandas' },
  { role: 'WAITER',            label: 'Mesero',             desc: 'Solo mapa de mesas',             perms: 'Ver mesas y crear/abrir cuentas' },
  { role: 'CHEF',              label: 'Cocinero',           desc: 'Cocina',                         perms: 'Pantalla de cocina (KDS)' },
  { role: 'BARTENDER',         label: 'Bartender',          desc: 'Barra',                          perms: 'Vender, KDS, comandas de restaurante' },
  { role: 'ACCOUNTANT',        label: 'Contador',           desc: 'Finanzas',                       perms: 'Reportes e inventario (lectura)' },
  { role: 'INVENTORY_MANAGER', label: 'Jefe de Inventario', desc: 'Stock y catálogo',               perms: 'Inventario y productos' },
]

// ── Inputs reutilizables ──────────────────────────────────────────────────────
const inputCls =
  'w-full text-sm px-3 py-2 rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5 text-grafito-900 dark:text-white placeholder-grafito-400 focus:border-brand-500 focus:outline-none'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-grafito-400 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-grafito-400 mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/40 px-4 py-3 text-left hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-grafito-900 dark:text-white">{label}</p>
        <p className="text-xs text-grafito-500">{desc}</p>
      </div>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-500' : 'bg-grafito-300 dark:bg-white/10')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 space-y-5">
      <h2 className="text-xs font-bold uppercase tracking-wider text-grafito-500 dark:text-grafito-400">{title}</h2>
      {children}
    </div>
  )
}

function SaveBar({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <div className="flex justify-end pt-1">
      <button
        onClick={onSave}
        disabled={!dirty || saving}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
          dirty && !saving
            ? 'bg-brand-500 text-white hover:bg-brand-600'
            : 'border border-grafito-200 dark:border-white/10 text-grafito-400 cursor-default',
        )}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar cambios
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('business')
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const setTenant = useAuthStore((s) => s.setTenant)
  const storeTenant = useAuthStore((s) => s.tenant)
  const qc = useQueryClient()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['my-tenant', tenantId],
    queryFn: () => getMyTenant(tenantId!),
    enabled: !!tenantId,
  })

  const menuItems = [
    { id: 'business',      name: 'Datos de Empresa', icon: Building },
    { id: 'general',       name: 'General',          icon: Settings },
    { id: 'roles',         name: 'Roles y Permisos', icon: Shield   },
    { id: 'notifications', name: 'Notificaciones',   icon: Bell     },
    { id: 'app',           name: 'Aplicación',       icon: MonitorDown },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">Configuración</h1>
        <p className="text-sm text-grafito-500 dark:text-grafito-400">Administra los datos y preferencias de tu negocio.</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Sidebar */}
        <div className="w-full shrink-0 md:w-56 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                activeTab === item.id
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="flex-1 min-w-0">
          {isLoading || !tenant ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-grafito-400" />
            </div>
          ) : (
            <>
              {activeTab === 'business'      && <BusinessTab      tenant={tenant} tenantId={tenantId!} qc={qc} setTenant={setTenant} storeTenant={storeTenant} />}
              {activeTab === 'general'       && <GeneralTab       tenant={tenant} tenantId={tenantId!} qc={qc} />}
              {activeTab === 'roles'         && <RolesTab />}
              {activeTab === 'notifications' && <NotificationsTab tenant={tenant} tenantId={tenantId!} qc={qc} />}
              {activeTab === 'app'           && <AppInstallTab />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Aplicación (instalar PWA) ────────────────────────────────────────────
function AppInstallTab() {
  const [, forceRender] = useState(0)
  const [installing, setInstalling] = useState(false)

  useEffect(() => onInstallAvailabilityChange(() => forceRender(n => n + 1)), [])

  const installed = isInstalled()
  const available = canInstall()

  const handleInstall = async () => {
    setInstalling(true)
    try {
      const ok = await promptInstall()
      toast[ok ? 'success' : 'info'](ok
        ? 'REG-X instalada: búscala en tu escritorio o pantalla de inicio'
        : 'Instalación cancelada')
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2.5"><MonitorDown className="h-5 w-5 text-brand-500" /></div>
          <div>
            <h3 className="font-bold text-grafito-900 dark:text-white">Instalar REG-X como aplicación</h3>
            <p className="text-sm text-grafito-500 dark:text-grafito-400">
              Ventana propia, ícono en el escritorio o pantalla de inicio, y arranque directo al POS.
            </p>
          </div>
        </div>

        {installed ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Ya estás usando la aplicación instalada
          </div>
        ) : available ? (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorDown className="h-4 w-4" />}
            Instalar aplicación
          </button>
        ) : isIOS() ? (
          <div className="rounded-xl bg-grafito-50 dark:bg-white/5 border border-grafito-200 dark:border-white/10 p-4 space-y-2 text-sm text-grafito-600 dark:text-grafito-300">
            <p className="font-semibold flex items-center gap-2"><Smartphone className="h-4 w-4" /> En iPhone/iPad la instalación es manual:</p>
            <p className="flex items-center gap-1.5">1. Toca el botón <Share className="h-3.5 w-3.5 inline" /> <strong>Compartir</strong> de Safari</p>
            <p>2. Elige <strong>"Agregar a pantalla de inicio"</strong></p>
          </div>
        ) : (
          <div className="rounded-xl bg-grafito-50 dark:bg-white/5 border border-grafito-200 dark:border-white/10 p-4 text-sm text-grafito-500 dark:text-grafito-400">
            La instalación se ofrece en <strong>Chrome o Edge</strong> sobre la versión publicada (HTTPS).
            Si ya la instalaste antes, este aviso es normal. En Chrome también puedes usar el ícono
            de instalar en la barra de direcciones.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Datos de Empresa ─────────────────────────────────────────────────────
function BusinessTab({ tenant, tenantId, qc, setTenant, storeTenant }: {
  tenant: MyTenantRow; tenantId: string; qc: ReturnType<typeof useQueryClient>
  setTenant: (t: any) => void; storeTenant: any
}) {
  const [name, setName]       = useState(tenant.name)
  const [bizType, setBizType] = useState(tenant.business_type)
  const [taxId, setTaxId]     = useState(tenant.tax_id ?? '')
  const [street, setStreet]   = useState(tenant.address?.street ?? '')
  const [city, setCity]       = useState(tenant.address?.city ?? '')
  const [dept, setDept]       = useState(tenant.address?.department ?? '')
  const [primary, setPrimary] = useState(tenant.primary_color ?? '#F20D18')
  const [secondary, setSecondary] = useState(tenant.secondary_color ?? '#111827')
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url ?? '')
  const [uploading, setUploading] = useState(false)

  const dirty =
    name !== tenant.name ||
    bizType !== tenant.business_type ||
    taxId !== (tenant.tax_id ?? '') ||
    street !== (tenant.address?.street ?? '') ||
    city !== (tenant.address?.city ?? '') ||
    dept !== (tenant.address?.department ?? '') ||
    primary !== (tenant.primary_color ?? '#F20D18') ||
    secondary !== (tenant.secondary_color ?? '#111827') ||
    logoUrl !== (tenant.logo_url ?? '')

  const save = useMutation({
    mutationFn: () => updateMyTenant(tenantId, {
      name: name.trim(),
      business_type: bizType,
      tax_id: taxId.trim() || null,
      address: { street: street.trim(), city: city.trim(), department: dept.trim() },
      primary_color: primary,
      secondary_color: secondary,
      logo_url: logoUrl.trim() || null,
    }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['my-tenant', tenantId] })
      // Refresca el contexto para que el sidebar/tema reflejen los cambios al instante
      setTenant({
        ...storeTenant,
        tenantName: row.name,
        businessType: row.business_type,
        logoUrl: row.logo_url ?? undefined,
        primaryColor: row.primary_color ?? undefined,
        secondaryColor: row.secondary_color ?? undefined,
      })
      toast.success('Datos de la empresa guardados')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadMyTenantLogo(tenantId, file)
      setLogoUrl(url)
      toast.success('Logo subido. Recuerda guardar los cambios.')
    } catch (err: any) {
      toast.error('No se pudo subir el archivo. Aplica la migración 024 o pega una URL de imagen.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Panel title="Datos de la empresa">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-grafito-200 dark:border-white/10 bg-grafito-50 dark:bg-white/5">
          {logoUrl
            ? <img src={logoUrl} alt="logo" className="h-full w-full object-contain" />
            : <Building className="h-6 w-6 text-grafito-400" />}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-grafito-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-colors">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Subir logo
              <input type="file" accept="image/*" className="hidden" onChange={onPickLogo} disabled={uploading} />
            </label>
            {logoUrl && (
              <button onClick={() => setLogoUrl('')} className="rounded-xl px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
                Quitar
              </button>
            )}
          </div>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="…o pega la URL de una imagen" className={inputCls} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del negocio"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Tipo de negocio">
          <select value={bizType} onChange={(e) => setBizType(e.target.value)} className={inputCls}>
            {BUSINESS_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="NIT / Identificación tributaria"><input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="900.123.456-7" className={inputCls} /></Field>
        <Field label="Departamento"><input value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls} /></Field>
        <Field label="Ciudad"><input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} /></Field>
        <Field label="Dirección"><input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} /></Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Color primario">
          <div className="flex items-center gap-2">
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-grafito-200 dark:border-white/10 bg-transparent" />
            <input value={primary} onChange={(e) => setPrimary(e.target.value)} className={inputCls} />
          </div>
        </Field>
        <Field label="Color secundario">
          <div className="flex items-center gap-2">
            <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-grafito-200 dark:border-white/10 bg-transparent" />
            <input value={secondary} onChange={(e) => setSecondary(e.target.value)} className={inputCls} />
          </div>
        </Field>
      </div>

      <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} />
    </Panel>
  )
}

// ── Tab: General ──────────────────────────────────────────────────────────────
function GeneralTab({ tenant, tenantId, qc }: {
  tenant: MyTenantRow; tenantId: string; qc: ReturnType<typeof useQueryClient>
}) {
  const r = tenant.settings?.receipt ?? {}
  const [currency, setCurrency] = useState(tenant.currency ?? 'COP')
  const [timezone, setTimezone] = useState(tenant.timezone ?? 'America/Bogota')
  const [locale, setLocale]     = useState(tenant.locale ?? 'es-CO')
  const [header, setHeader]     = useState(r.header ?? '')
  const [footer, setFooter]     = useState(r.footer ?? '¡Gracias por su compra!')
  const [phone, setPhone]       = useState(r.phone ?? '')
  const [showLogo, setShowLogo] = useState(r.show_logo ?? true)
  const [showTax, setShowTax]   = useState(r.show_tax_id ?? true)

  const dirty =
    currency !== (tenant.currency ?? 'COP') ||
    timezone !== (tenant.timezone ?? 'America/Bogota') ||
    locale !== (tenant.locale ?? 'es-CO') ||
    header !== (r.header ?? '') ||
    footer !== (r.footer ?? '¡Gracias por su compra!') ||
    phone !== (r.phone ?? '') ||
    showLogo !== (r.show_logo ?? true) ||
    showTax !== (r.show_tax_id ?? true)

  const save = useMutation({
    mutationFn: async () => {
      await updateMyTenant(tenantId, { currency, timezone, locale })
      await updateMyTenantSettings(tenantId, tenant.settings ?? null, {
        general: { currency, timezone, locale },
        receipt: { header: header.trim(), footer: footer.trim(), phone: phone.trim(), show_logo: showLogo, show_tax_id: showTax },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tenant', tenantId] })
      toast.success('Preferencias guardadas')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  return (
    <div className="space-y-6">
      <Panel title="Regional">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Moneda">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Zona horaria">
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
              {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Idioma / formato">
            <select value={locale} onChange={(e) => setLocale(e.target.value)} className={inputCls}>
              {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title="Recibo / Factura POS">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Encabezado" hint="Texto arriba del recibo (ej. eslogan)."><input value={header} onChange={(e) => setHeader(e.target.value)} className={inputCls} /></Field>
          <Field label="Teléfono en el recibo"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Field>
          <Field label="Pie de página" hint="Mensaje de agradecimiento o políticas."><input value={footer} onChange={(e) => setFooter(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle checked={showLogo} onChange={setShowLogo} label="Mostrar logo en el recibo" desc="Imprime el logo de la empresa" />
          <Toggle checked={showTax} onChange={setShowTax} label="Mostrar NIT en el recibo" desc="Incluye la identificación tributaria" />
        </div>
        <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} />
      </Panel>
    </div>
  )
}

// ── Tab: Roles y Permisos (informativo) ───────────────────────────────────────
function RolesTab() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const { data: modules } = useQuery({
    queryKey: ['my-module-slugs', tenantId],
    queryFn: () => getMyModuleSlugs(tenantId!),
    enabled: !!tenantId,
  })
  const roles = ROLE_MATRIX.filter((r) => isRoleAvailable(r.role, modules))

  return (
    <Panel title="Roles y permisos">
      <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-500 dark:text-blue-300">
          Roles disponibles según los módulos activos de tu negocio. Asignas el rol a cada
          persona desde <span className="font-semibold">Empleados</span>.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-grafito-200 dark:border-white/5">
        <table className="w-full text-left text-sm min-w-[560px]">
          <thead>
            <tr className="text-[11px] font-semibold uppercase text-grafito-500 border-b border-grafito-200 dark:border-white/5">
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Puede</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grafito-100 dark:divide-white/5">
            {roles.map((r) => (
              <tr key={r.role} className="hover:bg-grafito-50 dark:hover:bg-white/5">
                <td className="px-4 py-3">
                  <p className="font-semibold text-grafito-900 dark:text-white">{r.label}</p>
                  <p className="text-[10px] font-mono text-grafito-400">{r.role}</p>
                </td>
                <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{r.desc}</td>
                <td className="px-4 py-3 text-grafito-500 dark:text-grafito-300">{r.perms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

// ── Tab: Notificaciones ───────────────────────────────────────────────────────
function NotificationsTab({ tenant, tenantId, qc }: {
  tenant: MyTenantRow; tenantId: string; qc: ReturnType<typeof useQueryClient>
}) {
  const n = tenant.settings?.notifications ?? {}
  const [lowStock, setLowStock]   = useState(n.low_stock ?? true)
  const [cashClose, setCashClose] = useState(n.cash_close ?? true)
  const [expiry, setExpiry]       = useState(n.expiry_alerts ?? false)
  const [daily, setDaily]         = useState(n.daily_summary ?? false)
  const [newSale, setNewSale]     = useState(n.new_sale ?? false)

  const dirty =
    lowStock !== (n.low_stock ?? true) ||
    cashClose !== (n.cash_close ?? true) ||
    expiry !== (n.expiry_alerts ?? false) ||
    daily !== (n.daily_summary ?? false) ||
    newSale !== (n.new_sale ?? false)

  const save = useMutation({
    mutationFn: () => updateMyTenantSettings(tenantId, tenant.settings ?? null, {
      notifications: { low_stock: lowStock, cash_close: cashClose, expiry_alerts: expiry, daily_summary: daily, new_sale: newSale },
    } as TenantSettings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tenant', tenantId] })
      toast.success('Notificaciones guardadas')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo guardar'),
  })

  return (
    <Panel title="Notificaciones">
      <div className="space-y-3">
        <Toggle checked={lowStock}  onChange={setLowStock}  label="Alertas de stock bajo"        desc="Avisar cuando un producto baje del mínimo" />
        <Toggle checked={cashClose} onChange={setCashClose} label="Cierre de caja"               desc="Resumen al cerrar la caja de cada turno" />
        <Toggle checked={expiry}    onChange={setExpiry}    label="Vencimientos"                 desc="Productos próximos a vencer (farmacia/alimentos)" />
        <Toggle checked={daily}     onChange={setDaily}     label="Resumen diario de ventas"     desc="Recibe un resumen al final del día" />
        <Toggle checked={newSale}   onChange={setNewSale}   label="Cada venta"                   desc="Notificación por cada venta registrada" />
      </div>
      <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} />
    </Panel>
  )
}
