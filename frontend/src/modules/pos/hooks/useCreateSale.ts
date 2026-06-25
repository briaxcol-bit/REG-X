import { useMutation } from '@tanstack/react-query'
import { post } from '@/lib/api'

export interface CreateSaleItem {
  productId: string
  quantity: number
  price: number
  discount?: number
}

export interface CreateSalePayment {
  method: string
  amount: number
  reference?: string
}

export interface CreateSalePayload {
  items: CreateSaleItem[]
  payments: CreateSalePayment[]
  discounts?: any[] | undefined
  customerId?: string | undefined
  tableId?: string | undefined
  notes?: string | undefined
  total: number
}

export function useCreateSale() {
  return useMutation({
    mutationFn: async (payload: CreateSalePayload) => {
      return post<any>('/pos/sales', payload)
    },
  })
}
