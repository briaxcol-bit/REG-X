import { useQuery } from '@tanstack/react-query'
import { getProducts, getCategories, type ProductRow, type CategoryRow } from '@lib/db'
import { useAuthStore } from '@store/auth.store'

export type { ProductRow as Product, CategoryRow as Category }

// Adapted shape for POS / pages
export interface Product {
  id: string
  name: string
  price: number
  imageUrl?: string
  sku: string
  stock: number
  categoryColor?: string
  categoryName?: string
  tax: number
  categoryId?: string
  status: string
}

function toProduct(row: ProductRow): Product {
  const stock = (row.inventory ?? []).reduce((s, i) => s + Number(i.quantity), 0)
  const cat   = row.categories as any
  return {
    id:            row.id,
    name:          row.name,
    price:         Number(row.price),
    imageUrl:      row.image_url ?? undefined,
    sku:           row.sku,
    stock,
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
