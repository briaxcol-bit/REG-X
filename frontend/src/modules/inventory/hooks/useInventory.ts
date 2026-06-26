import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getInventory } from '@lib/db'
import { useAuthStore } from '@store/auth.store'
import { supabase } from '@lib/supabase'

export function useInventory() {
  const tenantId  = useAuthStore((s) => s.tenant?.tenantId)
  const branchId  = useAuthStore((s) => s.branch?.branchId)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['inventory', tenantId, branchId],
    enabled:  !!tenantId && !!branchId,
    queryFn:  () => getInventory(tenantId!, branchId!),
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  // Real-time: invalidate whenever inventory rows change in Supabase
  useEffect(() => {
    if (!tenantId || !branchId) return

    const channel = supabase
      .channel(`inventory-realtime-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table:  'inventory',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['inventory', tenantId, branchId] })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tenantId, branchId, queryClient])

  return query
}
