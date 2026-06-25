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
      // Invalidar queries que dependen de ventas
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
