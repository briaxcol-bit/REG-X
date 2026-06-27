import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Save, ImagePlus, Barcode, Tag,
  DollarSign, TrendingUp, Package, X, ScanLine, ChevronDown, Check, Loader2,
  Trash2, AlertTriangle, Camera, Plus,
} from 'lucide-react'
import { getCategories, createCategory, createProduct, getProduct, updateProduct, deleteProduct } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { cn } from '@shared/utils/cn'
import type { CategoryRow } from '@lib/db'
import { useQueryClient } from '@tanstack/react-query'

// ── Custom Select ─────────────────────────────────────────────
interface SelectOption { value: string; label: string; color?: string }
function CustomSelect({ value, onChange, options, placeholder, onCreateNew }: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  onCreateNew?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef  = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  // Actualizar posición al hacer scroll; cerrar solo al click afuera
  useEffect(() => {
    if (!open) return
    const updatePos = () => {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    }
    const onMouse = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open])

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
          className="rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
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
          {onCreateNew && (
            <button
              type="button"
              onClick={() => { setOpen(false); onCreateNew() }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-brand-500 font-semibold hover:bg-brand-500/5 border-t border-grafito-100 dark:border-white/5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Nueva categoría
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-950 px-3.5 py-2.5 text-grafito-900 dark:text-white placeholder:text-grafito-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none text-sm'

// ── Price Input ───────────────────────────────────────────────
function PriceInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  const intVal  = Math.round(parseFloat(value) || 0)
  const fmt     = (n: number) => n > 0 ? n.toLocaleString('es-CO') : ''
  const [display, setDisplay] = useState(() => fmt(intVal))
  const focused = useRef(false)

  // Sincroniza cuando el padre cambia el valor (carga inicial o recálculo de margen)
  useEffect(() => {
    if (!focused.current) setDisplay(fmt(intVal))
  }, [intVal]) // eslint-disable-line

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    const num    = parseInt(digits, 10) || 0
    const next   = fmt(num)
    setDisplay(next)
    // Cursor siempre al final
    requestAnimationFrame(() => {
      e.target.setSelectionRange(next.length, next.length)
    })
    onChange(num > 0 ? String(num) : '')
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-grafito-400">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={placeholder ?? '0'}
        className={cn(inputClass, 'pl-7', className)}
        onFocus={e => {
          focused.current = true
          const raw = intVal > 0 ? String(intVal) : ''
          setDisplay(raw)
          setTimeout(() => e.target.select(), 0)
        }}
        onChange={handleChange}
        onBlur={() => {
          focused.current = false
          setDisplay(fmt(intVal))
        }}
      />
    </div>
  )
}

const labelClass =
  'text-xs font-semibold text-grafito-500 dark:text-grafito-400 uppercase tracking-wider'

// ── Camera Modal ──────────────────────────────────────────────
function CameraModal({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [ready, setReady]   = useState(false)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')

  const startCamera = useCallback(async (facingMode: 'environment' | 'user') => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setReady(true)
      }
      setError(null)
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos.')
    }
  }, [])

  useEffect(() => {
    startCamera(facing)
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [facing, startCamera])

  const capture = () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    onCapture(canvas.toDataURL('image/jpeg', 0.9))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-grafito-900 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-semibold text-white flex items-center gap-2"><Camera className="h-4 w-4 text-brand-400" /> Tomar foto</span>
          <button onClick={onClose} className="text-grafito-400 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="relative aspect-square bg-black">
          {error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-400">{error}</div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          )}
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex gap-2 p-4">
          <button
            type="button"
            onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')}
            className="flex-none rounded-xl bg-grafito-800 p-3 text-grafito-300 hover:bg-grafito-700 transition-colors"
            title="Cambiar cámara"
          >
            <Camera className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={capture}
            disabled={!ready || !!error}
            className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-40 transition-colors"
          >
            Capturar
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-grafito-100 dark:border-white/5">
      <Icon className="h-4 w-4 text-brand-500" />
      <span className="text-sm font-bold text-grafito-700 dark:text-grafito-200">{title}</span>
    </div>
  )
}

interface ProductFormPageProps {
  /** Cuando se usa como modal desde otra página (ej. inventario) */
  modalProductId?: string
  onClose?: () => void
  onSaved?: () => void
}

export default function ProductFormPage({ modalProductId, onClose, onSaved }: ProductFormPageProps = {}) {
  const navigate  = useNavigate()
  const { id: routeId } = useParams()
  const isModal   = !!onClose
  const id        = modalProductId ?? routeId
  const isEdit    = !!id
  const { tenant, branch, profile, user } = useAuthStore()
  const qc        = useQueryClient()

  const dismiss = (saved = false) => {
    if (isModal) {
      if (saved) onSaved?.()
      onClose?.()
    } else {
      navigate('/products')
    }
  }

  // ── State ─────────────────────────────────────────────────
  const [name, setName]               = useState('')
  const [sku, setSku]                 = useState('')
  const [barcode, setBarcode]         = useState('')
  const [categoryId, setCategoryId]   = useState('')
  const [costPrice, setCostPrice]     = useState('')
  const [salePrice, setSalePrice]     = useState('')
  const [margin, setMargin]           = useState('')
  const [stock, setStock]             = useState('0')
  const [minStock, setMinStock]       = useState('0')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile]       = useState<File | null>(null)
  const [categories, setCategories]   = useState<CategoryRow[]>([])
  const [marginMode, setMarginMode]   = useState<'price' | 'percent'>('price')
  const [saving, setSaving]           = useState(false)
  const [loadingProduct, setLoadingProduct] = useState(isEdit)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  const fileInputRef  = useRef<HTMLInputElement>(null)

  const handleCreateCategory = async () => {
    if (!newCatName.trim() || !tenant?.tenantId) return
    setSavingCat(true)
    try {
      const cat = await createCategory(tenant.tenantId, newCatName, newCatColor)
      setCategories(prev => [...prev, cat])
      setCategoryId(cat.id)
      setNewCatOpen(false)
      setNewCatName('')
      setNewCatColor('#6366f1')
    } catch {}
    finally { setSavingCat(false) }
  }
  const [cameraOpen, setCameraOpen]         = useState(false)
  const [newCatOpen, setNewCatOpen]         = useState(false)
  const [newCatName, setNewCatName]         = useState('')
  const [newCatColor, setNewCatColor]       = useState('#6366f1')
  const [savingCat, setSavingCat]           = useState(false)

  // ── Load categories ───────────────────────────────────────
  useEffect(() => {
    if (tenant?.tenantId) {
      getCategories(tenant.tenantId).then(setCategories).catch(() => {})
    }
  }, [tenant?.tenantId])

  // ── Load product data on edit ─────────────────────────────
  useEffect(() => {
    if (!isEdit || !id || !tenant?.tenantId) return
    setLoadingProduct(true)
    getProduct(tenant.tenantId, id)
      .then(p => {
        if (!p) return
        setName(p.name ?? '')
        setSku(p.sku ?? '')
        setBarcode(p.barcode ?? '')
        setCategoryId(p.category_id ?? '')
        setCostPrice(p.cost_price != null ? String(p.cost_price) : '')
        setSalePrice(p.price != null ? String(p.price) : '')
        if (p.cost_price && p.price && p.price > p.cost_price) {
          setMargin((((p.price - p.cost_price) / p.cost_price) * 100).toFixed(1))
        }
        setMinStock(String(p.min_stock ?? 0))
        if (p.image_url) setImagePreview(p.image_url)
        const totalQty = (p.inventory ?? []).reduce((s, i) => s + Number(i.quantity), 0)
        setStock(String(totalQty))
      })
      .catch(() => {})
      .finally(() => setLoadingProduct(false))
  }, [isEdit, id, tenant?.tenantId])

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

    const payload = {
      name:         name.trim(),
      sku:          sku.trim(),
      barcode:      barcode.trim() || undefined,
      category_id:  /^[0-9a-f-]{36}$/.test(categoryId) ? categoryId : undefined,
      price:        parseFloat(salePrice) || 0,
      cost_price:   parseFloat(costPrice) || undefined,
      imageFile:    imageFile || undefined,
      // Si no hay imagen nueva pero hay preview tipo URL (no base64), usarla
      image_url:    !imageFile && imagePreview?.startsWith('http') ? imagePreview : undefined,
      min_stock:    parseFloat(minStock) || 0,
      initialStock: parseFloat(stock) || 0,
      branchId:     branch?.branchId,
    }

    setSaving(true)
    try {
      if (isEdit && id) {
        await updateProduct(tenantId, id, payload)
      } else {
        await createProduct(tenantId, userId, payload)
      }
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      dismiss(true)
    } catch (err: any) {
      setSaveError(err?.message ?? 'Error al guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  // ── Price / margin sync ───────────────────────────────────
  const handleCostChange = (val: string) => {
    setCostPrice(val)
    const cost = parseInt(val, 10)
    if (!isNaN(cost) && cost > 0) {
      if (marginMode === 'percent' && margin) {
        const pct = parseFloat(margin)
        if (!isNaN(pct)) setSalePrice(Math.round(cost * (1 + pct / 100)).toString())
      } else if (marginMode === 'price' && salePrice) {
        const sale = parseInt(salePrice, 10)
        if (!isNaN(sale) && sale > cost) setMargin((((sale - cost) / cost) * 100).toFixed(1))
      }
    }
  }

  const handleSalePriceChange = (val: string) => {
    setSalePrice(val)
    const sale = parseInt(val, 10)
    const cost = parseInt(costPrice, 10)
    if (!isNaN(sale) && !isNaN(cost) && cost > 0 && sale > cost) {
      setMargin((((sale - cost) / cost) * 100).toFixed(1))
    } else {
      setMargin('')
    }
  }

  const handleMarginChange = (val: string) => {
    setMargin(val)
    const pct = parseFloat(val)
    const cost = parseInt(costPrice, 10)
    if (!isNaN(pct) && !isNaN(cost) && cost > 0) {
      setSalePrice(Math.round(cost * (1 + pct / 100)).toString())
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
    const s = parseInt(salePrice, 10)
    const c = parseInt(costPrice, 10)
    if (!isNaN(s) && !isNaN(c) && s > c) return (s - c).toLocaleString('es-CO')
    return null
  })()

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async () => {
    const tenantId = tenant?.tenantId
    if (!id || !tenantId) return
    setDeleting(true)
    try {
      await deleteProduct(tenantId, id)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      dismiss(true)
    } catch (err: any) {
      setSaveError(err?.message ?? 'Error al eliminar el producto.')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────
  if (loadingProduct) {
    const loader = (
      <div className="flex items-center justify-center py-32 gap-3 text-grafito-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Cargando producto...</span>
      </div>
    )
    if (isModal) return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">{loader}</div>,
      document.body,
    )
    return <div className="p-6 max-w-3xl">{loader}</div>
  }

  const formContent = (
    <div className={cn('space-y-6', isModal ? '' : 'p-6 max-w-3xl')}>

      {/* ── Modal eliminar ─────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 shadow-2xl p-6 space-y-4">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-lg text-grafito-400 hover:bg-grafito-100 dark:hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-grafito-900 dark:text-white">Eliminar producto</h3>
                <p className="mt-1 text-sm text-grafito-500 dark:text-grafito-400">
                  ¿Estás seguro de que quieres eliminar{' '}
                  <span className="font-semibold text-grafito-700 dark:text-grafito-200">{name}</span>?
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dismiss()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-grafito-200 dark:border-white/5 bg-grafito-100 dark:bg-grafito-800 text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
          >
            {isModal ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
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
        {isEdit && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/20 transition-all"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </button>
        )}
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>

        {/* ── Imagen + Nombre + Categoría ───────────────────── */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/5 bg-white dark:bg-grafito-900/60 p-5 space-y-4 backdrop-blur-md">
          <SectionTitle icon={Tag} title="Información general" />

          <div className="flex gap-4">
            {/* Imagen */}
            <div className="relative flex-shrink-0">
              {/* Preview */}
              <div className={cn(
                'relative h-28 w-28 rounded-2xl border-2 border-dashed overflow-hidden transition-all',
                imagePreview ? 'border-brand-500/40' : 'border-grafito-200 dark:border-white/10',
              )}>
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setImagePreview(null); setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-grafito-900/80 text-white hover:bg-red-500 transition-colors z-10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1 text-grafito-400 dark:text-grafito-500">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[10px] font-medium text-center px-1">Imagen</span>
                  </div>
                )}
              </div>

              {/* Botones debajo */}
              <div className="flex gap-1 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-grafito-100 dark:bg-grafito-800 py-1.5 text-[10px] font-medium text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
                >
                  <ImagePlus className="h-3 w-3" /> Archivo
                </button>
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-grafito-100 dark:bg-grafito-800 py-1.5 text-[10px] font-medium text-grafito-600 dark:text-grafito-300 hover:bg-grafito-200 dark:hover:bg-grafito-700 transition-colors"
                >
                  <Camera className="h-3 w-3" /> Cámara
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

            {/* Modal cámara */}
            {cameraOpen && createPortal(
              <CameraModal
                onCapture={(dataUrl) => {
                  setImagePreview(dataUrl)
                  // Convertir dataUrl → File para subirla a Storage
                  fetch(dataUrl)
                    .then(r => r.blob())
                    .then(blob => setImageFile(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })))
                  setCameraOpen(false)
                }}
                onClose={() => setCameraOpen(false)}
              />,
              document.body
            )}

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
                  onCreateNew={() => setNewCatOpen(true)}
                  options={[
                    { value: '', label: '— Sin categoría —' },
                    ...categories.map(c => ({ value: c.id, label: c.name, color: c.color })),
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Modal nueva categoría ─────────────────────────── */}
        {newCatOpen && createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNewCatOpen(false)} />
            <div className="relative w-full max-w-xs rounded-2xl bg-white dark:bg-grafito-900 border border-grafito-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-grafito-900 dark:text-white">Nueva categoría</h3>
              <div className="space-y-1.5">
                <label className={labelClass}>Nombre</label>
                <input
                  autoFocus
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="Ej: Bebidas, Snacks…"
                  className={inputClass}
                  onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={e => setNewCatColor(e.target.value)}
                    className="h-10 w-10 rounded-lg cursor-pointer border border-grafito-200 dark:border-white/10"
                  />
                  <span className="text-sm text-grafito-500">{newCatColor}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNewCatOpen(false)}
                  className="flex-1 rounded-xl border border-grafito-200 dark:border-white/10 py-2.5 text-sm font-medium text-grafito-600 dark:text-grafito-300 hover:bg-grafito-50 dark:hover:bg-grafito-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={!newCatName.trim() || savingCat}
                  className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-40 transition-colors"
                >
                  {savingCat ? 'Guardando…' : 'Crear'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

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
              <PriceInput value={costPrice} onChange={handleCostChange} />
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
              <PriceInput value={salePrice} onChange={handleSalePriceChange} />
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
              <label className={labelClass}>{isEdit ? 'Stock actual' : 'Stock inicial'}</label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={e => setStock(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
              {isEdit && (
                <p className="text-[11px] text-grafito-400">Cambia este valor para ajustar el stock en bodega.</p>
              )}
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
            onClick={() => dismiss()}
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

  if (isModal) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => dismiss()} />
        {/* Panel — mismo ancho que max-w-3xl pero scrollable */}
        <div className="relative w-full max-w-3xl max-h-[95dvh] sm:max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-grafito-50 dark:bg-grafito-950 shadow-2xl border border-grafito-200 dark:border-white/10 p-6">
          {formContent}
        </div>
      </div>,
      document.body,
    )
  }

  return formContent
}
