import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@store/auth.store'
import { usePOSStore } from '@store/pos.store'
import {
  getActiveCashRegister,
  openCashRegister,
  closeCashRegister,
  type ActiveCashRegister,
} from '@lib/db'

export type { ActiveCashRegister }

export function useCashSession() {
  const qc = useQueryClient()
  const { tenant, branch } = useAuthStore()
  const { setSession } = usePOSStore()

  const tenantId = tenant?.tenantId ?? ''
  const branchId = branch?.branchId ?? ''

  // ── Query: sesión activa ──────────────────────────────────
  const { data: activeRegister, isLoading } = useQuery({
    queryKey: ['cash-register-active', tenantId, branchId],
    queryFn:  () => getActiveCashRegister(tenantId, branchId),
    enabled:  !!tenantId && !!branchId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  // Sincronizar con pos.store en un effect (no durante el render)
  useEffect(() => {
    if (activeRegister === undefined) return
    if (activeRegister) {
      setSession({
        sessionId:      activeRegister.id,
        cashRegisterId: activeRegister.id,
        openedAt:       activeRegister.opened_at,
        openingCash:    activeRegister.opening_cash,
        cashierId:      activeRegister.opened_by,
      })
    } else {
      setSession(null)
    }
  }, [activeRegister]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutation: abrir caja ──────────────────────────────────
  const openMutation = useMutation({
    mutationFn: ({ name, openingCash }: { name: string; openingCash: number }) =>
      openCashRegister(tenantId, branchId, name, openingCash),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-register-active', tenantId, branchId] })
    },
  })

  // ── Mutation: cerrar caja ─────────────────────────────────
  const closeMutation = useMutation({
    mutationFn: ({ countedCash, notes }: { countedCash: number; notes?: string }) => {
      if (!activeRegister) throw new Error('No hay caja abierta')
      return closeCashRegister(activeRegister.id, countedCash, notes)
    },
    onSuccess: () => {
      setSession(null)
      qc.invalidateQueries({ queryKey: ['cash-register-active', tenantId, branchId] })
    },
  })

  return {
    activeRegister: activeRegister ?? null,
    isLoading,
    hasOpenSession: !!activeRegister,
    open:  openMutation,
    close: closeMutation,
  }
}
