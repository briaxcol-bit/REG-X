import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCustomers, createCustomer, type CustomerRow } from '@lib/db'
import { useAuthStore } from '@store/auth.store'

export interface Customer {
  id:           string
  fullName:     string
  email?:       string
  phone?:       string
  taxId?:       string
  loyaltyPoints: number
  createdAt:    string
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id:            row.id,
    fullName:      row.full_name,
    email:         row.email ?? undefined,
    phone:         row.phone ?? undefined,
    taxId:         row.tax_id ?? undefined,
    loyaltyPoints: row.loyalty_points,
    createdAt:     row.created_at,
  }
}

interface UseCustomersParams {
  search?: string
  limit?:  number
}

export function useCustomers(params: UseCustomersParams = {}) {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)

  return useQuery({
    queryKey: ['customers', tenantId, params],
    enabled:  !!tenantId,
    queryFn:  async () => {
      const rows = await getCustomers(tenantId!, params)
      return rows.map(toCustomer)
    },
    placeholderData: [],
    staleTime: 30_000,
  })
}

export function useCreateCustomer() {
  const qc       = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)

  return useMutation({
    mutationFn: (data: { full_name: string; email?: string; phone?: string; tax_id?: string }) =>
      createCustomer(tenantId!, branchId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', tenantId] })
    },
  })
}
