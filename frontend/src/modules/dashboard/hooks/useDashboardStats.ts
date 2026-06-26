import { useQuery } from '@tanstack/react-query'
import { getDashboardStats } from '@lib/db'
import { useAuthStore } from '@store/auth.store'

export function useDashboardStats() {
  const tenantId = useAuthStore((s) => s.tenant?.tenantId)
  const branchId = useAuthStore((s) => s.branch?.branchId)

  return useQuery({
    queryKey: ['dashboard-stats', tenantId, branchId],
    enabled:  !!tenantId && !!branchId,
    queryFn:  () => getDashboardStats(tenantId!, branchId!),
    staleTime: 60_000,
    refetchInterval: 120_000, // refresca cada 2 min
  })
}
