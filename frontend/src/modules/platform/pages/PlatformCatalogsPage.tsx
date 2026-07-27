import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BookOpen, Plus, Trash2, Loader2, ImagePlus, Package, X, ChevronRight, ListPlus,
  Compass, Search, CheckCircle2, AlertTriangle, Store, Download, ScanBarcode, Sparkles,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { hasWhiteBackground, type WhiteBgResult } from '@shared/utils/image-check'
import {
  getCatalogTemplates, createCatalogTemplate, deleteCatalogTemplate,
  getCatalogItems, addCatalogItem, updateCatalogItem, deleteCatalogItem,
  bulkAddCatalogItems, uploadCatalogImage, generateBrandCatalogs, deleteAutoCatalogs,
  discoverTenantProducts, copyImageToCatalog, getTenantProductStats, getBrandStats,
  getUnclassifiedProducts, addBrandRule,
  type CatalogItemRow, type DiscoveredProduct, type UnclassifiedProduct,
} from '@lib/db'

const inputCls = 'w-full rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-800 px-3 py-2 text-sm text-grafito-900 dark:text-white placeholder-grafito-400 outline-none focus:ring-2 focus:ring-brand-500/40'

const BUSINESS_TYPES = [
  { value: '',           label: 'Cualquiera' },
  { value: 'STORE',      label: 'Tienda' },
  { value: 'RESTAURANT', label: 'Restaurante' },
  { value: 'BAR',        label: 'Bar' },
  { value: 'BAKERY',     label: 'Panadería' },
  { value: 'PHARMACY',   label: 'Farmacia' },
  { value: 'MINIMARKET', label: 'Minimarket' },
]

export default function PlatformCatalogsPage() {
  const [tab, setTab] = useState<'catalogs' | 'discover' | 'pending'>('catalogs')

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-500/10 p-2.5"><BookOpen className="h-5 w-5 text-brand-500" /></div>
        <div>
          <h1 className="text-xl font-black text-grafito-900 dark:text-white">Catálogos maestros</h1>
          <p className="text-sm text-grafito-500">
            Listas de productos para cargarle a un negocio nuevo en un clic (nombre, categoría e imagen).
          </p>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 border-b border-grafito-200 dark:border-white/10">
        {([
          { key: 'catalogs', label: 'Mis catálogos', Icon: BookOpen },
          { key: 'discover', label: 'Descubrir de clientes', Icon: Compass },
          { key: 'pending',  label: 'Marcas por definir', Icon: AlertTriangle },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === t.key
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-grafito-500 hover:text-grafito-900 dark:hover:text-white',
            )}
          >
            <t.Icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'catalogs' ? <CatalogsTab />
        : tab === 'discover' ? <DiscoverTab />
        : <UnclassifiedTab />}
    </div>
  )
}

function CatalogsTab() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName]       = useState('')
  const [newType, setNewType]       = useState('')
  const [bulkOpen, setBulkOpen]     = useState(false)
  const [bulkText, setBulkText]     = useState('')

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['catalog-templates'],
    queryFn:  getCatalogTemplates,
  })

  const selected = templates.find(t => t.id === selectedId) ?? null

  const createTpl = useMutation({
    mutationFn: () => createCatalogTemplate({ name: newName, business_type: newType || undefined }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['catalog-templates'] })
      setNewName(''); setNewType(''); setSelectedId(t.id)
      toast.success('Catálogo creado')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear el catálogo'),
  })

  const removeTpl = useMutation({
    mutationFn: (id: string) => deleteCatalogTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-templates'] })
      setSelectedId(null)
      toast.success('Catálogo eliminado')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo eliminar'),
  })

  const generate = useMutation({
    mutationFn: () => generateBrandCatalogs({ minTenants: 1, byManufacturer: true }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['catalog-templates'] })
      toast.success(
        `${r.catalogs_created} catálogo${r.catalogs_created === 1 ? '' : 's'} · ` +
        `${r.items_created} producto${r.items_created === 1 ? '' : 's'} agregado${r.items_created === 1 ? '' : 's'}`,
        { duration: 6000 },
      )
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudieron generar los catálogos'),
  })

  const removeAuto = useMutation({
    mutationFn: () => deleteAutoCatalogs(),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['catalog-templates'] })
      setSelectedId(null)
      toast.success(`${n} catálogo${n === 1 ? '' : 's'} automático${n === 1 ? '' : 's'} eliminado${n === 1 ? '' : 's'}`)
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo borrar'),
  })

  const bulkAdd = useMutation({
    mutationFn: () => {
      // Formato por línea: "Nombre" o "Nombre, Categoría"
      const rows = bulkText.split('\n').map(l => {
        const [name, category] = l.split(/[,;\t]/)
        return { name: name ?? '', category }
      })
      return bulkAddCatalogItems(selectedId!, rows)
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['catalog-items', selectedId] })
      qc.invalidateQueries({ queryKey: ['catalog-templates'] })
      setBulkText(''); setBulkOpen(false)
      toast.success(`${n} producto${n === 1 ? '' : 's'} agregado${n === 1 ? '' : 's'}`)
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudieron agregar'),
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── Lista de catálogos ─────────────────────────── */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-grafito-500">Nuevo catálogo</p>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ej: Tienda de barrio"
              className={inputCls}
            />
            <select value={newType} onChange={e => setNewType(e.target.value)} className={inputCls}>
              {BUSINESS_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <button
              onClick={() => createTpl.mutate()}
              disabled={newName.trim().length < 2 || createTpl.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {createTpl.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear
            </button>
          </div>

          {/* Generación automática por proveedor */}
          <div className="rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-grafito-500">Automático</p>
            <p className="text-xs text-grafito-500">
              Arma un catálogo por proveedor (Coca-Cola, Postobón, Bavaria…) con los
              productos que ya tienen tus clientes. Se puede repetir: completa sin duplicar.
            </p>
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {generate.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
                : <><Sparkles className="h-4 w-4" /> Generar por proveedor</>}
            </button>
            <button
              onClick={() => {
                if (confirm('¿Borrar los catálogos generados automáticamente? Los que creaste a mano no se tocan.')) {
                  removeAuto.mutate()
                }
              }}
              disabled={removeAuto.isPending}
              className="w-full rounded-xl border border-grafito-200 dark:border-white/10 py-2 text-xs font-semibold text-grafito-500 hover:bg-grafito-100 dark:hover:bg-white/5 disabled:opacity-50"
            >
              Borrar los automáticos
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-grafito-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : templates.length === 0 ? (
            <p className="p-4 text-sm text-grafito-500">Aún no hay catálogos.</p>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors',
                    selectedId === t.id
                      ? 'border-brand-500/50 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 hover:border-grafito-300',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-grafito-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-grafito-500">{t.item_count ?? 0} productos</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-grafito-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Detalle del catálogo ───────────────────────── */}
        <div className="rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-5">
          {!selected ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-grafito-400">
              <Package className="h-10 w-10 opacity-30" />
              <p className="text-sm">Selecciona un catálogo para ver sus productos</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-grafito-900 dark:text-white">{selected.name}</h2>
                  {selected.description && <p className="text-xs text-grafito-500">{selected.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBulkOpen(v => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-grafito-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5"
                  >
                    <ListPlus className="h-3.5 w-3.5" /> Pegar lista
                  </button>
                  <button
                    onClick={() => { if (confirm(`¿Eliminar el catálogo "${selected.name}"?`)) removeTpl.mutate(selected.id) }}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </div>

              {bulkOpen && (
                <div className="rounded-xl border border-grafito-200 dark:border-white/10 p-3 space-y-2">
                  <p className="text-xs text-grafito-500">
                    Un producto por línea. Para incluir la categoría: <code>Nombre, Categoría</code>
                  </p>
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    rows={6}
                    placeholder={'Coca-Cola 400ml, Gaseosas\nPapas Margarita, Snacks\nElectrolit, Bebidas'}
                    className={cn(inputCls, 'resize-none font-mono text-xs')}
                  />
                  <button
                    onClick={() => bulkAdd.mutate()}
                    disabled={bulkText.trim().length === 0 || bulkAdd.isPending}
                    className="flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {bulkAdd.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Agregar al catálogo
                  </button>
                </div>
              )}

              <CatalogItems templateId={selected.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Descubrir: productos que ya cargaron los clientes
// ══════════════════════════════════════════════════════════════
function DiscoverTab() {
  const qc = useQueryClient()
  const [search, setSearch]           = useState('')
  const [debounced, setDebounced]     = useState('')
  const [onlyWithImage, setOnlyImage] = useState(true)
  const [hideInCatalog, setHideInCat] = useState(true)
  const [onlyWhite, setOnlyWhite]     = useState(true)
  const [onlyBarcode, setOnlyBarcode] = useState(false)
  const [tenantId, setTenantId]       = useState('')
  const [brand, setBrand]             = useState('')
  const [showStats, setShowStats]     = useState(false)
  const [targetTpl, setTargetTpl]     = useState('')
  const [checks, setChecks]           = useState<Record<string, WhiteBgResult | 'checking'>>({})

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const { data: templates = [] } = useQuery({
    queryKey: ['catalog-templates'],
    queryFn:  getCatalogTemplates,
  })

  const { data: stats = [] } = useQuery({
    queryKey: ['tenant-product-stats'],
    queryFn:  getTenantProductStats,
  })

  const { data: brands = [] } = useQuery({
    queryKey: ['brand-stats'],
    queryFn:  getBrandStats,
  })

  // Agrupar las marcas bajo su fabricante: así se puede filtrar por
  // "Bavaria" y ver Águila + Poker + Cola y Pola juntos, o por una marca suelta.
  const byManufacturer = useMemo(() => {
    const map = new Map<string, { total: number; brands: typeof brands }>()
    for (const b of brands) {
      const key = b.manufacturer ?? b.brand
      const entry = map.get(key) ?? { total: 0, brands: [] as typeof brands }
      entry.total += Number(b.products)
      entry.brands.push(b)
      map.set(key, entry)
    }
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        total: v.total,
        brands: [...v.brands].sort((a, b2) => b2.products - a.products),
      }))
      .sort((a, b2) => b2.total - a.total)
  }, [brands])

  const { data: found = [], isLoading, isError, error } = useQuery({
    queryKey: ['discover-products', debounced, onlyWithImage, hideInCatalog, onlyBarcode, tenantId, brand],
    queryFn:  () => discoverTenantProducts({
      search: debounced, onlyWithImage, hideInCatalog,
      onlyWithBarcode: onlyBarcode, tenantId: tenantId || null,
      brand: brand || null, limit: 300,
    }),
  })

  // Verificar fondo blanco de las imágenes que van llegando
  useEffect(() => {
    let cancelled = false
    const pending = found.filter(p => p.image_url && checks[p.image_url!] === undefined)
    if (pending.length === 0) return
    setChecks(prev => {
      const next = { ...prev }
      for (const p of pending) next[p.image_url!] = 'checking'
      return next
    })
    ;(async () => {
      for (const p of pending) {
        const r = await hasWhiteBackground(p.image_url!)
        if (cancelled) return
        setChecks(prev => ({ ...prev, [p.image_url!]: r }))
      }
    })()
    return () => { cancelled = true }
  }, [found])

  const importItem = useMutation({
    mutationFn: async ({ p, withImage }: { p: DiscoveredProduct; withImage: boolean }) => {
      if (!targetTpl) throw new Error('Elige primero a qué catálogo agregarlo')
      // La imagen se copia al bucket del catálogo: si el cliente borra la suya,
      // el catálogo maestro no se queda sin foto.
      const imageUrl = withImage && p.image_url ? await copyImageToCatalog(p.image_url) : null
      return addCatalogItem({
        template_id:  targetTpl,
        name:         p.name,
        category:     p.category ?? undefined,
        barcode:      p.barcode ?? undefined,
        brand:        p.brand ?? undefined,
        manufacturer: p.manufacturer ?? undefined,
        image_url:    imageUrl,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-templates'] })
      qc.invalidateQueries({ queryKey: ['discover-products'] })
      qc.invalidateQueries({ queryKey: ['catalog-items'] })
      toast.success('Agregado al catálogo')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo agregar'),
  })

  const visible = found.filter(p => {
    if (!onlyWhite) return true
    if (!p.image_url) return true          // sin imagen: se puede importar solo el nombre
    const st = checks[p.image_url]
    return st === undefined || st === 'checking' || st === 'white'
  })

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-4 space-y-3">
        <p className="text-xs text-grafito-500">
          Productos que tus clientes ya crearon, agrupados por nombre. Los que aparecen en
          más negocios van primero: esos son los que más te sirven. La marca verde indica
          que la imagen tiene fondo blanco (revisión automática; la miniatura manda).
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grafito-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              className={cn(inputCls, 'pl-9')}
            />
          </div>
          <select
            value={brand}
            onChange={e => setBrand(e.target.value)}
            className={cn(inputCls, 'w-52')}
          >
            <option value="">Todas las marcas</option>
            {byManufacturer.map(m => (
              <optgroup key={m.name} label={m.name}>
                {/* Todo el portafolio del fabricante */}
                <option value={m.name}>▸ Todo {m.name} ({m.total})</option>
                {m.brands.length > 1 && m.brands.map(b => (
                  <option key={b.brand} value={b.brand}>
                    &nbsp;&nbsp;{b.brand} ({b.products})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            className={cn(inputCls, 'w-56')}
          >
            <option value="">Todas las empresas</option>
            {stats.filter(s => s.total_products > 0).map(s => (
              <option key={s.tenant_id} value={s.tenant_id}>
                {s.tenant_name} ({s.unique_products})
              </option>
            ))}
          </select>
          <select
            value={targetTpl}
            onChange={e => setTargetTpl(e.target.value)}
            className={cn(inputCls, 'w-56')}
          >
            <option value="">Agregar a… (elige catálogo)</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-1.5 text-grafito-600 dark:text-grafito-300">
            <input type="checkbox" checked={onlyWithImage} onChange={e => setOnlyImage(e.target.checked)} />
            Solo con imagen
          </label>
          <label className="flex items-center gap-1.5 text-grafito-600 dark:text-grafito-300">
            <input type="checkbox" checked={onlyWhite} onChange={e => setOnlyWhite(e.target.checked)} />
            Solo fondo blanco
          </label>
          <label className="flex items-center gap-1.5 text-grafito-600 dark:text-grafito-300">
            <input type="checkbox" checked={onlyBarcode} onChange={e => setOnlyBarcode(e.target.checked)} />
            Solo con código de barras
          </label>
          <label className="flex items-center gap-1.5 text-grafito-600 dark:text-grafito-300">
            <input type="checkbox" checked={hideInCatalog} onChange={e => setHideInCat(e.target.checked)} />
            Ocultar los que ya tengo
          </label>
          <button
            onClick={() => setShowStats(v => !v)}
            className="ml-auto font-semibold text-brand-500 hover:underline"
          >
            {showStats ? 'Ocultar' : 'Ver'} resumen por empresa
          </button>
        </div>
      </div>

      {/* Resumen por empresa */}
      {showStats && (
        <div className="overflow-x-auto rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grafito-200 dark:border-white/10 text-left text-xs uppercase tracking-wider text-grafito-500">
                <th className="px-4 py-2.5">Empresa</th>
                <th className="px-4 py-2.5 text-right">Productos</th>
                <th className="px-4 py-2.5 text-right">Únicos</th>
                <th className="px-4 py-2.5 text-right">Duplicados</th>
                <th className="px-4 py-2.5 text-right">Con foto</th>
                <th className="px-4 py-2.5 text-right">Con código</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.tenant_id} className="border-b border-grafito-100 dark:border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-grafito-900 dark:text-white">{s.tenant_name}</td>
                  <td className="px-4 py-2.5 text-right">{s.total_products}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-brand-500">{s.unique_products}</td>
                  <td className={cn('px-4 py-2.5 text-right', s.duplicates > 0 && 'font-bold text-amber-500')}>
                    {s.duplicates}
                  </td>
                  <td className="px-4 py-2.5 text-right text-grafito-500">{s.with_image}</td>
                  <td className="px-4 py-2.5 text-right text-grafito-500">{s.with_barcode}</td>
                  <td className="px-4 py-2.5 text-right">
                    {s.total_products > 0 && (
                      <button
                        onClick={() => { setTenantId(s.tenant_id); setShowStats(false) }}
                        className="text-xs font-semibold text-brand-500 hover:underline"
                      >
                        Ver productos
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isError ? (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{(error as Error)?.message ?? 'No se pudieron cargar los productos'}</span>
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-grafito-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Explorando productos de los clientes…
        </div>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-grafito-500">
          No hay productos que cumplan los filtros.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(p => {
            const st = p.image_url ? checks[p.image_url] : undefined
            return (
              <div key={p.barcode ?? p.name} className="flex items-center gap-3 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-grafito-100 dark:bg-white/5">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-5 w-5 text-grafito-400" />
                    </div>
                  )}
                  {st === 'white' && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-white dark:bg-grafito-900" title="Fondo blanco">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </span>
                  )}
                  {st === 'not-white' && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-white dark:bg-grafito-900" title="El fondo no es blanco">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </span>
                  )}
                  {st === 'checking' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/40">
                      <Loader2 className="h-4 w-4 animate-spin text-grafito-500" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-grafito-900 dark:text-white">{p.name}</p>
                  <div className="flex items-center gap-1.5">
                    {p.brand && (
                      <span className="shrink-0 rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-500">
                        {p.brand}
                      </span>
                    )}
                    <p className="truncate text-xs text-grafito-500">{p.category ?? 'Sin categoría'}</p>
                  </div>
                  {p.manufacturer && p.manufacturer !== p.brand && (
                    <p className="truncate text-[11px] text-grafito-400">
                      Fabricante: <span className="font-semibold">{p.manufacturer}</span>
                    </p>
                  )}
                  {p.barcode && (
                    <p className="flex items-center gap-1 truncate font-mono text-[11px] text-grafito-400">
                      <ScanBarcode className="h-3 w-3 shrink-0" /> {p.barcode}
                    </p>
                  )}
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-brand-500">
                    <Store className="h-3 w-3" /> {p.tenant_count} negocio{p.tenant_count === 1 ? '' : 's'}
                    {typeof p.variants === 'number' && p.variants > 1 && (
                      <span className="font-medium text-grafito-400">· {p.variants} registros</span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => importItem.mutate({ p, withImage: true })}
                    disabled={!targetTpl || importItem.isPending || !p.image_url}
                    title={p.image_url ? 'Agregar con la imagen' : 'Este producto no tiene imagen'}
                    className="flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-40"
                  >
                    <Download className="h-3 w-3" /> Con foto
                  </button>
                  <button
                    onClick={() => importItem.mutate({ p, withImage: false })}
                    disabled={!targetTpl || importItem.isPending}
                    title="Agregar solo el nombre y la categoría"
                    className="flex items-center gap-1 rounded-lg border border-grafito-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> Solo nombre
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Marcas por definir: productos que ninguna regla reconoció
// ══════════════════════════════════════════════════════════════
function UnclassifiedTab() {
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, { brand: string; manufacturer: string }>>({})

  const { data: items = [], isLoading, isError, error } = useQuery({
    queryKey: ['unclassified-products'],
    queryFn:  () => getUnclassifiedProducts(150),
  })

  const addRule = useMutation({
    mutationFn: ({ p, usePrefix }: { p: UnclassifiedProduct; usePrefix: boolean }) => {
      const f = form[p.name] ?? { brand: '', manufacturer: '' }
      if (!f.brand.trim()) throw new Error('Escribe el nombre de la marca')
      return addBrandRule({
        matchType:  usePrefix ? 'barcode_prefix' : 'keyword',
        matchValue: usePrefix ? (p.barcode_prefix ?? '') : p.name,
        brand:      f.brand,
        manufacturer: f.manufacturer || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unclassified-products'] })
      qc.invalidateQueries({ queryKey: ['brand-stats'] })
      qc.invalidateQueries({ queryKey: ['discover-products'] })
      toast.success('Regla creada. Todos los productos de esa empresa quedan clasificados.')
    },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo crear la regla'),
  })

  const set = (key: string, patch: Partial<{ brand: string; manufacturer: string }>) =>
    setForm(prev => ({ ...prev, [key]: { brand: '', manufacturer: '', ...prev[key], ...patch } }))

  if (isError) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{(error as Error)?.message ?? 'No se pudo cargar'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-4">
        <p className="text-xs text-grafito-500">
          Productos que el sistema todavía no sabe de qué empresa son. Al definir uno
          por <strong>prefijo de código de barras</strong>, TODOS los productos de esa
          empresa quedan clasificados de una vez — incluidos los que lleguen después.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-grafito-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Revisando…
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-emerald-500">
          Todo clasificado. No hay marcas pendientes.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map(p => {
            const f = form[p.name] ?? { brand: '', manufacturer: '' }
            return (
              <div key={p.name} className="flex flex-wrap items-center gap-3 rounded-xl border border-grafito-200 dark:border-white/10 bg-white dark:bg-grafito-900 p-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-grafito-100 dark:bg-white/5">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" />
                    : <div className="flex h-full w-full items-center justify-center"><Package className="h-4 w-4 text-grafito-400" /></div>}
                </div>

                <div className="min-w-[180px] flex-1">
                  <p className="truncate text-sm font-semibold text-grafito-900 dark:text-white">{p.name}</p>
                  <p className="truncate text-xs text-grafito-500">
                    {p.category ?? 'Sin categoría'} · {p.tenant_count} negocio{p.tenant_count === 1 ? '' : 's'}
                  </p>
                  {p.barcode && (
                    <p className="flex items-center gap-1 font-mono text-[11px] text-grafito-400">
                      <ScanBarcode className="h-3 w-3" /> {p.barcode}
                    </p>
                  )}
                </div>

                <input
                  value={f.brand}
                  onChange={e => set(p.name, { brand: e.target.value })}
                  placeholder="Marca"
                  className={cn(inputCls, 'w-36')}
                />
                <input
                  value={f.manufacturer}
                  onChange={e => set(p.name, { manufacturer: e.target.value })}
                  placeholder="Fabricante"
                  className={cn(inputCls, 'w-40')}
                />

                <div className="flex gap-1.5">
                  {p.barcode_prefix && (
                    <button
                      onClick={() => addRule.mutate({ p, usePrefix: true })}
                      disabled={addRule.isPending}
                      title={`Aplica a todos los productos que empiecen por ${p.barcode_prefix}`}
                      className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      Toda la empresa
                    </button>
                  )}
                  <button
                    onClick={() => addRule.mutate({ p, usePrefix: false })}
                    disabled={addRule.isPending}
                    title="Solo este producto (por nombre)"
                    className="rounded-lg border border-grafito-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-grafito-600 dark:text-grafito-300 hover:bg-grafito-100 dark:hover:bg-white/5 disabled:opacity-50"
                  >
                    Solo este
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Ítems del catálogo ────────────────────────────────────────
function CatalogItems({ templateId }: { templateId: string }) {
  const qc = useQueryClient()
  const [name, setName]         = useState('')
  const [category, setCategory] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog-items', templateId],
    queryFn:  () => getCatalogItems(templateId),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['catalog-items', templateId] })
    qc.invalidateQueries({ queryKey: ['catalog-templates'] })
  }

  const add = useMutation({
    mutationFn: () => addCatalogItem({ template_id: templateId, name, category, sort_order: items.length }),
    onSuccess: () => { invalidate(); setName(''); toast.success('Producto agregado') },
    onError: (e: any) => toast.error(e?.message ?? 'No se pudo agregar'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteCatalogItem(id),
    onSuccess: () => { invalidate(); toast.success('Producto eliminado') },
  })

  return (
    <div className="space-y-3">
      {/* Alta rápida */}
      <div className="flex flex-wrap gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) add.mutate() }}
          placeholder="Nombre del producto"
          className={cn(inputCls, 'flex-1 min-w-[180px]')}
        />
        <input
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="Categoría"
          className={cn(inputCls, 'w-40')}
        />
        <button
          onClick={() => add.mutate()}
          disabled={name.trim().length === 0 || add.isPending}
          className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-grafito-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando productos…
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-grafito-500">Este catálogo aún no tiene productos.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(it => (
            <CatalogItemCard key={it.id} item={it} onDeleted={() => remove.mutate(it.id)} onChanged={invalidate} />
          ))}
        </div>
      )}
    </div>
  )
}

function CatalogItemCard({ item, onDeleted, onChanged }: {
  item: CatalogItemRow
  onDeleted: () => void
  onChanged: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadCatalogImage(file)
      if (!url) { toast.error('No se pudo subir la imagen'); return }
      await updateCatalogItem(item.id, { image_url: url })
      onChanged()
      toast.success('Imagen actualizada')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al subir la imagen')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-grafito-200 dark:border-white/10 p-2.5">
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title="Cambiar imagen"
        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-grafito-100 dark:bg-white/5 hover:ring-2 hover:ring-brand-500/40 transition-all"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-grafito-400" />
        ) : item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-4 w-4 text-grafito-400" />
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-grafito-900 dark:text-white">{item.name}</p>
        <p className="truncate text-xs text-grafito-500">{item.category ?? 'Sin categoría'}</p>
        {item.barcode && (
          <p className="flex items-center gap-1 truncate font-mono text-[11px] text-grafito-400">
            <ScanBarcode className="h-3 w-3 shrink-0" /> {item.barcode}
          </p>
        )}
      </div>

      <button
        onClick={onDeleted}
        className="rounded-lg p-1.5 text-grafito-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
        title="Quitar del catálogo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
