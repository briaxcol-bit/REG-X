import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateTenant, uploadTenantLogo, type PlatformTenantRow, type UpdateTenantInput } from '@lib/db'
import {
  X, Loader2, Building2, CheckCircle, AlertCircle,
  UploadCloud, Palette, Image as ImageIcon, Trash2,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'

interface EditTenantModalProps {
  tenant: PlatformTenantRow | null
  onClose: () => void
}

const BUSINESS_TYPES = [
  { value: 'STORE', label: 'Tienda' },
  { value: 'RESTAURANT', label: 'Restaurante' },
  { value: 'BAR', label: 'Bar' },
  { value: 'RESTOBAR', label: 'Resto-Bar' },
  { value: 'BAKERY', label: 'Panadería' },
  { value: 'ICE_CREAM_SHOP', label: 'Heladería' },
  { value: 'PHARMACY', label: 'Farmacia' },
  { value: 'MINIMARKET', label: 'Minimarket' },
  { value: 'CUSTOM', label: 'Otro' },
]

const PRESET_COLORS = [
  { name: 'Rojo (Default)', value: '#F20D18' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Violeta', value: '#8b5cf6' },
  { name: 'Naranja', value: '#f97316' },
  { name: 'Ámbar', value: '#f59e0b' },
  { name: 'Cian', value: '#06b6d4' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Grafito', value: '#374151' },
  { name: 'Negro', value: '#111827' },
]

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const inputCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 text-grafito-900 dark:text-white placeholder-grafito-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40'

function ColorPicker({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-grafito-700 dark:text-grafito-300">{label}</span>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            title={c.name}
            className={cn(
              'w-6 h-6 rounded-full border-2 transition-all',
              value === c.value
                ? 'border-grafito-900 dark:border-white scale-110'
                : 'border-transparent opacity-80 hover:scale-110 hover:opacity-100',
            )}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 rounded cursor-pointer border-0 p-0 bg-transparent"
        />
        <span className="text-xs font-mono text-grafito-500">{value}</span>
      </div>
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

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-4 bg-white dark:bg-grafito-800/50 p-4 rounded-xl border border-grafito-100 dark:border-white/5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-grafito-500 dark:text-grafito-400">
        {icon}{title}
      </p>
      {children}
    </div>
  )
}

export function EditTenantModal({ tenant, onClose }: EditTenantModalProps) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<UpdateTenantInput & { name: string; slug: string; business_type: string; country: string; currency: string }>({
    name: '', slug: '', business_type: 'STORE', country: 'CO', currency: 'COP',
    logo_url: undefined, primary_color: '#F20D18', secondary_color: '#111827',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)

  // Hydrate form when tenant changes
  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name,
        slug: tenant.slug,
        business_type: tenant.business_type,
        country: tenant.country,
        currency: 'COP',
        logo_url: tenant.logo_url ?? undefined,
        primary_color: tenant.primary_color || '#F20D18',
        secondary_color: tenant.secondary_color || '#111827',
      })
      setLogoPreview(tenant.logo_url ?? null)
      setLogoFile(null)
      setRemoveLogo(false)
      setSlugTouched(false)
    }
  }, [tenant])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tenant) return
      let finalLogoUrl: string | undefined = form.logo_url

      if (removeLogo) {
        finalLogoUrl = '__REMOVE__'
      } else if (logoFile) {
        finalLogoUrl = await uploadTenantLogo(logoFile)
      }

      await updateTenant(tenant.id, { ...form, logo_url: finalLogoUrl })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-tenants'] })
      qc.invalidateQueries({ queryKey: ['platform-stats'] })
      onClose()
    },
  })

  if (!tenant) return null

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleName = (v: string) =>
    setForm((f) => ({ ...f, name: v, slug: slugTouched ? f.slug : slugify(v) }))

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      setRemoveLogo(false)
      const reader = new FileReader()
      reader.onloadend = () => setLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setRemoveLogo(true)
  }

  const currentLogoDisplay = removeLogo ? null : (logoPreview ?? tenant.logo_url)

  const valid = form.name.trim().length >= 2 && form.slug.trim().length >= 2

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-grafito-200 dark:border-white/5"
          style={{ background: `linear-gradient(135deg, ${form.primary_color}18, ${form.secondary_color}10)` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl overflow-hidden shadow-md"
              style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }}
            >
              {currentLogoDisplay ? (
                <img src={currentLogoDisplay} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-white font-bold text-lg">{form.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-grafito-900 dark:text-white">
                Editar: <span style={{ color: form.primary_color }}>{form.name || tenant.name}</span>
              </h2>
              <p className="text-xs text-grafito-500 font-mono">{form.slug || tenant.slug}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate() }}
          className="p-6 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna izquierda: Identidad Visual */}
            <div className="space-y-5">
              <Section title="Identidad Visual" icon={<Palette className="h-3.5 w-3.5" />}>
                {/* Logo Upload */}
                <Field label="Logo">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-grafito-200 dark:border-white/10 rounded-xl cursor-pointer hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors overflow-hidden relative group"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    {currentLogoDisplay ? (
                      <>
                        <img src={currentLogoDisplay} alt="Preview" className="h-full object-contain" />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                          <span className="text-xs font-semibold text-white flex items-center gap-1">
                            <UploadCloud className="h-3 w-3" /> Cambiar
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-grafito-400">
                        <ImageIcon className="h-6 w-6 mb-1 opacity-50" />
                        <span className="text-xs font-medium">Click para subir logo</span>
                      </div>
                    )}
                  </div>
                  {currentLogoDisplay && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Eliminar logo
                    </button>
                  )}
                </Field>

                {/* Color Primario */}
                <ColorPicker
                  label="Color Primario (Principal)"
                  value={form.primary_color || '#F20D18'}
                  onChange={(v) => set('primary_color', v)}
                />

                {/* Color Secundario */}
                <ColorPicker
                  label="Color Secundario (Acento)"
                  value={form.secondary_color || '#111827'}
                  onChange={(v) => set('secondary_color', v)}
                />
              </Section>

              {/* Live Preview Card */}
              <div className="p-4 rounded-xl border border-grafito-200 dark:border-white/10 overflow-hidden relative">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }}
                />
                <p className="text-xs font-semibold text-grafito-400 mb-3 uppercase tracking-wider relative z-10">Preview de Marca</p>
                <div className="flex items-center gap-3 relative z-10">
                  <div
                    className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0 shadow-md overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }}
                  >
                    {currentLogoDisplay ? (
                      <img src={currentLogoDisplay} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-lg">{(form.name || 'E').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-semibold text-sm truncate dark:text-white">{form.name || 'Nombre Empresa'}</p>
                    <p className="text-xs font-mono text-grafito-400">{form.slug || 'slug-empresa'}</p>
                    <div className="flex gap-1 mt-1.5">
                      <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: form.primary_color }} />
                      <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: form.secondary_color }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white shadow-md"
                    style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }}
                  >
                    Acción
                  </button>
                </div>
              </div>
            </div>

            {/* Columna derecha: Información */}
            <div className="space-y-5">
              <Section title="Información de Empresa" icon={<Building2 className="h-3.5 w-3.5" />}>
                <Field label="Nombre de la Empresa">
                  <input
                    value={form.name}
                    onChange={(e) => handleName(e.target.value)}
                    placeholder="Mi Empresa S.A.S"
                    className={inputCls}
                  />
                </Field>
                <Field label="Slug (URL Identificador)">
                  <input
                    value={form.slug}
                    onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)) }}
                    placeholder="mi-empresa"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="Tipo de Negocio">
                  <select
                    value={form.business_type}
                    onChange={(e) => set('business_type', e.target.value)}
                    className={inputCls}
                  >
                    {BUSINESS_TYPES.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="País (ISO 3)">
                    <input
                      value={form.country}
                      onChange={(e) => set('country', e.target.value.toUpperCase())}
                      maxLength={3}
                      placeholder="CO"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Moneda (ISO)">
                    <input
                      value={form.currency}
                      onChange={(e) => set('currency', e.target.value.toUpperCase())}
                      maxLength={3}
                      placeholder="COP"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </Section>
            </div>
          </div>

          {mutation.isError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{(mutation.error as Error)?.message ?? 'Error al guardar los cambios'}</span>
            </div>
          )}

          {mutation.isSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-500">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>¡Cambios guardados exitosamente!</span>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-grafito-200 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!valid || mutation.isPending}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity opacity-90 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
