import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCustomers, createCustomer, updateCustomer, type CustomerRow, type CustomerInput } from '@lib/db'
import { useAuthStore } from '@store/auth.store'

export type { CustomerInput }

export interface Customer {
  id:           string
  personType:   'NATURAL' | 'EMPRESA'
  docType:      string
  regime:       'SIMPLIFICADO' | 'COMUN'
  fullName:     string
  businessName: string | null
  email:        string | null
  phone:        string | null
  taxId:        string | null
  address:      { city?: string; department?: string; street?: string } | null
  loyaltyPoints: number
  createdAt:    string
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id:           row.id,
    personType:   (row.person_type as 'NATURAL' | 'EMPRESA') ?? 'NATURAL',
    docType:      row.doc_type ?? 'CC',
    regime:       (row.regime as 'SIMPLIFICADO' | 'COMUN') ?? 'SIMPLIFICADO',
    fullName:     row.full_name,
    businessName: row.business_name ?? null,
    email:        row.email ?? null,
    phone:        row.phone ?? null,
    taxId:        row.tax_id ?? null,
    address:      (row.address as Customer['address']) ?? null,
    loyaltyPoints: row.loyalty_points,
    createdAt:    row.created_at,
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
    mutationFn: (data: CustomerInput) =>
      createCustomer(tenantId!, branchId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', tenantId] })
    },
  })
}

export function useUpdateCustomer() {
  const qc       = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerInput }) =>
      updateCustomer(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', tenantId] })
    },
  })
}
