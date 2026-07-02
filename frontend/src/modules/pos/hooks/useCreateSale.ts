import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSale, type CreateSalePayload } from '@lib/db'
import { useAuthStore } from '@store/auth.store'

export type { CreateSalePayload }

export function useCreateSale() {
  const qc       = useQueryClient()
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)
  const userId   = useAuthStore((s) => s.user?.id)

  return useMutation({
    mutationFn: (payload: CreateSalePayload) =>
      createSale(tenantId!, branchId!, userId!, payload),
    onSuccess: () => {
      const opts = { refetchType: 'all' as const }
      qc.invalidateQueries({ queryKey: ['sales'],          ...opts })
      qc.invalidateQueries({ queryKey: ['sales-history'],  ...opts })
      qc.invalidateQueries({ queryKey: ['shift-sales'],    ...opts })
      qc.invalidateQueries({ queryKey: ['pending-sales'],  ...opts })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'],...opts })
      qc.invalidateQueries({ queryKey: ['inventory'],      ...opts })
      qc.invalidateQueries({ queryKey: ['products'],       ...opts })
    },
  })
}
