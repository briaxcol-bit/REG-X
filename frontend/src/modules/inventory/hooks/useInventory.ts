import { useQuery } from '@tanstack/react-query'
import { getInventory } from '@lib/db'
import { useAuthStore } from '@store/auth.store'

export function useInventory() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)

  return useQuery({
    queryKey: ['inventory', tenantId, branchId],
    enabled:  !!tenantId && !!branchId,
    queryFn:  () => getInventory(tenantId!, branchId!),
    staleTime: 30_000,
  })
}
