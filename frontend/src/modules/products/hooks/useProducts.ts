import { useQuery } from '@tanstack/react-query'

export interface Product {
  id: string
  name: string
  price: number
  imageUrl?: string
  sku: string
  stock: number
  categoryColor?: string
  tax: number
  categoryId?: string
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Hamburguesa Triple REG-X',
    price: 12.99,
    sku: 'PROD-001',
    stock: 25,
    categoryColor: '#EF4444',
    tax: 0.19,
    categoryId: 'cat-food',
  },
  {
    id: 'p2',
    name: 'Papas Fritas Crujientes L',
    price: 4.50,
    sku: 'PROD-002',
    stock: 50,
    categoryColor: '#F59E0B',
    tax: 0.19,
    categoryId: 'cat-sides',
  },
  {
    id: 'p3',
    name: 'Refresco Cola Zero 500ml',
    price: 2.50,
    sku: 'PROD-003',
    stock: 120,
    categoryColor: '#3B82F6',
    tax: 0.19,
    categoryId: 'cat-drinks',
  },
  {
    id: 'p4',
    name: 'Pizza Pepperoni Familiar',
    price: 18.90,
    sku: 'PROD-004',
    stock: 12,
    categoryColor: '#EF4444',
    tax: 0.19,
    categoryId: 'cat-food',
  },
  {
    id: 'p5',
    name: 'Ensalada César Premium',
    price: 8.99,
    sku: 'PROD-005',
    stock: 5, // low stock!
    categoryColor: '#10B981',
    tax: 0.19,
    categoryId: 'cat-food',
  },
  {
    id: 'p6',
    name: 'Cerveza Artesanal REG-X IPD',
    price: 6.00,
    sku: 'PROD-006',
    stock: 45,
    categoryColor: '#3B82F6',
    tax: 0.19,
    categoryId: 'cat-drinks',
  },
  {
    id: 'p7',
    name: 'Helado de Vainilla y Chips',
    price: 3.99,
    sku: 'PROD-007',
    stock: 0, // out of stock!
    categoryColor: '#EC4899',
    tax: 0.19,
    categoryId: 'cat-desserts',
  },
  {
    id: 'p8',
    name: 'Café Cappuccino Grande',
    price: 3.50,
    sku: 'PROD-008',
    stock: 60,
    categoryColor: '#3B82F6',
    tax: 0.19,
    categoryId: 'cat-drinks',
  }
]

interface UseProductsParams {
  search?: string
  categoryId?: string
  tenantId?: string
}

export function useProducts(params?: UseProductsParams) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      // Simulate API latency
      await new Promise((resolve) => setTimeout(resolve, 300))

      let filtered = [...MOCK_PRODUCTS]

      if (params?.search) {
        const query = params.search.toLowerCase()
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.sku.toLowerCase().includes(query)
        )
      }

      if (params?.categoryId) {
        filtered = filtered.filter((p) => p.categoryId === params.categoryId)
      }

      return filtered
    },
    placeholderData: [],
  })
}
