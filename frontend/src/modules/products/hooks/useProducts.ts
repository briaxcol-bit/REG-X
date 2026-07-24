import { useQuery } from '@tanstack/react-query'
import { getProducts, getCategories, type ProductRow, type CategoryRow } from '@lib/db'
import { useAuthStore } from '@store/auth.store'

export type { CategoryRow as Category }

// Adapted shape for POS / pages
export interface Product {
  id: string
  name: string
  price: number
  imageUrl?: string
  sku: string
  barcode?: string
  stock: number
  /** false = se vende sin validar inventario (categoría "sin stock", p. ej. platos) */
  trackStock: boolean
  categoryColor?: string
  categoryName?: string
  tax: number
  categoryId?: string
  status: string
}

export function toProduct(row: ProductRow): Product {
  const stock = (row.inventory ?? []).reduce((s, i) => s + Number(i.quantity), 0)
  const cat   = row.categories as any
  // La categoría puede desactivar el control de stock (platos preparados):
  // esos productos siempre están disponibles para la venta.
  const trackStock = (cat?.track_inventory ?? true) && row.track_inventory !== false
  return {
    id:            row.id,
    name:          row.name,
    price:         Number(row.price),
    imageUrl:      row.image_url ?? undefined,
    sku:           row.sku,
    barcode:       row.barcode ?? undefined,
    stock:         trackStock ? stock : 9999,
    trackStock,
    categoryColor: cat?.color ?? '#374151',
    categoryName:  cat?.name  ?? undefined,
    tax:           Number(row.tax),
    categoryId:    row.category_id ?? undefined,
    status:        row.status,
  }
}

interface UseProductsParams {
  search?:     string | undefined
  categoryId?: string | undefined
  status?:     string | undefined
}

export function useProducts(params?: UseProductsParams) {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)

  return useQuery({
    queryKey: ['products', tenantId, params],
    enabled:  !!tenantId,
    queryFn:  async () => {
      const rows = await getProducts(tenantId!, params)
      return rows.map(toProduct)
    },
    placeholderData: [],
    staleTime: 30_000,
  })
}

export function useCategories() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)

  return useQuery({
    queryKey: ['categories', tenantId],
    enabled:  !!tenantId,
    queryFn:  () => getCategories(tenantId!),
    staleTime: 60_000,
  })
}
