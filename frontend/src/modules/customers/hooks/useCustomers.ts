import { useQuery } from '@tanstack/react-query'
import { get } from '@/lib/api'

export interface Customer {
  id: string
  fullName: string
  email?: string
  phone?: string
}

interface UseCustomersParams {
  search?: string
  limit?: number
}

const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', fullName: 'Juan Pérez', email: 'juan.perez@example.com', phone: '3001234567' },
  { id: 'c2', fullName: 'Maria Rodriguez', email: 'maria.r@example.com', phone: '3109876543' },
  { id: 'c3', fullName: 'Carlos Gómez', email: 'carlos.g@example.com', phone: '3201112233' },
  { id: 'c4', fullName: 'Ana Maria', email: 'ana.maria@example.com', phone: '3157778899' },
]

export function useCustomers(params: UseCustomersParams = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      // Return mock data filtered by search
      const searchLower = params.search?.toLowerCase() || ''
      if (!searchLower) return MOCK_CUSTOMERS
      return MOCK_CUSTOMERS.filter(
        c => c.fullName.toLowerCase().includes(searchLower) ||
             c.email?.toLowerCase().includes(searchLower) ||
             c.phone?.includes(searchLower)
      )
    },
  })
}
