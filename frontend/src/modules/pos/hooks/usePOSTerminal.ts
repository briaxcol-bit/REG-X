/**
 * usePOSTerminal
 * Carga la configuración de terminal del cajero actual.
 * - Si el usuario es OWNER/ADMIN → sin restricciones (null)
 * - Si es CASHIER con terminal asignada → aplica modo y categorías
 * - Si es CASHIER sin terminal asignada → acceso completo (null)
 */
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@store/auth.store'
import { getMyPOSTerminal, type POSTerminalRow } from '@lib/db'

export type { POSTerminalRow }

export function usePOSTerminal() {
  const { tenant, branch, hasRole } = useAuthStore()

  const tenantId = tenant?.tenantId ?? ''
  const branchId = branch?.branchId ?? ''

  // OWNER/ADMIN no tienen restricciones de terminal
  const isManager = hasRole('OWNER') || hasRole('ADMIN')

  const { data: terminal, isLoading } = useQuery({
    queryKey: ['pos-terminal-mine', tenantId, branchId],
    queryFn:  () => getMyPOSTerminal(tenantId, branchId),
    enabled:  !!tenantId && !!branchId && !isManager,
    staleTime: 60_000,
  })

  if (isManager) {
    return {
      terminal:          null as POSTerminalRow | null,
      isLoading:         false,
      isCommandsOnly:    false,
      allowedCategories: null as string[] | null,   // null = todas
    }
  }

  return {
    terminal:          terminal ?? null,
    isLoading,
    isCommandsOnly:    terminal?.mode === 'COMMANDS_ONLY',
    allowedCategories: terminal?.allowed_category_ids ?? null,
  }
}
