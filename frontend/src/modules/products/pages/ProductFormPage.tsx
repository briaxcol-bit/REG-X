import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Save, ImagePlus, Barcode, Tag,
  DollarSign, TrendingUp, Package, X, ScanLine, ChevronDown, Check,
} from 'lucide-react'
import { getCategories, createProduct } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'
import type { CategoryRow } from '@lib/db'

// ── Custom Select ─────────────────────────────────────────────
interface SelectOption { value: string; label: string; color?: string }
function CustomSelect({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const inBtn  = btnRef.current?.contains(target)
      const inList = listRef.current?.contains(target)
      if (!inBtn && !inList) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-950 px-3.5 py-2.5 text-sm transition-all outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      >
        <span className={cn('flex items-center gap-2', selected?.value ? 'text-grafito-900 dark:text-white' : 'text-grafito-400')}>
          {selected?.color && <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: selected.color }} />}
          {selected?.label ?? placeholder ?? 'Seleccionar'}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-grafito-400 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && rect && createPortal(
        <div
          ref={listRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 99999 }}
          className="rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl overflow-hidden"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full flex items-center justify-between px-3.5 py-2.5 text-sm hover:bg-grafito-50 dark:hover:bg-white/5 transition-colors',
                value === opt.value
                  ? 'text-brand-500 font-semibold bg-brand-500/5'
                  : 'text-grafito-700 dark:text-grafito-200',
              )}
            >
              <span className="flex items-center gap-2">
                {opt.color && <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }} />}
                {opt.label}
              </span>
              {value === opt.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-950 px-3.5 py-2.5 text-grafito-900 dark:text-white placeholder:text-grafito-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none text-sm'

const labelClass =
  'text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wider'

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-grafito-100 dark:border-white/5">
      <Icon className="h-4 w-4 text-brand-500" />
      <span className="text-sm font-bold text-grafito-700 dark:text-grafito-200">{title}</span>
    </div>
  )
}

export default function ProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const { tenant, branch, profile, user } = useAuthStore()

  // ── State ─────────────────────────────────────────────────
  const [name, setName]           = useState('')
  const [sku, setSku]             = useState('')
  const [barcode, setBarcode]     = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [margin, setMargin]       = useState('')
  const [stock, setStock]         = useState('0')
  const [minStock, setMinStock]   = useState('0')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile]       = useState<File | null>(null)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [marginMode, setMarginMode] = useState<'price' | 'percent'>('price')
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    if (!name.trim()) { setSaveError('El nombre del producto es obligatorio.'); return }

    const userId   = profile?.id ?? user?.id
    const tenantId = tenant?.tenantId

    if (!userId || !tenantId) {
      setSaveError('No se encontró el tenant. Asegúrate de tener un negocio configurado en Supabase.')
      return
    }

    setSaving(true)
    try {
      await createProduct(tenantId, userId, {
        name:          name.trim(),
        sku:           sku.trim(),
        barcode:       barcode.trim() || undefined,
        category_id:   /^[0-9a-f-]{36}$/.test(categoryId) ? categoryId : undefined,
        price:         parseFloat(salePrice) || 0,
        cost_price:    parseFloat(costPrice) || undefined,
        imageFile:     imageFile || undefined,
        min_stock:     parseFloat(minStock) || 0,
        initialStock:  parseFloat(stock) || 0,
        branchId:      branch?.branchId,
      })
      navigate('/products')
    } catch (err: any) {
      setSaveError(err?.message ?? 'Error al guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  // ── Load categories ───────────────────────────────────────
  useEffect(() => {
    if (tenant?.tenantId) {
      getCategories(tenant.tenantId).then(setCategories).catch(() => {})
    }
  }, [tenant?.tenantId])

  // ── Price / margin sync ───────────────────────────────────
  const handleCostChange = (val: string) => {
    setCostPrice(val)
    const cost = parseFloat(val)
    if (!isNaN(cost) && cost > 0) {
      if (marginMode === 'percent' && margin) {
        const pct = parseFloat(margin)
        if (!isNaN(pct)) setSalePrice((cost * (1 + pct / 100)).toFixed(2))
      } else if (marginMode === 'price' && salePrice) {
        const sale = parseFloat(salePrice)
        if (!isNaN(sale) && sale > cost) setMargin((((sale - cost) / cost) * 100).toFixed(1))
      }
    }
  }

  const handleSalePriceChange = (val: string) => {
    setSalePrice(val)
    const sale = parseFloat(val)
    const cost = parseFloat(costPrice)
    if (!isNaN(sale) && !isNaN(cost) && cost > 0 && sale > cost) {
      setMargin((((sale - cost) / cost) * 100).toFixed(1))
    } else {
      setMargin('')
    }
  }

  const handleMarginChange = (val: string) => {
    setMargin(val)
    const pct = parseFloat(val)
    const cost = parseFloat(costPrice)
    if (!isNaN(pct) && !isNaN(cost) && cost > 0) {
      setSalePrice((cost * (1 + pct / 100)).toFixed(2))
    }
  }

  // ── Image ─────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const profit = (() => {
    const s = parseFloat(salePrice)
    const c = parseFloat(costPrice)
    if (!isNaN(s) && !isNaN(c) && s > c) return (s - c).toFixed(2)
    return null
  })()

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/products')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-grafito-900 dark:text-white tracking-tight">
            {isEdit ? 'Editar Producto' : 'Crear Producto'}
          </h1>
          <p className="text-sm text-grafito-500 dark:text-grafito-400">
            {isEdit ? 'Modifica los detalles del producto.' : 'Registra un nuevo producto en tu catálogo.'}
          </p>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>

        {/* ── Imagen + Nombre + Categoría ───────────────────── */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 space-y-4 backdrop-blur-md">
          <SectionTitle icon={Tag} title="Información general" />

          <div className="flex gap-4">
            {/* Imagen */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'relative flex-shrink-0 h-28 w-28 rounded-2xl border-2 border-dashed transition-all overflow-hidden',
                imagePreview
                  ? 'border-brand-500/40'
                  : 'border-grafito-200 dark:border-white/10 hover:border-brand-500/50 hover:bg-brand-500/5',
              )}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImagePlus className="h-5 w-5 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-1 text-grafito-400 dark:text-grafito-500">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-[10px] font-medium text-center px-1">Subir imagen</span>
                </div>
              )}
            </button>
            {imagePreview && (
              <button
                type="button"
                onClick={() => { setImagePreview(null); setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="absolute mt-1 ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-grafito-900/70 text-white hover:bg-red-500 transition-colors"
                style={{ position: 'relative', alignSelf: 'flex-start', marginLeft: '-12px', marginTop: '4px' }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

            {/* Nombre + Categoría */}
            <div className="flex-1 space-y-3">
              <div className="space-y-1.5">
                <label className={labelClass}>Nombre del producto</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Coca-Cola 350ml"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Categoría</label>
                <CustomSelect
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder="— Sin categoría —"
                  options={[
                    { value: '', label: '— Sin categoría —' },
                    ...(categories.length > 0
                      ? categories.map(c => ({ value: c.id, label: c.name, color: c.color }))
                      : [
                          { value: 'alimentos', label: 'Alimentos', color: '#ef4444' },
                          { value: 'bebidas',   label: 'Bebidas',   color: '#3b82f6' },
                          { value: 'postres',   label: 'Postres',   color: '#ec4899' },
                          { value: 'acomp',     label: 'Acompañamientos', color: '#eab308' },
                        ]
                    ),
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Código ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 space-y-4 backdrop-blur-md">
          <SectionTitle icon={Barcode} title="Identificación" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClass}>Código SKU</label>
              <div className="relative">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
                <input
                  value={sku}
                  onChange={e => setSku(e.target.value)}
                  placeholder="Ej. SKU-770123"
                  className={cn(inputClass, 'pl-9')}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Código de barras</label>
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
                <input
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="Escanea o escribe el código"
                  className={cn(inputClass, 'pl-9')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Precios ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 space-y-4 backdrop-blur-md">
          <SectionTitle icon={DollarSign} title="Precios" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClass}>Precio de costo</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-grafito-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={e => handleCostChange(e.target.value)}
                  placeholder="0.00"
                  className={cn(inputClass, 'pl-7')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Precio de venta</label>
                <button
                  type="button"
                  onClick={() => setMarginMode(m => m === 'price' ? 'percent' : 'price')}
                  className="text-[10px] font-semibold text-brand-500 hover:text-brand-400 transition-colors"
                >
                  {marginMode === 'price' ? '+ usar % ganancia' : '+ usar precio directo'}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-grafito-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePrice}
                  onChange={e => handleSalePriceChange(e.target.value)}
                  placeholder="0.00"
                  className={cn(inputClass, 'pl-7')}
                />
              </div>
            </div>
          </div>

          {/* Margen */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClass}>% Ganancia</label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grafito-400" />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={margin}
                  onChange={e => handleMarginChange(e.target.value)}
                  placeholder="0.0"
                  className={cn(inputClass, 'pl-9')}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-grafito-400">%</span>
              </div>
            </div>

            {/* Resumen ganancia */}
            <div className="flex items-end">
              <div className={cn(
                'w-full rounded-xl px-4 py-2.5 text-sm',
                profit
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-grafito-100 dark:bg-grafito-800/50 border border-grafito-200 dark:border-white/5 text-grafito-400',
              )}>
                {profit ? (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">Ganancia por unidad</span>
                    <span className="font-bold">${profit}</span>
                  </div>
                ) : (
                  <span className="text-xs">Ingresa costo y precio de venta para ver la ganancia</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stock ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 space-y-4 backdrop-blur-md">
          <SectionTitle icon={Package} title="Inventario" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClass}>Stock inicial</label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={e => setStock(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Stock mínimo (alerta)</label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={e => setMinStock(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
              <p className="text-[11px] text-grafito-400">Recibirás una alerta cuando el stock baje de este número.</p>
            </div>
          </div>
        </div>

        {/* ── Error ─────────────────────────────────────────── */}
        {saveError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {saveError}
          </div>
        )}

        {/* ── Guardar ───────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-3 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 active:scale-[0.98] transition-all shadow-lg shadow-brand-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  )
}
